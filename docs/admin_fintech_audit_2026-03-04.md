# Fintech-Grade Admin Deep Audit (Dual Codepaths)

Date: 2026-03-04  
Scope: `apps/admin`, `apps/customer/src/admin`, backend parity across `rust-api`, `apps/api`, `backend-nest`, `backend/app`, `cloverbooks-backend`  
Mode: Read-only evidence audit (no frontend implementation changes in this audit step)

## Executive Summary

The admin surface is visually rich and operationally broad, but it is not yet fintech-grade from a control-plane perspective. The top gap is backend contract parity: both admin frontends call an extensive `/api/admin/*` contract that is largely absent from active backends. This creates a high risk posture where critical controls appear present in UI but are not system-enforced server-side.

A second major risk is dual-codepath drift: two admin implementations exist with meaningful divergence in auth model, base routing, API wrappers, and feature scope. One path (`apps/customer/src/admin`) is additionally excluded from customer TS compile, making ownership and runtime truth ambiguous.

The test suites provide useful UI confidence but are heavily mocked and do not validate end-to-end backend parity, RBAC boundaries, maker-checker invariants, or impersonation safety guarantees.

Overall maturity is **1.55 / 5** against fintech-grade admin control standards.

## Method

1. Inventory routes/components/API calls in both admin frontends.
2. Build backend parity matrix against registered routes/controllers.
3. Inspect auth, role-gating, maker-checker, impersonation, and audit data paths.
4. Evaluate code health (drift, dead code, stubs).
5. Run admin tests in both codepaths and assess contract rigor.

## Audit Anchors (Confirmed)

1. Admin frontend expects broad `/api/admin/*` coverage, but backend parity is largely missing.
2. Admin code is duplicated across two frontends with drift.
3. Some admin sections are static/stubbed or locally simulated.
4. Test suite passes are largely mock-based and not contract-parity validating.

## Evidence Highlights

### 1) Backend parity gap for `/api/admin/*` is critical

- Admin clients define base admin namespace:
  - `apps/admin/src/admin/api.ts` (`const BASE = "/api/admin/";`)
  - `apps/customer/src/admin/api.ts` (`const BASE = "/api/admin/";`)
- Backend scans found no `/api/admin/*` registrations in:
  - `rust-api/src/main.rs`
  - `apps/api/src/*`
  - `backend-nest/src/*`
  - `backend/app/main.py`
  - `cloverbooks-backend/src/*`
- Nest controller inventory has auth/org/payments/webhooks/health but no admin controller namespace.

### 2) Dual frontend admin codepaths are real and drifted

Compared directories:
- `apps/admin/src/admin/*`
- `apps/customer/src/admin/*`

Hash comparison summary:
- `IDENTICAL: 13`
- `DIFF: 10`
- `ONLY_APPS_ADMIN: 1` (`AutonomySection.tsx`)

Large drift points:
- `AdminApp.tsx`
- `api.ts`
- `InternalAdminLogin.tsx`
- `InviteRedeemPage.tsx`
- `OverviewSection.tsx`
- `UsersSection.tsx`
- `EmployeesSection.tsx`

### 3) Runtime ambiguity in customer admin path

- `apps/customer/src/admin.tsx` exists and mounts admin root, but:
  - `apps/customer/index.html` only mounts `src/main.tsx` (`#root`)
  - `apps/customer/tsconfig.json` excludes `src/admin/**/*` and `src/admin.tsx`
- This indicates the duplicate customer-admin path is not first-class in customer build pipeline.

### 4) Control quality issues in privileged flows

- Maker-checker and sensitive actions rely on browser prompts/alerts in places:
  - `window.prompt`, `window.confirm`, `window.alert` in approvals/users/workspaces/feature flags flows.
- Self-approval prevention is not explicitly enforced in client logic.
- Break-glass TTL constraints are messaged in UI but not strongly client-enforced.
- Impersonation flow is redirect-based with reason prompt, but backend parity for `/api/admin/impersonations/` is missing.

### 5) Static/stub behavior in admin runtime surfaces

- Inline `mockFlags` and inline `FeatureFlagsSection` in `AdminApp.tsx`.
- Static AI monitoring and settings cards with non-wired action buttons.
- Placeholder copy in workspace details ("coming soon", dash metrics).
- `Workspace360Section.tsx` exists but has no runtime import usage.
- Standalone `FeatureFlagsSection.tsx` exists and is tested, but runtime app uses a different inline section.

### 6) Tests are not backend parity tests

