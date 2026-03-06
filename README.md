# Rings Accounting OS

Rings Accounting OS is a full-stack accounting platform for modern operators that want autonomous bookkeeping speed without giving up deterministic controls.

This repository combines:
- A production-facing customer workspace for bookkeeping, close operations, and tax operations.
- A Companion Control Tower that turns accounting operations into explainable queues and guided actions.
- A deep internal admin surface for support, approvals, governance, and platform operations.
- Multiple backend runtimes (Rust-first and Nest services) being consolidated toward a single contract-first platform shape.

## Why This Exists

Finance teams are overloaded by fragmented workflows: transaction cleanup, reconciliation, close readiness, tax anomaly triage, and audit follow-through all happen in different tools.

Rings compresses this into one operating surface:
- deterministic accounting primitives
- explainable AI guidance
- queue-based execution with approvals
- audit-first system records

The product thesis: every finance workflow should be observable, reviewable, and safely automatable.

## Product Surface

### Customer Workspace

Core capabilities live in the customer SPA:
- Auth and onboarding: login, signup, OAuth callback, guided onboarding journey.
- Command-center dashboard: KPI cards, outstanding work indicators, and trend context.
- Sales ledger workflows: invoices, invoice lists, customer management, product catalog, categories.
- Spend workflows: expenses, suppliers, transaction views, journal surfaces.
- Banking operations: account/feed views, import surfaces, review actions.
- Reconciliation operations: period sessions, match workflow, adjustment/reopen/complete flows, report views.
- Reporting: profit and loss, cashflow, printable reporting mode.
- Controls and settings: chart of accounts, account settings, role settings, team management.
- AI surfaces: Control Tower, issues/proposals pages, tax operations pages, agentic console, receipts AI demo.

### Companion Control Tower

The Control Tower is the operating layer on top of books data and autonomy state:
- Health pulse and close-readiness telemetry.
- Finance snapshot blocks (cash posture, burn/runway, revenue-expense shape).
- Issues and suggestions side panels with customer-safe copy.
- Engine status and queue depth visibility.
- Guided batch apply for low-risk actions.
- Explainable rationale and trust/safety framing.

### Admin Operations Surface

The admin SPA includes internal-only controls for platform teams:
- Overview KPIs and fleet-wide health checks.
- Employee and user operations.
- Support queue and approvals workflows.
- Workspace operations and banking/reconciliation diagnostics.
- Ledger and invoice/expense audits.
- Autonomy oversight and AI monitoring surfaces.
- Feature flags, settings, and audit-log visibility.

## Feature Matrix

| Domain | Capability | Status |
| :--- | :--- | :--- |
| Identity | Auth, session checks, OAuth callback | Implemented |
| Onboarding | Profile capture, consent flows, event logging | Implemented |
| Accounting Core | Journal entries, chart of accounts, transactions views | Implemented |
| Sales Ops | Invoices, customers, products, categories | Implemented |
| Spend Ops | Expenses, suppliers, categorization surfaces | Implemented |
| Banking | Feed review, matching, duplicate checks, allocation workflows | Implemented |
| Reconciliation | Account-period sessions, confirm/add/exclude/unmatch, completion lifecycle | Implemented |
| Reporting | P&L, cashflow, print output | Implemented |
| Tax Ops | Period snapshots, anomaly queues, status transitions, enrichment hooks | Implemented (mutation controls in transition) |
| Companion Core | Issues, audits, radar, proposals/shadow events | Implemented |
| Autonomy Engine | Work items, approvals, action recommendations, queue snapshots, cockpit endpoints | Implemented |
| Agentic Docs | Invoice/receipt runs with review decisions | Implemented |
| Admin Governance | Approvals, audit log, feature controls, internal diagnostics | Implemented in UI, backend parity in progress |
| Provenance + Integrity Reports | Deep provenance API + integrity reporting endpoints | In progress |
| Backend Consolidation | Unified contract ownership across runtimes | In progress |

