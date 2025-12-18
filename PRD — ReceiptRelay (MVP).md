# **PRD — ReceiptRelay (MVP)**

## **0\. One-liner**

Turn raw receipts into clean, policy-checked expense rows you can export to CSV—fast, simple, and auditable.

---

## **1\. Problem & Goals**

**Problem:** Founders and small teams waste time transcribing receipts and fixing preventable policy mistakes (over per-diem, missing memos, duplicates).  
 **MVP Goal:** A browser app where a user uploads a receipt (image/PDF), the app extracts vendor/date/amount/tax, suggests a category, flags basic policy issues, and exports a clean monthly CSV.

**Success metrics (MVP)**

* Time from upload → approved row ≤ **60s** for clear receipts.

* OCR accuracy (date & amount) ≥ **90%** on a 50-receipt sample.

* Duplicate false-positive rate ≤ **5%**.

* Export opens cleanly in Google Sheets & Excel.

**Out of scope (MVP)**

* Corporate card feeds, advanced approvals, GL API push, mobile app.

---

## **2\. Target User / Persona**

* **Primary:** Solo founder or small finance owner-operator who uses spreadsheets/GL uploads.

* **Secondary:** Office manager who collects team receipts monthly.

---

## **3\. User Stories (MVP)**

1. As a user, I upload a receipt image/PDF and see parsed fields (vendor, date, amount, tax) with quick edits.

2. As a user, I get an **auto category suggestion** I can accept or change.

3. As a user, I see **policy nudges** (receipt required threshold, per-diem check) before approving.

4. As a user, I am warned on **duplicates** and can mark legit duplicates as “not a duplicate.”

5. As a user, I export a **monthly CSV** and a **simple PDF summary**.

6. As a user, I can configure **per-diem** and **receipt required threshold**.

---

## **4\. Scope & System Overview**

* **Web app:** Server-rendered (Jinja/HTMX) with FastAPI.

* **OCR pipeline:** Tesseract (`pytesseract`) → regex parsers → heuristics.

* **DB:** SQLite.

* **Storage:** Local `/uploads` path.

* **Optional LLM (feature flag off by default):** Category suggestion refinement.

---

## **5\. Data Model (SQLite)**

`-- Users (MVP: single user row created at first run)`  
`CREATE TABLE users (`  
  `id TEXT PRIMARY KEY,`  
  `email TEXT,`  
  `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`  
`);`

`CREATE TABLE policies (`  
  `user_id TEXT PRIMARY KEY,`  
  `per_diem NUMERIC DEFAULT 60.00,`  
  `receipt_required_over NUMERIC DEFAULT 25.00,`  
  `restricted_categories TEXT DEFAULT '[]', -- JSON array`  
  `FOREIGN KEY(user_id) REFERENCES users(id)`  
`);`

`CREATE TABLE receipts (`  
  `id TEXT PRIMARY KEY,`  
  `user_id TEXT,`  
  `created_at DATETIME DEFAULT CURRENT_TIMESTAMP,`  
  `status TEXT CHECK(status IN ('inbox','approved','rejected')) DEFAULT 'inbox',`  
  `file_path TEXT NOT NULL,`  
  `ocr_text TEXT,`  
  `date DATE,`  
  `vendor TEXT,`  
  `amount NUMERIC,`  
  `tax NUMERIC,`  
  `currency TEXT DEFAULT 'USD',`  
  `category TEXT,`  
  `payment_method TEXT,   -- 'personal','company','card_xxx' (free text)`  
  `memo TEXT,`  
  `policy_flags TEXT DEFAULT '[]', -- JSON array: ["over_per_diem","receipt_required","restricted_category","duplicate_detected"]`  
  `duplicate_of TEXT,             -- receipts.id if duplicate`  
  `FOREIGN KEY(user_id) REFERENCES users(id)`  
`);`

`CREATE TABLE logs (`  
  `id INTEGER PRIMARY KEY AUTOINCREMENT,`  
  `receipt_id TEXT,`  
  `step TEXT,                 -- 'upload','ocr','parse','policy','approve','export'`  
  `message TEXT,`  
  `ts DATETIME DEFAULT CURRENT_TIMESTAMP,`  
  `FOREIGN KEY(receipt_id) REFERENCES receipts(id)`  