- `apps/admin` tests: pass (18 tests), but with mocked API modules and known DOM prop warning.
- `apps/customer` admin tests: fail one suite due `localStorage.getItem is not a function` path; same prop warning.
- Test patterns heavily use `vi.mock("./api", ...)`, validating UI logic not backend contract truth.

## Endpoint Surface Matrix

Status model:
- `implemented`: backed by reachable backend route with expected semantics
- `partial`: nearby route exists but namespace/contract mismatch
- `missing`: no backend route found
- `frontend-only`: defined in frontend client but not found in backend route map

| Domain | Frontend Route Family | Status | Notes |
|---|---|---|---|
| Overview | `/api/admin/overview-metrics/` | frontend-only | No backend admin route found |
| Ops Center | `/api/admin/operations-overview/` | frontend-only | Overview section calls it directly |
| Users | `/api/admin/users/`, `/api/admin/users/:id/`, `/reset-password/` | frontend-only | No admin backend parity |
| Employees | `/api/admin/employees/*` | frontend-only | No admin backend parity |
| Workspaces | `/api/admin/workspaces/*` | frontend-only | No admin backend parity |
| Workspace360 | `/api/admin/workspaces/:id/overview/` | frontend-only | Doc-claimed legacy path not implemented in active backend |
| Banking | `/api/admin/bank-accounts/` | partial | Non-admin `/api/bank-accounts*` exists in rust |
| Audit | `/api/admin/audit-log/` | frontend-only | No admin backend parity |
| Support | `/api/admin/support-tickets/*` | frontend-only | No admin backend parity |
| Flags | `/api/admin/feature-flags/*` | frontend-only | No admin backend parity |
| Approvals | `/api/admin/approvals/*` | frontend-only | No admin backend parity |
| Impersonation | `/api/admin/impersonations/` | frontend-only | No admin backend parity |
| Reconciliation metrics | `/api/admin/reconciliation-metrics/` | frontend-only | No admin backend parity |
| Ledger health | `/api/admin/ledger-health/` | frontend-only | No admin backend parity |
| Invoices audit | `/api/admin/invoices-audit/` | frontend-only | No admin backend parity |
| Expenses audit | `/api/admin/expenses-audit/` | frontend-only | No admin backend parity |
| Invite redeem | `/api/admin/invite/:token/` | frontend-only | Used by both invite pages |
| Autonomy controls (`apps/admin` only) | `/api/companion/cockpit/*`, `/api/companion/autonomy/*` | implemented | Rust routes exist |

## Drift Report (Dual Codepaths)

### Consolidation priority A (high-risk drift)

1. `api.ts`  
   - `apps/admin` includes autonomy methods + bearer flow integration differences.
   - `apps/customer` path omits autonomy and uses different auth/csrf assumptions.

2. `AdminRoutes.tsx`  
   - `apps/customer` uses `basename="/internal-admin"`.
   - `apps/admin` uses root routing.

3. `InternalAdminLogin.tsx`  
   - Different login endpoint patterns, credential flow, redirect behavior.

4. `AdminApp.tsx`  
   - Feature scope differences (Autonomy present in `apps/admin` only), route alias behavior differs.

### Consolidation priority B (medium drift)

5. `InviteRedeemPage.tsx`  
   - URL normalization and credential details differ.

6. `OverviewSection.tsx`  
   - Base URL construction differences (`buildApiUrl` vs raw path).

7. `UsersSection.tsx` / `EmployeesSection.tsx`  
   - Smaller deltas but maintainability risk under duplicate ownership.

### Consolidation priority C (cleanup)

8. Unused / duplicate sections (`Workspace360Section`, standalone `FeatureFlagsSection` runtime mismatch).

## Maturity Scorecard (0-5)

| Domain | Score | Severity | Confidence | Evidence |
|---|---:|---|---:|---|
| Identity/Auth | 1.0 | P0 | 0.90 | Auth contract mismatch across admin clients/backend |
| RBAC/Authorization | 1.0 | P0 | 0.90 | Frontend role-gating; missing server-side admin namespace |
| Approvals/Maker-Checker | 1.5 | P0 | 0.85 | UI workflow exists; backend invariant enforcement not canonical |
| Impersonation Safety | 0.5 | P0 | 0.80 | Frontend flow exists; backend parity route missing |
| Audit Logs/Forensics | 1.5 | P1 | 0.85 | UI reads expected shape; backend admin event model missing |
| Workspace Ops | 2.0 | P1 | 0.80 | Rich UI, backend admin data contracts missing |
| Support Ops | 2.5 | P2 | 0.75 | Good operator UX patterns but contract parity gap |
| Autonomy/Ops Controls | 3.0 | P2 | 0.75 | Rust-backed cockpit/autonomy exists (apps/admin path only) |
| Data Governance | 1.0 | P0 | 0.80 | No canonical admin forensic schema/contract ownership |
| Testability | 1.5 | P1 | 0.90 | High mock reliance; low contract/invariant coverage |

