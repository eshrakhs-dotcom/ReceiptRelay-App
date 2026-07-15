# ReceiptRelay

A full-stack receipt processing application that converts uploaded receipts into structured, reviewable, and exportable expense records.

ReceiptRelay uses OCR, deterministic parsing, data normalization, configurable policy rules, and duplicate detection to support a complete receipt-review workflow.

---

## Table of Contents

* [Overview](#overview)
* [Business Problem](#business-problem)
* [Application Workflow](#application-workflow)
* [Key Features](#key-features)
* [Architecture](#architecture)
* [Technology Stack](#technology-stack)
* [Core Engineering Components](#core-engineering-components)
* [Application Routes](#application-routes)
* [API Endpoints](#api-endpoints)
* [Evaluation](#evaluation)
* [Project Structure](#project-structure)
* [Getting Started](#getting-started)
* [Running the Evaluation](#running-the-evaluation)
* [Key Contributions](#key-contributions)
* [Skills Demonstrated](#skills-demonstrated)
* [Current Limitations](#current-limitations)
* [Future Improvements](#future-improvements)

---

## Overview

ReceiptRelay is a software engineering project built with Next.js, TypeScript, and Supabase.

The application allows users to upload receipt images, extract transaction data, review policy violations, correct parsed fields, approve receipts, and export structured expense records.

The project focuses on building a complete application workflow rather than relying exclusively on AI-generated outputs. Core financial processing decisions are handled through deterministic parsing, normalization, validation, and duplicate-detection logic.

---

## Business Problem

Manual receipt processing commonly requires users to:

* Review receipt images
* Enter transaction details
* Check expense-policy compliance
* Identify duplicate submissions
* Correct incomplete records
* Prepare data for accounting exports

ReceiptRelay combines these steps into one application with automated preprocessing and human review.

---

## Application Workflow

```text
Receipt Upload
      ↓
OCR Processing
      ↓
Field Parsing
      ↓
Data Normalization
      ↓
Policy Validation
      ↓
Duplicate Detection
      ↓
Manual Review or Approval
      ↓
CSV or PDF Export
```

---

## Key Features

* Upload receipt images and documents
* Extract receipt text using OCR
* Parse vendor, date, subtotal, tax, total, and currency
* Normalize inconsistent transaction data
* Detect potential duplicate receipts
* Apply configurable expense-policy rules
* Flag incomplete or noncompliant receipts
* Review and edit extracted receipt fields
* Approve validated expense records
* Export approved receipts as CSV or PDF
* Store receipt files and records in Supabase
* Optionally generate category suggestions using an LLM

---

## Architecture

```text
┌──────────────────────────────┐
│        Next.js Client        │
│                              │
│  Upload │ Review │ Settings  │
│  Edit   │ Approve │ Export   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      Next.js API Routes      │
│                              │
│  Upload Processing           │
│  OCR and Parsing             │
│  Policy Validation           │
│  Duplicate Detection         │
│  Receipt Management          │
│  Export Generation           │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│           Supabase           │
│                              │
│  PostgreSQL Database         │
│  Receipt File Storage        │
│  Policy Configuration        │
│  Evaluation Metrics          │
└──────────────────────────────┘
```

---

## Technology Stack

| Layer               | Technology                      |
| ------------------- | ------------------------------- |
| Frontend            | Next.js, React, TypeScript      |
| Backend             | Next.js API Routes, Node.js     |
| Database            | Supabase PostgreSQL             |
| File Storage        | Supabase Storage                |
| OCR                 | Tesseract.js                    |
| Parsing             | Custom TypeScript parsing rules |
| Validation          | Configurable policy engine      |
| Duplicate Detection | Normalized receipt fingerprint  |
| Export              | CSV and PDF generation          |
| Optional AI         | LLM-based category suggestions  |

---

## Core Engineering Components

### OCR Processing

Uploaded receipt files are stored in Supabase Storage and processed using Tesseract.js.

The OCR layer extracts raw text that is passed into the receipt parsing pipeline.

---

### Receipt Parsing

Receipt parsing logic is located in:

```text
lib/parse.ts
```

The parser converts unstructured OCR output into structured fields such as:

* Vendor
* Transaction date
* Subtotal
* Tax
* Total
* Currency
* Expense category

The parsing layer uses deterministic rules rather than relying entirely on an external AI model.

---

### Data Normalization

Normalization standardizes receipt data before validation and duplicate detection.

Examples include:

* Converting vendor names to a consistent format
* Removing unnecessary punctuation
* Standardizing capitalization and spacing
* Converting dates into a consistent format
* Standardizing monetary values
* Normalizing currency codes

This reduces mismatches caused by formatting differences in OCR output.

---

### Policy Engine

ReceiptRelay evaluates receipts against configurable expense policies.

Supported policy checks include:

* Receipt amount thresholds
* Per-diem limits
* Restricted expense categories
* Missing required fields
* Invalid transaction values
* Potential duplicate submissions

Default policy definitions are stored in:

```text
rules/defaultPolicies.json
```

Policies can also be managed through the application settings page.

---

### Vendor Categorization

Known vendors can be assigned to predefined expense categories using:

```text
rules/vendorCategoryMap.json
```

This allows ReceiptRelay to perform deterministic category assignment before optional AI-based category suggestions are considered.

---

### Duplicate Detection

Potential duplicates are identified using a normalized transaction fingerprint:

```text
vendor | transaction_date | total_amount
```

For example:

```text
starbucks|2026-03-15|12.48
```

Normalizing the fingerprint helps detect duplicates even when OCR produces minor differences in capitalization, punctuation, or spacing.

---

### Human-in-the-Loop Review

ReceiptRelay does not automatically treat every extracted record as correct.

Receipts with missing fields, policy violations, parsing uncertainty, or duplicate warnings remain available for manual review.

Users can:

* Review extracted values
* Correct inaccurate fields
* Inspect policy flags
* Approve valid receipts
* Leave flagged receipts pending

This separates automated preprocessing from final approval.

---

### Export Generation

Approved receipts can be exported by month in CSV or PDF format.

CSV exports follow a consistent column structure for use in spreadsheet or accounting workflows.

PDF exports summarize:

* Total expenses
* Expense categories
* Vendors
* Policy flags
* Receipt counts

---

## Application Routes

| Route              | Purpose                             |
| ------------------ | ----------------------------------- |
| `/`                | View pending and approved receipts  |
| `/upload`          | Upload a new receipt                |
| `/receipt/[id]`    | Review, edit, and approve a receipt |
| `/export`          | Generate receipt exports            |
| `/settings/policy` | Configure expense-policy rules      |

---

## API Endpoints

| Method | Endpoint               | Description                              |
| ------ | ---------------------- | ---------------------------------------- |
| `POST` | `/api/upload`          | Upload, process, and store a receipt     |
| `GET`  | `/api/receipt/:id`     | Retrieve a receipt record                |
| `POST` | `/api/receipt/:id`     | Update or approve a receipt              |
| `GET`  | `/api/export`          | Export approved receipt records          |
| `GET`  | `/api/settings/policy` | Retrieve policy settings                 |
| `POST` | `/api/settings/policy` | Update policy settings                   |
| `POST` | `/api/ai`              | Generate an optional category suggestion |

Example export request:

```http
GET /api/export?month=2026-03&format=csv
```

---

## Evaluation

The receipt-processing pipeline was evaluated using a dataset of 200 synthetic receipts.

The same dataset was processed across four configurations:

1. `manual_only`
2. `ocr_parse_only`
3. `ocr_parse_policy_no_norm`
4. `full_pipeline`

The evaluation measured field extraction, normalization, duplicate detection, automated approval, and modeled manual workload.

### Evaluation Results

| Metric                            | Result |
| --------------------------------- | -----: |
| Receipts evaluated                |    200 |
| Auto-approval rate                |  36.0% |
| Remaining manual workload         |  57.3% |
| Modeled manual workload reduction |  42.7% |
| Duplicate-detection F1 score      |  1.000 |
| Vendor exact-match accuracy       |  65.0% |
| Vendor normalized-match accuracy  |  97.5% |
| Date exact-match accuracy         |   100% |
| Amount exact-match accuracy       |   100% |
| Tax exact-match accuracy          |   100% |
| Currency exact-match accuracy     |   100% |

### Key Evaluation Finding

Vendor normalization improved vendor matching from:

```text
65.0% exact-match accuracy
```

to:

```text
97.5% normalized-match accuracy
```

The evaluation also showed that the full processing pipeline reduced the modeled manual workload to 57.3% of the manual baseline.

> The benchmark uses synthetic receipt data and should not be interpreted as production-level OCR performance.

---

## Project Structure

```text
ReceiptRelay/
├── app/
│   ├── api/
│   │   ├── ai/
│   │   ├── export/
│   │   ├── receipt/
│   │   ├── settings/
│   │   └── upload/
│   ├── export/
│   ├── receipt/
│   │   └── [id]/
│   ├── settings/
│   │   └── policy/
│   ├── upload/
│   └── page.tsx
│
├── lib/
│   └── parse.ts
│
├── rules/
│   ├── defaultPolicies.json
│   └── vendorCategoryMap.json
│
├── research/
│   ├── output/
│   └── scripts/
│
├── supabase/
│   ├── migrations_research.sql
│   ├── schema.sql
│   └── seed.sql
│
├── .env.local.example
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

Before running the application, install:

* Node.js
* npm
* Supabase CLI
* A Supabase project

---

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ReceiptRelay
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Configure Environment Variables

Copy the environment template:

```bash
cp .env.local.example .env.local
```

Add the required Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

To enable optional AI-based category suggestions:

```env
LLM_ENABLED=true
```

The core receipt-processing workflow can run without enabling the optional AI endpoint.

---

### 4. Configure Supabase Storage

Create a Supabase Storage bucket named:

```text
receipts
```

The bucket can use public access or service-role-controlled write access depending on the deployment configuration.

---

### 5. Apply the Database Schema

Using the Supabase CLI:

```bash
supabase db push
```

Alternatively, run the following file in the Supabase SQL editor:

```text
supabase/schema.sql
```

Seed the default application settings using:

```text
supabase/seed.sql
```

---

### 6. Start the Development Server

```bash
npm run dev
```

Open the application at:

```text
http://localhost:3000
```

---

## Running the Evaluation

### 1. Apply the Research Migration

Run the following file in the Supabase SQL editor:

```text
supabase/migrations_research.sql
```

---

### 2. Confirm Environment Variables

Ensure `.env.local` contains:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

---

### 3. Run the Benchmark

```bash
npm run research:run -- 2026-03 200
```

The arguments represent:

```text
evaluation_month number_of_receipts
```

---

### Evaluation Outputs

The evaluation script:

* Processes the dataset across four pipeline configurations
* Inserts full-pipeline receipt records into the `receipts` table
* Stores experiment metadata in `research_runs`
* Stores metrics in `research_metrics`
* Writes a JSON report to `research/output/`

---

## Key Contributions

* Built a full-stack receipt processing application using Next.js, TypeScript, and Supabase.
* Designed an end-to-end workflow covering file upload, OCR, parsing, normalization, policy validation, manual review, approval, and export.
* Developed deterministic receipt parsing and vendor categorization logic.
* Implemented configurable expense-policy checks for receipt thresholds, restricted categories, missing fields, and duplicate submissions.
* Built duplicate detection using normalized vendor, date, and amount fingerprints.
* Designed API routes for receipt processing, record management, policy configuration, exports, and optional AI suggestions.
* Integrated Supabase PostgreSQL and Storage for application data and receipt files.
* Created a reproducible evaluation framework for comparing receipt-processing configurations.
* Evaluated the application using 200 synthetic receipts and stored experiment results in dedicated research tables.
* Improved vendor matching from 65.0% exact-match accuracy to 97.5% normalized-match accuracy.

---

## Skills Demonstrated

* Full-stack application development
* Software architecture
* TypeScript development
* Next.js App Router
* React user interface development
* REST API design
* PostgreSQL database integration
* Supabase Storage
* OCR integration
* Data parsing and normalization
* Business-rule implementation
* Duplicate-detection logic
* Human-in-the-loop workflows
* CSV and PDF export generation
* Environment configuration
* Experiment design
* Application performance evaluation
* Git and GitHub documentation

---

## Current Limitations

* OCR performance depends on receipt image quality and document layout.
* Parsing rules may require additional patterns for unfamiliar receipt formats.
* Duplicate detection currently relies on transaction fields rather than image similarity.
* The evaluation dataset contains synthetic rather than production receipt data.
* Authentication and organization-level access controls are not included in the MVP.
* OCR processing runs in the Node.js runtime and is not currently handled by a background job queue.
* Vendor categorization coverage is limited to the configured vendor mapping rules.

---

## Future Improvements

* Add user authentication
* Add role-based access control
* Support multiple organizations and expense workspaces
* Move OCR processing to asynchronous background jobs
* Add automated unit and integration testing
* Add GitHub Actions for continuous integration
* Add image-based duplicate detection
* Expand receipt format and vendor coverage
* Add accounting platform integrations
* Add structured logging and monitoring
* Add pagination and filtering for large receipt datasets
* Improve accessibility and mobile responsiveness
* Deploy OCR processing through serverless or edge infrastructure

---

## Project Status

ReceiptRelay is an MVP developed as a software engineering and application development portfolio project.

The current version demonstrates the complete receipt-processing workflow, including upload, OCR, parsing, validation, review, approval, export, and evaluation.

