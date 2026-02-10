---
description: Option B Architecture - Rust API + Vite React apps with Clean As You Go
---

# Option B Architecture Mode

> **AUTOMATIC**: This architecture is applied to all features and bugfixes unless explicitly overridden.
> Every touched surface should move one step closer to this target.

## Core Principles
- **Rust-first backend**: `rust-api` (Axum + SQLx) is the primary `/api/...` service on port `3001`.
- **React-first frontend**: `apps/customer` and `apps/admin` are Vite SPAs that call API routes.
- **API over templates**: no Django template-driven UI flow for active product surfaces.
- **Compatibility-first migration**: keep legacy route aliases and payload shapes stable unless intentionally versioned.

---

## When Touching API Endpoints (`/api/...`)

1. **Treat `rust-api` as default home**
   - Add or update handlers in `rust-api/src/routes/*`.
   - Register routes in `rust-api/src/main.rs`.
   - If work is in `apps/api` or `backend`, document why that service still owns the endpoint.

2. **Return explicit JSON contracts**
   - Success responses should be JSON with clear fields.
   - Error responses should be JSON with a usable message (`error`, `detail`, or `message`).
   - Use correct HTTP status codes; do not hide failures behind `200`.

3. **Preserve working clients**
   - Keep existing trailing-slash aliases where clients already depend on them.
   - Avoid breaking auth and session behavior (`Authorization` bearer + cookie-aware flows).
   - Known exception: OAuth callback flows may return HTML redirect pages by design.

4. **Use real persistence paths**
   - Query via SQLx and wrap multi-step writes in transactions.
   - Keep `DATABASE_URL` compatibility (default SQLite path is still used in local/dev).
   - Remove stubs only when replacing them with a complete path.

---

## When Touching UI Surfaces (`apps/customer`, `apps/admin`)

1. **Keep SPA routing patterns**
   - Add routes in `apps/customer/src/App.tsx` (or admin router equivalents).
   - Lazy-load heavy pages with `React.lazy`.
   - Keep route pages thin and feature logic colocated.

2. **Use shared API client patterns**
   - Build URLs through `buildApiUrl` helpers.
   - Use shared fetch wrappers that handle auth headers and credentials.
   - Parse API failures defensively (`detail`/`error`/`message`, non-JSON fallback).

3. **No template-era reintroduction**
   - Do not add server-rendered Django templates for customer/admin UX.
   - Do not pass large page data blobs through HTML injection patterns.
   - Keep data flow API-driven and typed at the feature boundary.

---

## "Clean As You Go" Checklist

For each change:

- [ ] Identify the owning surface: `rust-api`, `apps/customer`, `apps/admin`, or legacy service
- [ ] If API is touched:
  - [ ] Route is defined in the correct service and wired in router/bootstrap
  - [ ] Response and error contracts are JSON and status-aware
  - [ ] Backward compatibility (aliases/payload shape/auth flow) is preserved
- [ ] If UI is touched:
  - [ ] Route/component follows current SPA structure
  - [ ] API calls use shared client utilities
  - [ ] Loading/error/empty states are handled explicitly
- [ ] Remove stale Django/template-era references when touching migrated paths

---

## Safety Rules

- Do not remove working behavior without a replacement path.
- Prefer extending `rust-api` for new customer-facing `/api` work.
- Keep contract changes additive unless coordinated with client updates.
- Scope cleanup to touched surfaces; avoid big-bang rewrites.