`);`

**Derived hash for duplicate detection (not stored, computed):**  
 `sha256( lower(vendor) + '|' + date + '|' + round(amount,2) )`

---

## **6\. Data Contracts**

### **6.1 CSV Export (exact columns & order)**

`date,vendor,amount,tax,currency,category,payment_method,memo,receipt_id,policy_flags,duplicate_of`

### **6.2 Example CSV Row**

`2025-02-14,Uber,34.50,0,USD,Travel,personal,"Airport ride",rcpt_2f1c9,["receipt_required"],`

### **6.3 Receipt JSON (internal API)**

`{`  
  `"id": "rcpt_2f1c9",`  
  `"status": "approved",`  
  `"file_path": "/uploads/rcpt_2f1c9.jpg",`  
  `"date": "2025-02-14",`  
  `"vendor": "Uber",`  
  `"amount": 34.50,`  
  `"tax": 0.00,`  
  `"currency": "USD",`  
  `"category": "Travel",`  
  `"payment_method": "personal",`  
  `"memo": "Airport ride",`  
  `"policy_flags": ["receipt_required"],`  
  `"duplicate_of": null`  
`}`

---

## **7\. API Endpoints**

### **7.1 Upload**

`POST /upload (multipart/form-data)`  
`body: file=<image/pdf>`  
`resp: 201 Created`  
`{`  
  `"receipt_id": "rcpt_xxx",`  
  `"status": "inbox"`  
`}`  
`Errors:`  
`- 400 invalid file type`  
`- 500 ocr failure`

### **7.2 Get Receipt (detail)**

`GET /receipt/{id}`  
`resp: 200 OK -> HTML page (Jinja) with edit form`

### **7.3 Update Receipt (approve/edit)**

`POST /receipt/{id}`  
`body (application/x-www-form-urlencoded or JSON):`  
  `date, vendor, amount, tax, currency, category, payment_method, memo, mark_duplicate_of(optional)`  
`resp: 200 OK { "ok": true, "status": "approved" }`  
`Errors:`  
`- 422 validation error`

### **7.4 List (Inbox/Approved)**

`GET /?status=inbox|approved`  
`resp: 200 OK -> HTML table with filters`

### **7.5 Export**

`GET /export?month=YYYY-MM&format=csv|pdf`  
`resp: 200 OK -> file download`  
`Errors:`  
`- 400 invalid month`  
`- 404 no receipts in month`

### **7.6 Policies**

`GET /settings/policy -> HTML form`  
`POST /settings/policy (form data)`  
  `per_diem, receipt_required_over, restricted_categories(json)`  
`resp: 200 OK { "ok": true }`

---

## **8\. OCR & Parsing Pipeline**

1. **Store file** to `/uploads/{receipt_id}.{ext}`; log `upload`.

2. **OCR (Tesseract):** `pytesseract.image_to_string()` or PDF→image first; log `ocr`.

3. **Normalize:** lowercase, strip non-ASCII except currency symbols, collapse whitespace.

4. **Parse heuristics:**

   * **amount**: prefer lines with `total`, else largest currency-like number.

   * **tax**: line containing `tax`; else 0\.

   * **date**: detect `YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YY`; choose most plausible.

   * **vendor**: first all-caps line or line near “merchant/vendor”; fallback to first non-numeric line.

5. **Category suggestion (rules → optional AI):** vendor keyword maps; if LLM flag on, return `{category, confidence, explanation}`.

6. **Duplicate detection:** compute hash and query `receipts`; if match → flag.

7. **Policy flags:**

   * `receipt_required` if `amount > receipt_required_over` and data is incomplete.

   * `over_per_diem` if `category == 'Meals'` and `amount > per_diem`.

   * `restricted_category` if category in restricted list.

8. Save parsed fields; keep status `inbox`. Log `parse` and `policy`.

---

## **9\. UX Flows**

### **9.1 Upload → Inbox Card**

* Drag/drop file → toast “Processing…”.

