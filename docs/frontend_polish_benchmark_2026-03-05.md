# Frontend Polish Benchmark 2026-03-05

## Scope
Inventory of every active customer route in `apps/customer` and every admin route/section in `apps/admin`.

Benchmark lens:
- QuickBooks/Xero workflow clarity
- Ramp/Mercury trust, approvals, and operator UX

Status scale:
- `ready`
- `minor polish`
- `major polish`
- `rework`

Rubric:
- navigation clarity
- first-screen comprehension
- empty/loading/error states
- trust/compliance cues
- task completion efficiency
- data density/scannability
- accessibility/responsiveness
- visual consistency

Score guide:
- `x/8` = current rubric score

Priority order:
- `P0`: onboarding, dashboard, companion/tax
- `P1`: banking/reconciliation, invoices/expenses, settings, auth
- `P2`: secondary customer entity/reporting surfaces
- `P3`: admin operations polish

## Customer App

| app | surface | route/section | purpose | current maturity | benchmark target | polish gaps | acceptance bar | test expectation | dependency/blocker | priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| customer | Login | `/login` | Sign in entry | `minor polish (6/8)` | Trusted fintech auth entry | Weak trust copy, thin recovery guidance | Security/recovery cues above fold | Auth success/failure, redirect preservation | Auth backend | P1 |
| customer | Welcome | `/welcome` | Brand/orientation landing | `major polish (4/8)` | Concise product orientation | Low proof, weak role framing | Clear promise plus two CTAs in first viewport | Render and CTA visibility | Content strategy | P1 |
| customer | Signup | `/signup` | Account creation | `major polish (4/8)` | Low-friction fintech signup | Weak field rationale, unclear next step | Tight validation and post-submit flow | Validation and submit failure states | Signup copy/backend behavior | P1 |
| customer | OAuth Callback | `/auth/callback` | Auth handoff return | `minor polish (5/8)` | Invisible resilient handoff | Opaque wait state | Deterministic load/success/error states | Success redirect and malformed payload handling | Provider payload shape | P1 |
| customer | Dashboard | `/`, `/dashboard` | Operating home | `major polish (5/8)` | Accounting control room | Broad hierarchy, setup/tax trust cues too light | Cash/tax/setup priorities visible without scroll | Data load, retry, setup/tax cards | Metric completeness | P0 |
| customer | Agentic Console | `/agentic/console` | Trace and audit console | `major polish (4/8)` | Operator-grade provenance viewer | Dense raw detail, weak guidance | Context, evidence, safe actions easy to scan | Render, empty/error states | Provenance endpoints incomplete | P2 |
| customer | Receipts Demo | `/agentic/receipts-demo` | Demo surface | `rework (3/8)` | Explicit sandbox or retire route | Demo posture hurts trust | Clear sandbox framing or removal | Demo banner/isolation state | Product decision | P2 |
| customer | Onboarding | `/onboarding` | Company/compliance/context setup | `major polish (5/8)` | Professional accounting setup wizard | Review summary and field rationale need work | Required fields, readiness, consent, resume all explicit | Gating, resume, transitions, completion side effects | Future jurisdiction schema | P0 |
| customer | Companion Control Tower | `/companion` | Main companion surface | `major polish (5/8)` | Calm AI control room | Dense cards, trust language can sharpen | Health, blockers, unknowns, queue visible first | Summary, disabled, queue, unknowns | Trust/provenance depth | P0 |
| customer | Companion Overview | `/companion/overview` | Narrative AI overview | `major polish (4/8)` | Executive AI status board | Broad hierarchy, weak summary compression | Key insights readable in under 15 seconds | Render plus loading/empty states | Richer summary metadata | P0 |
| customer | Companion Issues | `/companion/issues`, `/ai-companion/issues` | Issue queue | `major polish (5/8)` | Risk-first operator inbox | Grouping and remediation state need work | Source, severity, impact, next action all visible | Queue grouping and empty/error states | Provenance payload richness | P0 |
| customer | Companion Proposals | `/companion/proposals` | Suggestion queue and gating | `minor polish (6/8)` | Approval-ready proposal queue | Batch framing and mode trust cues | Readiness, mode, risk, apply/review paths explicit | Gating and suggest-only flow | Autonomy breadth | P0 |
| customer | Tax Guardian | `/companion/tax` | Tax risk surface | `major polish (5/8)` | Tax command center | Filing posture and compliance proof need lift | Liability, anomalies, due dates, jurisdiction visible first | Render and readiness/error states | Deterministic tax depth | P0 |
| customer | Tax Catalog | `/companion/tax/catalog` | Tax rule catalog | `major polish (4/8)` | Searchable policy browser | Discoverability and provenance are light | Search, filters, rule metadata obvious | Render and search/filter states | Tax metadata completeness | P0 |
| customer | Tax Product Rules | `/companion/tax/product-rules` | Product tax config | `major polish (4/8)` | Accountant-safe rules editor | Weak preview and impact summary | Scope, override reason, effective rule clear | Render, save, validation | Rule persistence detail | P0 |
| customer | Tax Settings | `/companion/tax/settings` | Tax defaults/posture | `major polish (5/8)` | Compliance settings panel | Consequence explanation is thin | Defaults, cadence, effective dates obvious | Render, save/reload, fallback states | Settings contract maturity | P0 |
| customer | Invoices Workspace | `/invoices` | Invoice AI processing | `major polish (5/8)` | AP/AR document workstation | Upload/review hierarchy needs polish | Upload, extraction, risk, approve flow tightly sequenced | Upload, run list, detail review | Extraction/posting quality | P1 |
| customer | Invoice Run List | `/invoices/list` | Historical invoice runs | `minor polish (6/8)` | Operational run ledger | Status and trust metadata can improve | Scope, status, errors, action visible per run | Run list and row actions | Run analytics richness | P1 |
| customer | Expenses | `/expenses`, `/receipts` | Receipt/expense intake | `major polish (5/8)` | Expense intake workstation | Risk explanation and batch review are basic | Upload, exceptions, approve flow obvious | Data states, pagination, edit/approve | Extraction quality | P1 |
| customer | Customers | `/customers` | Customer master data | `major polish (4/8)` | Accounting CRM-lite list | Weak KPI framing, low density | Searchable list with balances and status | Route render and empty state | Customer metrics | P2 |
| customer | Suppliers | `/suppliers` | Supplier master data | `major polish (4/8)` | Vendor ledger view | Low information density, weak risk cues | Payment/tax metadata and actions visible | Route render and empty state | Vendor metadata completeness | P2 |
| customer | Products | `/products` | Product/service catalog | `major polish (4/8)` | Catalog manager with tax/revenue context | Weak summary and bulk workflows | Core attributes and tax treatment scan cleanly | Route render and CRUD shell states | Product accounting metadata | P2 |
| customer | Categories | `/categories` | Category organization | `major polish (4/8)` | Compact mapping manager | Hierarchy and usage context are light | Usage count, active state, mapping impact visible | Route render and empty state | Usage analytics | P2 |
| customer | Inventory | `/inventory` | Inventory overview | `major polish (4/8)` | Stock and valuation summary | Limited prioritization, weak freshness cues | Top SKUs, alerts, valuation visible first | Route render and loading/empty states | Inventory backend maturity | P2 |
| customer | Banking | `/banking` | Feed and transaction operations | `major polish (5/8)` | Banking workspace with feed health | Feed health and exception summaries can improve | Account status, feed freshness, next actions obvious | Transaction fetch and batch states | Provider health signals | P1 |
| customer | Bank Setup | `/banking/setup` | Connect/import setup | `major polish (5/8)` | Secure setup wizard | Trust copy and choice comparison are basic | Connect/import/manual choices explicit | Render and failure states | Institution coverage | P1 |
| customer | Reconciliation | `/reconciliation` | Matching workflow | `minor polish (6/8)` | Accountant-grade matching table | Dense controls and session guidance | Open items, filters, errors, session health scan fast | Load, reopen, filter, toggle, failure | Matching confidence | P1 |
| customer | Reconciliation Report | `/reconciliation/report` | Outcome report | `minor polish (6/8)` | Export-ready reconciliation report | Narrative summary is light | Period, balances, variances, export obvious | Route render for print/normal states | Report detail fields | P1 |
| customer | Profit and Loss Report | `/reports/pl` | P&L reporting | `minor polish (6/8)` | Board-ready P&L | Comparative framing needs lift | Period, totals, trends, export are clear | Route render and state handling | Report completeness | P2 |
| customer | Cashflow Report | `/reports/cashflow` | Cashflow reporting | `minor polish (6/8)` | CFO-style cash view | Weak callout hierarchy | Inflow/outflow/trend visible first | Route render and export shell | Cashflow data quality | P2 |
| customer | Cashflow Print | `/reports/cashflow/print` | Print/export layout | `minor polish (5/8)` | Print-clean artifact | Print hierarchy and pagination need work | No clipping or ambiguous labels | Print render | Report template decisions | P2 |
| customer | Chart of Accounts | `/accounts`, `/accounts/`, `/chart-of-accounts` | COA management | `minor polish (6/8)` | Accountant-friendly account list | Account health summary can improve | Filters, statuses, actions remain clear at density | Filters, aliases, empty states | Usage analytics | P2 |
| customer | Journal Entries | `/journal` | Journal ledger | `major polish (5/8)` | Audit-grade journal view | Dense but not benchmark scannable | Date, source, amount, anomaly markers visible | Route render and state handling | Journal provenance | P2 |
| customer | Transactions | `/transactions` | Unified transaction list | `major polish (5/8)` | Searchable transaction workspace | Filter discoverability and row density | Status, account, amount, source, filters obvious | Route render and list states | Query capabilities | P2 |
| customer | Account Settings | `/settings` | Workspace/account defaults | `major polish (5/8)` | Settings home with save confidence | Section hierarchy and save feedback need lift | Grouped settings and security context clear | Render, bootstrap fallback, save/reload | Settings breadth | P1 |
| customer | Roles Settings | `/settings/roles` | Role/permission setup | `major polish (5/8)` | Safe permission matrix | Weak role explanation and consequence preview | Privileges and constraints obvious per role | Route render and permission state | RBAC depth | P1 |
| customer | Team Management | `/settings/team` | Team invites and management | `major polish (5/8)` | Staff admin surface | Invite/member lifecycle cues are light | Active/pending users, roles, actions scan cleanly | Route render and member state shell | Invite backend behavior | P1 |
| customer | Bank Review | `/bank-review` | Agentic bank review | `major polish (5/8)` | Run review with anomalies and follow-up | Summary hierarchy can improve | Run status, high risk, AI narrative, drilldown clear | Run list/detail and AI insights | Agentic breadth/provenance | P1 |
| customer | Books Review | `/books-review` | Ledger-wide books audit | `major polish (5/8)` | Month-close review console | History placement and first-screen summary need work | Run summary, findings, AI summary, archives visible fast | Runs load, detail load, AI insight | Books review backend depth | P1 |
| customer | Help | `/help` | Support/help surface | `rework (2/8)` | Searchable help center or routed support | Placeholder only, no IA or escalation framing | Real help center/support launcher or retire route | Route render and support CTA | Support IA decision | P2 |

