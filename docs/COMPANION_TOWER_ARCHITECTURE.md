# Companion Control Tower — Architecture & Specification

> **Last updated:** 2026-02-09
> **Status:** Living document — update whenever the tower surface changes.

---

## 1. What Is the Companion Control Tower?

The Companion Control Tower is the **single command-centre page** for the AI Companion inside Clover Books. It is a full-stack, self-contained subsystem that sits inside the customer-facing accounting application. Think of it as "an autonomous accounting co-pilot dashboard inside an accounting engine".

It aggregates data from **every** accounting surface (Banking, Invoices, Receipts, Books Review) and overlays AI-powered suggestions, issues, health scores, financial snapshots, tax monitoring, and an autonomy engine — all presented in customer-safe language.

**Route:** `/companion`
**Legacy route:** `/ai-companion/*` (redirects to `/companion`)

---

## 2. What It Does (Feature Inventory)

### 2.1 Voice & Greeting (Hero Section)
- Displays an AI-generated greeting with tone awareness
- Shows the current **focus mode**: `all_clear`, `watchlist`, or `fire_drill`
- Provides the AI's **best next step** call-to-action
- Contains a "Ask Companion" natural-language search bar

### 2.2 Health Pulse (Radar)
- Four-axis health radar chart: Cash Reconciliation, Revenue/Invoices, Expenses/Receipts, Tax Compliance
- Each axis has a score (0-100) and open issue count
- Overall health score badge
- One-click drill into the Issues panel

### 2.3 Close Readiness
- Period-aware close status: `ready` or `not_ready`
- Progress bar (percentage)
- Blockers list with severity and surface tags
- Opens the Close Assistant drawer panel

### 2.4 Today's Focus (Playbook)
- Prioritized action items from the AI playbook
- Each item has severity, surface, description, and optional premium badge
- Links to the Suggestions panel

### 2.5 Surfaces Grid
- Four surface cards: Banking, Invoices, Receipts, Books Review
- Each card shows: coverage %, suggestion count, issue count, AI subtitle, progress bar
- Click-through to filtered Suggestions or Issues panels

### 2.6 Finance Snapshot
- Ending cash, monthly burn, runway months
- Revenue vs. Expense area chart (monthly)
- Accounts Receivable bar chart by aging bucket
- Total overdue badge

### 2.7 Tax Guardian
- Period key label
- Net tax by jurisdiction
- Anomaly counts by severity (low/medium/high)
- Link to Tax Guardian sub-pages

### 2.8 Autonomy Engine Queue
- Engine mode display (autopilot_limited, drafts, offline, etc.)
- Freshness indicator (fresh/stale)
- Queue totals: Queued, Running, Blocked
- Action totals: Ready, Needs attention, Waiting approval
- Applied (24h) and Breaker events (24h)
- Trust score percentage
- Opens Engine Queue panel

### 2.9 Trust & Safety Card
- Safe mode toggle display
- Policy rows: high-value changes (always confirm), tax calculations (deterministic)

### 2.10 Right-Side Panels (Drawers)
Four slide-in panels opened via query parameters (`?panel=`):

| Panel Key     | Component             | Description                                      |
|---------------|-----------------------|--------------------------------------------------|
| `suggestions` | `SuggestionsPanel`    | AI suggestions with apply/dismiss/review actions |
| `issues`      | `IssuesPanel`         | Open issues sorted by severity                   |
| `close`       | `CloseAssistantDrawer`| Close readiness blocker list with actions         |
| `engine`      | `EngineQueuePanel`    | Autonomy engine queue with batch apply controls   |

---

## 3. API Contracts (Backend — Do Not Change)

### 3.1 Summary API
```
GET /api/agentic/companion/summary
```
Returns: `voice`, `radar`, `coverage`, `playbook`, `close_readiness`, `llm_subtitles`, `finance_snapshot`, `tax` / `tax_guardian`

### 3.2 Issues API
```
GET /api/agentic/companion/issues?status=open
```
Returns: `{ issues: [...] }` — each with `id`, `surface`, `title`, `severity`, `recommended_action`, `estimated_impact`, `target_url`

### 3.3 Proposals / Shadow Events API
```
GET /api/companion/v2/shadow-events/?status=proposed&limit=50&workspace_id=N
POST /api/companion/v2/shadow-events/:id/apply/   { workspace_id }
POST /api/companion/v2/shadow-events/:id/reject/  { workspace_id, reason }
```

### 3.4 Cockpit Queues API
```
GET /api/companion/cockpit/queues
```
Returns: `{ source, stale, data: { generated_at, mode, trust_score, stats, ready_queue, needs_attention_queue, job_totals, job_by_agent, top_blockers } }`

### 3.5 Cockpit Status API
```
GET /api/companion/cockpit/status
```
Returns: `{ ok, tenant_id, mode, breakers, budgets, last_tick_at, engine_version, mock_mode }`

### 3.6 Engine Batch Apply
```
POST /api/companion/autonomy/actions/batch-apply  { action_ids: number[] }
```

---

## 4. Component Architecture (Current State)

### 4.1 File Map