* Card appears in **Inbox** with editable fields: date, vendor, amount, tax, category, memo.

* Banner with policy flags (red/yellow).

### **9.2 Approve**

* User edits (if needed) → **Approve** → status `approved`.

* If duplicate flagged, user can **Mark as legitimate** (clears `duplicate_of`).

### **9.3 Export**

* **Export** page: choose month → **Download CSV** or **Download PDF summary**.

* PDF includes totals, spend by category, and flag counts.

---

## **10\. Acceptance Tests**

* **AT-1 OCR:** Given a clear Starbucks receipt, app extracts **date** and **amount** correctly.

* **AT-2 Category rules:** “Uber” → suggest **Travel** (overridable).

* **AT-3 Duplicate:** Upload same Uber receipt twice → second shows **duplicate** banner.

* **AT-4 Policy:** Meals over per-diem → **Over per-diem** flag.

* **AT-5 Export:** Export February CSV; opens in Sheets with exact column order.

* **AT-6 Performance:** Upload → approved (no edits) in **≤60s** on Replit.

---

## **11\. Non-Functional Requirements**

* **Security:** Do not log raw images or full OCR text in plain logs; store paths in DB.

* **Privacy:** No third-party calls unless LLM flag is on; redact emails/phones in logs.

* **Reliability:** Graceful failure if OCR fails—show empty fields \+ “needs review.”

* **Observability:** `logs` table records each step and message.

---

## **12\. Seed Data / Samples**

**Vendor → Category map (JSON)**

`{`  
  `"uber|lyft": "Travel",`  
  `"delta|united|airlines|southwest": "Travel",`  
  `"starbucks|coffee|peet": "Meals",`  
  `"amazon": "Supplies",`  
  `"staples|office depot": "Supplies",`  
  `"hotel|marriott|hilton|hyatt": "Lodging"`  
`}`

**Default policies (JSON)**

`{`  
  `"per_diem": 60.0,`  
  `"receipt_required_over": 25.0,`  
  `"restricted_categories": ["Gifts > $100"]`  
`}`

**PDF Summary (sections)**

* Month & totals (amount, tax)

* Spend by category table

* Top vendors table

* Flags summary: over\_per\_diem, restricted, duplicate

---

## **13\. Optional LLM Spec (feature flag `LLM_ENABLED=false`)**

**Prompt (category suggestion)**

`Role: Expense assistant. Goal: suggest a category and confidence.`  
`Inputs: vendor, ocr_snippet (<=240 chars), memo.`  
`Output (JSON only): {"category":"", "confidence":0-1, "explanation":"<=20 words"}`  
`Rules: No new facts; if unsure, return {"category":"Uncategorized","confidence":0.4}`

**Endpoint:** `POST /ai/category` (internal) — returns JSON above; only called if flag ON.

---

## **14\. Rollout Plan**

* **Day 1–2:** DB \+ upload \+ OCR.

* **Day 3:** Parse heuristics \+ category rules.

* **Day 4:** Inbox UI \+ edit \+ approve.

* **Day 5:** Duplicates \+ policy flags.

* **Day 6:** Export CSV \+ PDF summary.

* **Day 7:** Polishing \+ seed data \+ sample receipts \+ README.

---

## **15\. Risks & Mitigations**

* **OCR quality variance:** “Needs review” state; fast inline edits; hosted OCR fallback later.

* **Vendor naming noise:** User-editable vendor→category map.

* **Policy complexity creep:** Limit to 2 checks in MVP; extend with JSON rules later.

* **Storage limits (Replit):** Periodic cleanup; warn near quota.

---

## **16\. Handoff Notes for AI Coding Agent**

* Use **FastAPI**, **Jinja/HTMX**, **SQLModel**, **pytesseract**, **reportlab** (or weasyprint) for PDF.

* Keep HTML minimal and mobile-friendly.

* Follow export column order exactly.

* Centralize regex & vendor maps in `/rules/`.

* Feature flags via env vars: `LLM_ENABLED=false`.

* Provide a `Makefile` or `justfile` with `run`, `seed`, `test` tasks.