## Admin App

| app | surface | route/section | purpose | current maturity | benchmark target | polish gaps | acceptance bar | test expectation | dependency/blocker | priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| admin | Internal Admin Login | `/login` | Admin console auth | `minor polish (6/8)` | Hardened internal login | Environment and authorization cues can improve | Return path, internal-only trust cues, denial state all clear | Login success redirect and denied access | SSO roadmap | P3 |
| admin | Invite Redeem | `/invite/:token` | Admin invite onboarding | `minor polish (6/8)` | Secure invite redemption | Password rules and next-step framing need polish | Valid/invalid/success states feel safe and deliberate | Valid invite, invalid invite, successful submit | Invite policy | P3 |
| admin | Admin Shell | all shell routes | Internal nav/top bar/context | `minor polish (6/8)` | Operator shell with persistent context | Search, environment, and sidebar hierarchy need lift | Nav state and context remain clear across routes | Shell render and nav behavior | Admin IA decisions | P3 |
| admin | Overview | `/control-tower` | Operations control center | `minor polish (6/8)` | KPI-driven ops cockpit | KPI-to-action linkage can improve | Health KPIs and top actions visible first | Route render and KPI presence | Broader ops metrics | P3 |
| admin | Users | `/users` | User account operations | `minor polish (6/8)` | Operator user directory | More trust language around impersonation needed | List, filters, impersonation, reset actions are explicit | List render, filters, impersonation | Audit metadata depth | P3 |
| admin | Employees | `/employees` | Internal admin employee management | `minor polish (6/8)` | Access manager with role lifecycle | Permission explanation and state grouping need work | Active/invited/deactivated states clear with safe actions | Auth gating, invite, copy link, deactivate | Admin RBAC policy | P3 |
| admin | Support | `/support` | Support ticket operations | `minor polish (6/8)` | Support inbox with ownership and SLA posture | Workload summary and SLA framing need lift | Queue state, filters, owner, latest action scan fast | Ticket render and filtering | Support metrics | P3 |
| admin | Approvals | `/approvals` | Maker-checker queue | `minor polish (6/8)` | Finance approval console | Batch summary and policy explanation can improve | Pending volume, risk, age, reason visible | Route render and action states | Approval analytics | P3 |
| admin | Workspaces | `/workspaces` | Tenant oversight | `minor polish (6/8)` | Multi-tenant health ledger | Health rollup and quick drilldown can improve | Health, owner, top risk visible per workspace | Workspace table render | Health scoring model | P3 |
| admin | Banking | `/banking` | Cross-tenant bank feed health | `minor polish (6/8)` | Feed ops console | Better anomaly grouping and shortcuts needed | Failing/stale/import issue states visible immediately | Route render and feed states | Provider telemetry richness | P3 |
| admin | Reconciliation | `/reconciliation` | Cross-tenant reconciliation tracking | `minor polish (6/8)` | Aging and hotspot ops view | Prioritization and aging visuals need work | Unreconciled totals, aging, top workspaces visible first | Route render and data states | Reconciliation metrics detail | P3 |
| admin | Ledger Health | `/ledger` | Cross-tenant integrity monitoring | `minor polish (6/8)` | Integrity dashboard with drilldown | Anomaly prioritization can improve | Unbalanced/orphan/suspense states clear | Route render and anomaly states | Ledger anomaly metadata | P3 |
| admin | Invoices Audit | `/invoices` | Global invoice audit | `minor polish (6/8)` | Revenue document oversight | Trend framing and actionability need lift | Volume, status mix, issue rows scan fast | Route render and summary state | Invoice analytics depth | P3 |
| admin | Expenses Audit | `/expenses` | Global expense oversight | `minor polish (6/8)` | Spend operations lens | KPI hierarchy and anomaly cues need work | Totals, uncategorized, pending receipts visible first | Route render and summary state | Expense analytics depth | P3 |
| admin | Autonomy Engine | `/autonomy` | CAE queue/mode monitoring | `minor polish (6/8)` | Internal autonomy console | Policy explanation and breaker narrative need lift | Mode, trust, queue state, breakers obvious before drilldown | Route render and queue state | Autonomy metrics depth | P3 |
| admin | AI Monitoring | `/ai-monitoring` | Internal AI monitoring | `major polish (5/8)` | Model oversight with alerts | Informative but not operator-grade yet | Last run, alerts, covered domains, metrics visible first | Route render and alert state | Monitoring pipeline/API | P3 |
| admin | Feature Flags | `/feature-flags` | Rollout and experiment control | `minor polish (6/8)` | Safe rollout board | Ownership and consequences need clearer framing | Flag state, guard level, target scope explicit | Flag render and protected-toggle state | Rollout metadata model | P3 |
| admin | Settings | `/settings` | Internal environment/security config | `minor polish (6/8)` | Ops settings home | Stronger sectioning and actions needed | Environment, SSO, model, audit config obvious | Route render and config visibility | Config API expansion | P3 |
| admin | Logs | `/audit` | Append-only audit trail | `minor polish (6/8)` | Filterable audit ledger | Saved filters, export framing, grouping need work | Actor, action, target, timestamp, severity scan fast | Route render and log list behavior | Audit categorization depth | P3 |

## Recommended Execution Order
1. Finish customer `P0` surfaces: onboarding, dashboard, companion, and tax.
2. Tighten customer `P1` workflows: banking, reconciliation, invoices, expenses, and settings.
3. Raise customer `P2` entity/reporting surfaces to one consistent bookkeeping benchmark.
4. Unify admin `P3` surfaces around one stronger operator shell and table/card language.