## Architecture

### Runtime Topology

- `rust-api`: broad API coverage for customer, companion, autonomy, reconciliation, onboarding, and tax operations.
- `apps/api`: Nest service with auth/org/notifications and compatibility endpoints retained during backend consolidation.
- `backend-nest`: Nest service with compatibility endpoints retained while domain ownership converges.
- `cloverbooks-backend` and `backend` (legacy): retained for migration continuity and reference behavior.

### Control Plane Model

Companion autonomy uses persisted records, not ephemeral bus messages:
- work items
- recommendations
- approvals
- rationale cards
- evidence/claims
- agent runs/jobs
- queue snapshots
- audit logs

This makes every AI-assisted action traceable and replay-friendly.

### Safety Model

- Risk tiers are amount-based and policy-configurable.
- Approval gates apply based on risk and policy thresholds.
- Circuit-breaker events influence engine mode.
- Budgets/allowlists constrain model and tool usage.
- Customer-safe language normalization is enforced before UI exposure.

## API Surface (Representative)

### Companion + Autonomy
- `/api/companion/issues`
- `/api/companion/audits`
- `/api/companion/radar`
- `/api/companion/v2/shadow-events/`
- `/api/companion/v2/proposals/`
- `/api/companion/autonomy/*`
- `/api/companion/cockpit/*`

### Agentic Surfaces
- `/api/agentic/companion/*`
- `/api/agentic/invoices/*`
- `/api/agentic/receipts/*`

### Accounting + Banking + Reconciliation
- `/api/dashboard`
- `/api/invoices*`
- `/api/expenses*`
- `/api/customers*`
- `/api/suppliers*`
- `/api/products*`
- `/api/categories*`
- `/api/banking/*`
- `/api/reconciliation/*`

### Tax Operations
- `/api/tax/periods/*`

## Monorepo Map

- `apps/customer`: customer-facing product app.
- `apps/admin`: internal operations app.
- `apps/api`: Nest backend service.
- `rust-api`: Rust backend service.
- `backend-nest`: Nest backend service (compatibility and migration path).
- `cloverbooks-backend`, `backend`: legacy backends retained during consolidation.
- `docs`: architecture notes, runbooks, audits, and blueprints.
- `prisma`, `backend-nest/prisma`: service-specific database schema and migrations.

## What Is Next

Near-term execution priorities:
1. Finalize backend ownership by domain and remove contract drift.
2. Complete admin backend parity for internal routes used by the admin SPA.
3. Ship provenance and integrity reporting endpoints as first-class API capabilities.
4. Expand regression fixtures for agent outputs, rationale quality, and queue behavior.
5. Continue hardening route-parity checks as CI gates.

## Build and Run

### Rust API
```bash
cd rust-api
cargo run
```

### Nest API (`apps/api`)
```bash
cd apps/api
npm install
npm run start:dev
```

### Nest API (`backend-nest`)
```bash
cd backend-nest
npm install
npm run start:dev
```

### Customer App
```bash
cd apps/customer
npm install
npm run dev
```

### Admin App
```bash
cd apps/admin
npm install
npm run dev
```

### Frontend Quality Gates (Local)
```bash
cd apps/customer
npm run lint
npm run typecheck
npm run test:run
npm run build

cd ../admin
npm run lint
npm run typecheck
npm run test:run
npm run build
```

### Local Production-Like Preview
Run these after `rust-api` is running on `http://localhost:3001` and set `VITE_API_BASE_URL=http://localhost:3001`.

```bash
cd apps/customer
npm run build
npm run preview:prod
```

```bash
cd apps/admin
npm run build
npm run preview:prod
```

## Positioning

Rings is building the accounting operating system for AI-native finance teams:
- deterministic core ledger behavior
- autonomous issue detection and recommendation pipelines
- policy-aware execution rails
- audit-grade explainability from signal to action

It is designed to become the default control plane for close operations in software-native businesses.