| File | Lines | Role |
|------|-------|------|
| `CompanionControlTowerPage.tsx` | ~1765 | **Monolith** — contains the main page, all cards, all sub-components, all API functions, all types |
| `companion-overview-entry.tsx` | ~110 | Legacy entry point (Django mount for `/ai-companion`) |
| `PanelShell.tsx` | ~106 | Animated right-side drawer shell (framer-motion) |
| `SuggestionsPanel.tsx` | ~610 | AI suggestions list with apply/dismiss dialogs |
| `IssuesPanel.tsx` | ~141 | Issues list sorted by severity |
| `CloseAssistantDrawer.tsx` | ~145 | Close readiness blocker display |
| `companionCopy.ts` | ~181 | Customer-safe term mapping and label utilities |
| `companionAutonomyApi.ts` | ~153 | Typed API client for engine cockpit endpoints |

### 4.2 Data Flow
```
User navigates to /companion
  → React Router lazy-loads CompanionControlTowerPage
    → usePermissions() reads workspace from AuthContext
    → useEffect fires 5 parallel API calls:
        1. fetchSummaryApi()           → /api/agentic/companion/summary
        2. fetchProposalsApi(bizId)    → /api/companion/v2/shadow-events/
        3. fetchIssuesApi()            → /api/agentic/companion/issues
        4. fetchCockpitQueues()        → /api/companion/cockpit/queues
        5. fetchCockpitStatus()        → /api/companion/cockpit/status
    → Results set into state → page renders
    → Panel open/close managed via URL search params (?panel=X&surface=Y&agent=Z)
```

---

## 5. Known Issues & Bugs

### 5.1 CRITICAL: No Error State
When the summary API fails, `summary` stays `null` and `loading` becomes `false`. The render logic:
```tsx
{loading || !summary ? <SkeletonBoard /> : <MainContent />}
```
This means the user sees an **infinite skeleton with no error message and no retry button**. This is the primary reason the page "won't load" — there is zero feedback when APIs are unreachable.

### 5.2 Workspace ID Can Be Undefined
`workspace?.businessId` may be `undefined` during auth hydration. The proposals API silently returns `[]` when `workspaceId` is falsy, but provides no user feedback.

### 5.3 Monolith Component
The main page file is ~1765 lines containing:
- 15+ inline sub-components
- 10+ type definitions
- 8+ helper functions
- 3 API fetch functions
- All wired together in a single file

This makes debugging, testing, and iterating extremely difficult.

### 5.4 Design Inconsistency
- Main page uses zinc/white/neutral palette
- Panels use warm lux palette (`#e8decf`, `#fdfbf7`, etc.)
- PanelShell uses a third palette (`#2b2117` backdrop)
- No unified design system

### 5.5 No Retry / Reconnect
If any API call fails, there is no automatic retry or manual retry button. The only option is a manual page reload.

### 5.6 Panel State Lost on Refresh
Panel state is managed via URL search params (good), but refreshing the data resets internal component state.

---

## 6. Sub-Pages (Separate Routes)

| Route | Component | Description |
|-------|-----------|-------------|
| `/companion` | `CompanionControlTowerPage` | Main tower page |
| `/companion/overview` | `CompanionOverviewPage` | Overview variant |
| `/companion/issues` | `CompanionIssuesPage` | Full-page issues view |
| `/companion/proposals` | `CompanionProposalsPage` | Full-page proposals view |
| `/companion/tax` | `TaxGuardianPage` | Tax guardian dashboard |
| `/companion/tax/catalog` | `TaxCatalogPage` | Tax catalog |
| `/companion/tax/product-rules` | `TaxProductRulesPage` | Product tax rules |
| `/companion/tax/settings` | `TaxSettingsPage` | Tax settings |

---

## 7. Customer-Safe Copy System

The `companionCopy.ts` module transforms internal accounting terminology to customer-safe language:

| Internal Term | Customer-Safe Term |
|---------------|-------------------|
| journal entry | change to your books |
| proposal | AI suggestion |
| shadow ledger | AI suggestions |
| shadow event | suggested change |
| canonical ledger | your books |
| reconciliation | matching |
| anomaly | issue |
| debit | increase |
| credit | decrease |

---

## 8. Technology Stack

- **Framework:** React 18.3.1 + TypeScript
- **Build:** Vite 5
- **Router:** React Router DOM 7.9.6
- **Charts:** Recharts 3.6.0
- **Animation:** Framer Motion 12.x
- **Icons:** Lucide React 0.554.0
- **UI Components:** shadcn/ui (Button, Card, Badge, Progress, Dialog, Tabs, etc.)
- **Styling:** Tailwind CSS 3.4.x
- **Backend:** Rust API on port 3001

---

## 9. Design Principles (Target State)

1. **One calm surface** — no cognitive overload
2. **Panels, not pages** — drill-in without losing context
3. **Customer-safe language** — never expose accounting jargon
4. **Safe by design** — nothing auto-applies without confirmation
5. **Error-resilient** — graceful degradation with clear feedback
6. **Modular architecture** — each section is its own component with its own data hook
