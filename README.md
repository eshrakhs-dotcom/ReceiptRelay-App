# ReceiptRelay (MVP)

Next.js + Supabase implementation of the PRD. Focused on: upload → OCR → parsing → policy flags → approve → export.

## Getting started

1. Copy `.env.local.example` to `.env.local` and fill Supabase URL + keys. Create a `receipts` storage bucket (public or service-role write).
2. Apply schema: `supabase db push` (or run `supabase/schema.sql`). Seed defaults with `supabase/seed.sql`.
3. Install deps: `npm install`.
4. Run dev server: `npm run dev`.

## API surface
- `POST /api/upload` – multipart upload; stores in `receipts` bucket, runs OCR + heuristics, saves receipt row.
- `GET/POST /api/receipt/:id` – fetch or update/approve a receipt.
- `GET /api/export?month=YYYY-MM&format=csv|pdf` – download export.
- `GET/POST /api/settings/policy` – manage per-diem/receipt-threshold/restricted categories.
- `POST /api/ai` – category suggestion (gated by `LLM_ENABLED`).

## App pages
- `/` inbox + approved views, quick approve and flags.
- `/upload` upload flow.
- `/receipt/[id]` edit/approve.
- `/export` export helper.
- `/settings/policy` policy form.

## Notes
- Parsing heuristics live in `lib/parse.ts` with vendor→category map in `rules/vendorCategoryMap.json` and default policies in `rules/defaultPolicies.json`.
- OCR uses `tesseract.js` locally (node runtime); swap with Supabase Edge Function if desired.
- CSV export matches PRD column order. PDF summarises totals, categories, vendors, and flags.
- Feature flag: set `LLM_ENABLED=true` to enable `/api/ai` responses.
