# COA QBO Gap Review (2026-02-10)

## Live Clover snapshot (re-verified)

Source DB: `backend/cloverbooks.db`

- Businesses: `19`
- Account type counts:
  - `ASSET`: `53`
  - `LIABILITY`: `40`
  - `INCOME`: `15`
  - `EXPENSE`: `16`
  - `EQUITY`: `0`
- Businesses missing `EQUITY`: `19/19`
- Businesses missing `INCOME` or `EXPENSE`: `7/19`
- Businesses with empty chart: `0/19`

## Code reality in Clover

- Canonical SQLAlchemy account model (`accounts`) is minimal:
  - `id, business_id, code, name, type, parent_id, is_active, description, legacy_id`
  - file: `backend/app/models.py`
- COA list API reads from `accounts` first, then falls back to `core_account`:
  - file: `rust-api/src/routes/dashboard.rs`
- Chart of Accounts UI is fed by static QBO-like payload:
  - `apps/customer/src/coa/qboDefaultCoa.ts`
  - wired in `apps/customer/src/App.tsx`
- Legacy Rust DB query layer still reads `core_account` and expects fields not in `accounts` (`is_favorite`, `is_suspense`):
  - `rust-api/src/db/queries.rs`
  - `rust-api/src/db/models.rs`
- Reconciliation endpoints are still stubbed responses:
  - `rust-api/src/routes/reconciliation.rs`

## QBO baseline (official references)

- QBO uses a default chart of accounts and supports account numbering (optional).
- QBO has special/default accounts (some cannot be deleted/deactivated).
- QBO account model includes `AccountType`, `AccountSubType`, and `Classification`.
- QBO has explicit workflows for bank feed failures, missing transactions, and reconciliation discrepancy recovery.

References:
- https://quickbooks.intuit.com/learn-support/en-us/help-article/chart-accounts/learn-chart-accounts-quickbooks-online/L5w6C4CtM_US_en_US
- https://quickbooks.intuit.com/learn-support/en-us/help-article/chart-accounts/manage-default-special-accounts-chart-accounts/L5Rq6W6pw_US_en_US
- https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account
- https://quickbooks.intuit.com/learn-support/en-us/help-article/bank-errors/fix-bank-errors-390-1000-102-105/L0wppjsTs_US_en_US
- https://quickbooks.intuit.com/learn-support/en-us/help-article/reconciliation/fix-issues-reconciled-accounts-quickbooks-online/L9qA7w3Aa_US_en_US
- https://quickbooks.intuit.com/learn-support/en-us/help-article/bank-transactions/missing-transactions-quickbooks-online/L4h4NfWn0_US_en_US

## Missed points vs QBO (current gaps)

### P0 (must close)

- Persistent equity layer is missing in production data (`EQUITY=0`), while QBO-style closing/reporting assumes equity accounts.
- Account schema lacks `AccountSubType`/`detail type` and `Classification` at the DB/API level; this blocks true QBO parity.
- COA architecture is split:
  - UI uses static template payload.
  - backend has live `accounts`.
  - other Rust query paths still depend on `core_account`.

### P1 (important)

- No system/special-account protections (QBO-style guardrails for protected accounts).
- Account-number settings and governance are not modeled as first-class behavior.
- Reconciliation is not production-grade yet (stubs), so QBO-level discrepancy and history workflows are not met.

### P2 (nice to have)

- Add parity fields for richer downstream reporting and external sync mapping:
  - `fully_qualified_name`, normal balance side, tax-line mapping, close-lock metadata.

## Accountant blocker map (QBO pain points to design for)

- Bank connection and credential errors.
  - Need explicit diagnostic states, guided repair, and retry tracking.
- Missing downloaded bank transactions.
  - Need import observability and idempotent replay tooling.
- Reconciliation discrepancies after prior reconciliations.
  - Need durable reconciliation history, drift detection, and safe adjustment workflows.
- Managing protected/default accounts safely during cleanup.
  - Need immutable-system-account policy with controlled archive behavior.

## Recommended next implementation step

1. Add a DB migration that introduces QBO-parity account metadata (`detail_type`, `classification`, `system_account_kind`, optional `account_number`) and backfills equity baseline for all businesses.
2. Switch Chart of Accounts page boot data from static payload to live API payload.
3. Remove remaining `core_account` dependencies in Rust DB query helpers.
4. Replace reconciliation stubs with persisted session/match/adjustment records and discrepancy analytics.
