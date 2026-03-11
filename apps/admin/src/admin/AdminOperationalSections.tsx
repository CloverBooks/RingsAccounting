import React, { useEffect, useState } from "react";
import {
  fetchExpensesAudit,
  fetchInvoicesAudit,
  fetchLedgerHealth,
  fetchReconciliationMetrics,
  type ExpensesAudit,
  type InvoicesAudit,
  type LedgerHealth,
  type ReconciliationMetrics,
} from "./api";
import { AuditLogSection } from "./AuditLogSection";
import { Card, SimpleTable, StatusPill, cn } from "./AdminUI";

export const ReconciliationSection: React.FC = () => {
  const [data, setData] = useState<ReconciliationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReconciliationMetrics()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Reconciliation tracking</h2>
          <p className="max-w-xl text-sm text-slate-600">
            High-friction areas in matching and period completion. This view exists solely for internal staff -
            end users never see this lens.
          </p>
        </div>
      </header>
      {loading ? (
        <Card><p className="text-sm text-slate-600">Loading reconciliation metrics...</p></Card>
      ) : error ? (
        <Card><p className="text-sm text-rose-700">Error: {error}</p></Card>
      ) : data ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total unreconciled</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.total_unreconciled}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">0-30 days</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{data.aging["0_30_days"]}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">30-60 days</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{data.aging["30_60_days"]}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Over 60 days</p>
              <p className="mt-1 text-2xl font-semibold text-rose-700">
                {data.aging["60_90_days"] + data.aging.over_90_days}
              </p>
            </div>
          </div>
          <Card title="Top workspaces by unreconciled" subtitle="Workspaces with the most pending items.">
            {data.top_workspaces.length ? (
              <SimpleTable
                headers={["Workspace", "Unreconciled"]}
                rows={data.top_workspaces.map((workspace) => [
                  <span key="name" className="text-sm text-slate-800">{workspace.name}</span>,
                  <span key="count" className="text-sm font-semibold text-slate-900">{workspace.unreconciled_count}</span>,
                ])}
              />
            ) : (
              <p className="text-sm text-slate-600">No unreconciled transactions found.</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
};

export const LedgerSection: React.FC = () => {
  const [data, setData] = useState<LedgerHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLedgerHealth()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Ledger health</h2>
          <p className="max-w-xl text-sm text-slate-600">
            Trial balance anomalies, unbalanced entries, orphan accounts, and suspense balances. All purely internal
            diagnostics.
          </p>
        </div>
      </header>
      {loading ? (
        <Card><p className="text-sm text-slate-600">Loading ledger health...</p></Card>
      ) : error ? (
        <Card><p className="text-sm text-rose-700">Error: {error}</p></Card>
      ) : data ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Unbalanced entries</p>
              <p className={cn("mt-1 text-2xl font-semibold", data.summary.unbalanced_entries > 0 ? "text-rose-700" : "text-emerald-700")}>
                {data.summary.unbalanced_entries}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Orphan accounts</p>
              <p className={cn("mt-1 text-2xl font-semibold", data.summary.orphan_accounts > 0 ? "text-amber-700" : "text-slate-700")}>
                {data.summary.orphan_accounts}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Suspense with balance</p>
              <p className={cn("mt-1 text-2xl font-semibold", data.summary.suspense_with_balance > 0 ? "text-amber-700" : "text-slate-700")}>
                {data.summary.suspense_with_balance}
              </p>
            </div>
          </div>
          {data.unbalanced_entries.length > 0 ? (
            <Card title="Unbalanced entries" subtitle="Journal entries where debits != credits.">
              <SimpleTable
                headers={["Workspace", "Date", "Description", "Difference"]}
                rows={data.unbalanced_entries.slice(0, 10).map((entry) => [
                  <span key="workspace" className="text-sm text-slate-800">{entry.workspace}</span>,
                  <span key="date" className="text-xs text-slate-600">{entry.date || "-"}</span>,
                  <span key="description" className="max-w-[200px] truncate text-xs text-slate-700">{entry.description || "-"}</span>,
                  <span key="difference" className="text-sm font-semibold text-rose-700">${entry.difference.toFixed(2)}</span>,
                ])}
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export const InvoicesSection: React.FC = () => {
  const [data, setData] = useState<InvoicesAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoicesAudit()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Invoices (global audit)</h2>
          <p className="max-w-xl text-sm text-slate-600">
            Cross-tenant visibility into invoice status, failed sends, and potential duplicate or anomalous documents.
          </p>
        </div>
      </header>
      {loading ? (
        <Card><p className="text-sm text-slate-600">Loading invoices audit...</p></Card>
      ) : error ? (
        <Card><p className="text-sm text-rose-700">Error: {error}</p></Card>
      ) : data ? (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.summary.total}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Draft</p>
              <p className="mt-1 text-2xl font-semibold text-slate-600">{data.summary.draft}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sent</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{data.summary.sent}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Paid</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{data.summary.paid}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Issues</p>
              <p className={cn("mt-1 text-2xl font-semibold", data.summary.issues > 0 ? "text-rose-700" : "text-slate-600")}>
                {data.summary.issues}
              </p>
            </div>
          </div>
          {data.recent_issues.length > 0 ? (
            <Card title="Recent issues" subtitle="Invoices with failed, rejected, or error status.">
              <SimpleTable
                headers={["Workspace", "Customer", "Status", "Total"]}
                rows={data.recent_issues.slice(0, 10).map((invoice) => [
                  <span key="workspace" className="text-sm text-slate-800">{invoice.workspace}</span>,
                  <span key="customer" className="text-sm text-slate-700">{invoice.customer}</span>,
                  <StatusPill key="status" tone="warning" label={invoice.status} />,
                  <span key="total" className="text-sm font-semibold text-slate-900">${invoice.total.toFixed(2)}</span>,
                ])}
              />
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export const ExpensesSection: React.FC = () => {
  const [data, setData] = useState<ExpensesAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExpensesAudit()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Expenses & receipts</h2>
          <p className="max-w-xl text-sm text-slate-600">
            Spot mis-categorized spend, receipt anomalies, and FX conversion issues from a single, internal lens.
          </p>
        </div>
      </header>
      {loading ? (
        <Card><p className="text-sm text-slate-600">Loading expenses audit...</p></Card>
      ) : error ? (
        <Card><p className="text-sm text-rose-700">Error: {error}</p></Card>
      ) : data ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total expenses</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.summary.total_expenses}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Total receipts</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{data.summary.total_receipts}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Uncategorized</p>
              <p className={cn("mt-1 text-2xl font-semibold", data.summary.uncategorized > 0 ? "text-amber-700" : "text-slate-600")}>
                {data.summary.uncategorized}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pending receipts</p>
              <p className={cn("mt-1 text-2xl font-semibold", data.summary.pending_receipts > 0 ? "text-amber-700" : "text-slate-600")}>
                {data.summary.pending_receipts}
              </p>
            </div>
          </div>
          <Card title="Top workspaces by expense count" subtitle="Workspaces with the most expense entries.">
            {data.top_workspaces.length ? (
              <SimpleTable
                headers={["Workspace", "Count", "Total"]}
                rows={data.top_workspaces.slice(0, 10).map((workspace) => [
                  <span key="name" className="text-sm text-slate-800">{workspace.name}</span>,
                  <span key="count" className="text-sm text-slate-700">{workspace.count}</span>,
                  <span key="total" className="text-sm font-semibold text-slate-900">${workspace.total.toFixed(2)}</span>,
                ])}
              />
            ) : (
              <p className="text-sm text-slate-600">No expense data found.</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
};

export const LogsSection: React.FC = () => (
  <div className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Audit & logs</h2>
        <p className="max-w-xl text-sm text-slate-600">
          Append-only trail of admin actions across users, workspaces, and configuration.
        </p>
      </div>
    </header>
    <AuditLogSection />
  </div>
);