Overall: **1.55 / 5**

## Prioritized Findings

### P0 (critical)

1. Missing canonical backend admin API owner and route parity.
2. Frontend-only RBAC assumptions without admin backend enforcement layer.
3. Maker-checker invariants not decision-complete (self-approval prevention, expiry governance, required reasons).
4. Impersonation safety contract not fully implemented server-side.

### P1 (high operational risk)

5. Dual-codepath drift creates unpredictable operator behavior and weakens control confidence.
6. Forensics-grade audit schema and export chain not canonicalized in backend.
7. Test suites miss backend parity and negative authorization testing.

### P2/P3 (quality/debt)

8. Static/stub sections intermixed with production surfaces.
9. Dead/non-active admin code paths and duplicated component stacks.
10. Browser prompt/alert flows in privileged operations degrade reliability and audit quality.

## Canonical Architecture Decision Package

1. Canonical admin frontend path: `apps/admin`.
2. Canonical admin backend owner: `rust-api` under `/api/admin/*` (versioned contract).
3. Compatibility policy:
   - Preserve temporary aliases during migration window.
   - Publish deprecation schedule and deterministic error envelopes.
4. Non-negotiable controls:
   - Server-side RBAC enforcement.
   - Immutable admin audit event model with required forensic fields.
   - Maker-checker invariants: dual control, self-approval prevention, expiry, mandatory reasons.
   - Break-glass constraints: reason, TTL cap, complete traceability.

## 90-Day Remediation Roadmap

### Phase 1 (Days 0-30, P0)

1. Publish canonical admin API contract and ownership map.
2. Implement server-side admin admission + RBAC matrix.
3. Implement maker-checker core invariants in backend.
4. Implement impersonation safety contract (reason, scope, TTL, trace).

Deliverables:
- Contract document + endpoint parity baseline tests.
- Admin authz middleware/guards in canonical backend.
- Approval and impersonation server workflows with immutable audit events.

### Phase 2 (Days 31-60, P1)

1. Close endpoint parity for critical admin sections.
2. Harden audit forensics: export, pagination determinism, filter integrity.
3. Operational reliability hardening for queues, triage, and incident workflows.

Deliverables:
- `/api/admin/*` parity suite for users/workspaces/employees/support/approvals/audit/flags.
- Forensic completeness tests and incident runbook validation.

### Phase 3 (Days 61-90, P2/P3)

1. Remove duplicate/dead admin path and consolidate UI codepath.
2. Replace brittle prompt/alert mutation patterns with deterministic control UX.
3. Improve operator ergonomics and automation hooks.

Deliverables:
- One admin frontend path in production.
- Removed unused admin modules and duplicated wrappers.
- CI gates for parity + RBAC + maker-checker + impersonation invariants.

## Test Program (Target)

1. Endpoint parity tests for all frontend-referenced admin endpoints.
2. RBAC boundary tests (positive/negative, escalation attempts).
3. Maker-checker lifecycle tests (create/approve/reject/expire/self-approval prevention/break-glass).
4. Impersonation safety tests (reason, scope, TTL, termination trace).
5. Audit log integrity tests (who/what/when/where/why, request IDs, export integrity).
6. Dual-codepath parity tests until consolidation completes.

## Appendix: Notable Evidence Locations

- Admin route/client surfaces:
  - `apps/admin/src/admin/AdminApp.tsx`
  - `apps/admin/src/admin/api.ts`
  - `apps/customer/src/admin/AdminApp.tsx`
  - `apps/customer/src/admin/api.ts`
- Backend route ownership scans:
  - `rust-api/src/main.rs`
  - `apps/api/src/app.module.ts`
  - `backend-nest/src/app.module.ts`
  - `backend/app/main.py`
- Docs claiming internal-admin endpoints not found in active backends:
  - `docs/internal_admin_architecture_phase1.md`
  - `docs/internal_admin_phase1_changelog.md`

## Phase Sunset Instruction

Once Phase 1, Phase 2, and Phase 3 are fully completed and validated, delete all temporary transition code introduced for the phased rollout.

Required cleanup at phase completion:
- Remove compatibility aliases and interim fallback paths.
- Remove duplicate/non-canonical admin codepaths and dead admin sections.
- Keep only the canonical admin frontend (`apps/admin`) and canonical backend admin contract (`/api/admin/*`).
