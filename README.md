# Clover Books

**AI-powered accounting OS with an intelligent Companion Control Tower.**

---

## Overview

Clover Books is a modern accounting platform built for small businesses, freelancers, and agencies. Unlike traditional bookkeeping software that simply records transactions, Clover Books features an **AI Companion** that proactively monitors your financial health, surfaces issues, and guides you through month-end close.

The system combines **deterministic accounting rules** with **AI-powered insights**. The AI analyzes, suggests, and explains, while you remain in control. This "human-in-the-loop" design ensures accuracy and compliance while dramatically reducing the cognitive load of managing business finances.

Clover Books is designed to be the **"control tower"** for your books: one dashboard that shows you what needs attention, what's working, and what to do next.

---

## Demo

📹 **Demo Video**: [Watch on Loom](https://www.loom.com/share/924456e287574d8bbae68cd16ddaab2a)

### Screenshots

Key screens (see demo video for full walkthrough):

| Feature | Description |
|---------|-------------|
| **Dashboard** | Main dashboard with Companion banner showing today's focus |
| **AI Companion** | Control Tower with Radar, Coverage, Playbook, and Story |
| **Secure Auth** | Email/Password + **Google OAuth** support |
| **Receipts AI** | Upload and OCR extraction with suggested classification |
| **Books Review** | Ledger audit with Deterministic Findings + Neural Analysis |
| **Banking** | Bank transaction feed with reconciliation |

---

## Feature Highlights

### 📄 Receipts AI
- Upload receipts (photos, PDFs, scans)
- GPT-4o-mini extracts vendor, amount, date, and line items
- DeepSeek suggests journal entry classification
- One-click approval to post to ledger

### 📋 Invoices AI
- Create and track invoices with status management
- AI risk scoring for overdue/at-risk invoices
- Companion strip shows contextual insights

### 🏦 Banking Workspace
- Connect bank accounts manually or via import
- Transaction feed with categorization
- Reconciliation engine matches bank lines to ledger entries

### 📊 Books Review
- Ledger-wide audit across all journal entries
- Deterministic checks (duplicates, outliers, large entries)
- Neural Analysis insights from DeepSeek
- Risk scoring and actionable recommendations

### 🔍 Bank Review
- Per-account reconciliation analysis
- Unmatched transaction detection
- AI-powered insights for discrepancies

### 🤖 AI Companion Control Tower
- **Radar**: 4-axis stability scores (cash, revenue, expenses, tax)
- **Coverage**: Percentage of transactions reviewed by AI
- **Close-Readiness**: Month-end checklist status
- **Playbook**: Prioritized action items
- **Story**: Weekly narrative summary of business health
- **Issues**: Aggregated findings from all surfaces

### 🔐 Secure Authentication
- **Google OAuth**: Fast and secure sign-in with Google
- **JWT Sessions**: Secure session management via JSON Web Tokens
- **Native Auth**: Reliable email and password authentication

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                 │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    VERCEL FRONTENDS                          │
│   Customer App (React/Vite) + Admin App (React/Vite)         │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    NATIVE RUST API                          │
│             (Axum endpoints + Native Auth)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Services   │  │   Agentic   │  │   Companion/LLM     │  │
│  │   (Rust)    │  │  Workflows  │  │    Integration      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│              DATABASE + LLM PROVIDERS                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   SQLite    │  │  DeepSeek   │  │  OpenAI GPT-4o-mini │  │
│  │ (Native Pool) │  │  (Reasoner  │  │  (Vision/OCR)       │  │
│  │             │  │   + Chat)   │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
|-------|------------|
| **Backend API** | Axum (Rust), SQLx (Native SQLite pool) |
| **Frontends** | React 18, TypeScript, Vite |
| **Auth** | Native JWT + Google OAuth |
| **LLM (Text)** | DeepSeek Chat (deepseek-chat) for structured JSON output |
| **LLM (Vision)** | OpenAI GPT-4o-mini for receipt OCR/extraction |

Legacy FastAPI and Django code remain in the repository for reference, but the core stack is now Rust + standalone SPAs.

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+

### Repo Layout

- `rust-api/` - Native Rust API (primary backend)
- `apps/customer` - Customer React SPA
- `apps/admin` - Admin React SPA
- `apps/shared-ui` - Shared design system (theme + primitives)
- `backend/` - Legacy FastAPI service
- `legacy/` - Archived Django monolith + legacy frontend

Legacy archive details:
- `legacy/django` - Django project/apps, templates, static assets, and scripts
- `legacy/frontend` - Original multi-entry Vite frontend
- `legacy/db` - Local SQLite backup (if you keep one; ignored by git)
If you have a local `db.sqlite3`, copy it into `legacy/db/` to keep a private backup.

### Backend Setup (Rust)

```bash
# Clone the repository
git clone https://github.com/MikeNzmbh/Central-Books.git
cd Central-Books

# Navigate to rust-api
cd rust-api

# Configure environment
cp .env.example .env

# Run the API
cargo run
```

The API starts on `http://localhost:3001` with native Google OAuth support.

### Customer Frontend (Vite)

```bash
# Navigate to customer frontend directory
cd apps/customer

# Configure environment
cp .env.example .env

# Install dependencies
npm ci

# Start development server
npm run dev -- --port 5173

# Or build for production
npm run build
```

### Admin Frontend (Vite)

```bash
# Navigate to admin frontend directory
cd apps/admin

# Configure environment
cp .env.example .env

# Install dependencies
npm ci

# Start development server
npm run dev -- --port 5174

# Or build for production
npm run build
```

### Access the Application

- **Backend API**: http://localhost:3001/health
- **Customer app (dev)**: http://localhost:5173
- **Admin app (dev)**: http://localhost:5174

### Auth

- `POST /api/auth/login` accepts `email` + `password`.
- `GET /api/auth/google/login` initiates Google OAuth flow.
- Native JWT token management for secure sessions.

### Database & Migrations

- Default DB: SQLite at `legacy/db/db.sqlite3`.
- The Rust API uses **SQLx** for high-performance, asynchronous database access.

### Deployment Notes

- Set `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGINS` for the FastAPI service.
- Set `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none` in production when using HTTPS.
- Run `alembic upgrade head` during deploy before starting the API.
- Set `VITE_API_BASE_URL` for each SPA build (customer/admin).

### CI Guardrails

- `scripts/guardrails/check_separation.sh` fails CI if any Django/legacy imports appear in `backend/` or `apps/**`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

```bash
cp backend/.env.example backend/.env
```

Frontend env examples:

- `apps/customer/.env.example`
- `apps/admin/.env.example`

### Key Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite database path (default: `sqlite:../legacy/db/db.sqlite3`) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | Google OAuth Redirect URI (default: `http://localhost:3001/api/auth/google/callback`) |
| `VITE_API_BASE_URL` | Backend base URL for each Vite frontend |

> ⚠️ **Security**: Never commit secrets to the repository. All sensitive values are set via environment variables.

See `backend/.env.example` for the complete list.

---

## Deployment Mapping

- **Customer frontend**: Vercel -> `https://app.<domain>`
- **Admin frontend**: Vercel -> `https://admin.<domain>`
- **Backend API**: Rust API service (Render, Fly, etc.) -> `https://api.<domain>` or your backend URL

Recommended backend envs for cross-subdomain cookie auth:

- `COOKIE_DOMAIN=.<domain>`
- `COOKIE_SECURE=true`
- `CORS_ORIGINS=https://app.<domain>,https://admin.<domain>`

---

## AI / Safety Design

Clover Books follows a **"deterministic-first, LLM-optional"** architecture:

1. **Deterministic engine always runs first** – Rule-based checks (duplicates, outliers, balance validation) execute before any LLM call.

2. **LLM is best-effort, suggest-only** – If the LLM times out or fails, the system gracefully falls back to deterministic results.

3. **No auto-posting of transactions** – AI can suggest journal entries, but humans must approve before posting to the ledger.

4. **Structured JSON validation** – All LLM outputs go through Pydantic validation to prevent malformed or hallucinated data.

5. **Human-in-the-loop** – Critical actions (posting, deletion, status changes) require explicit user action.

6. **Separate providers for separate tasks**:
   - DeepSeek Chat: Text reasoning, insights, narratives
   - OpenAI GPT-4o-mini: Vision/OCR for receipt extraction

7. **Timeout and fallback handling** – Every LLM call has a timeout; failures never crash the application.

8. **Audit trail** – All runs, findings, and AI suggestions are logged with timestamps and trace IDs.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [System Architecture](docs/CloverBooks_Residency_System_Architecture.md) | Detailed technical architecture |
| [Product Brief](docs/PRODUCT_BRIEF.md) | Non-technical product overview |
| [AI Companion Brief](docs/AI_COMPANION_BRIEF.md) | AI stack and safety design |
| [Tax Engine v1 Blueprint](docs/tax_engine_v1_blueprint.md) | Canada + US tax engine architecture |
| [Demo Script](docs/RESIDENCY_DEMO_SCRIPT.md) | Step-by-step demo walkthrough |
| [Demo Data Notes](docs/DEMO_DATA_NOTES.md) | How demo data is set up |
| [Runbook](docs/RESIDENCY_RUNBOOK.md) | Testing and deployment notes |

---

## Residency Snapshot

This repository snapshot corresponds to the **AI Residency application** (December 2024).

- **Suggested tag**: `v0.1-residency`
- **Core features**: Receipts AI, Invoices, Banking, Books Review, Bank Review, AI Companion
- **AI stack**: DeepSeek Chat + OpenAI GPT-4o-mini
- **Safety architecture**: Deterministic-first, human-in-the-loop

To create the snapshot tag:
```bash
git tag -a v0.1-residency -m "AI Residency submission snapshot"
git push origin v0.1-residency
```

---

## License

Proprietary – All rights reserved.

---

*Built with ❤️ for small businesses everywhere.*
