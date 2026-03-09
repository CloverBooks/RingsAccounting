import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    ShieldCheck, Calculator, Sparkles, AlertTriangle,
    CheckCircle2, RefreshCw, ChevronDown, Download
} from "lucide-react";
import {
    useTaxGuardian,
    type Severity, type Status, type TaxAnomaly,
    type PaymentStatus,
} from "./useTaxGuardian";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";
import AppLink from "../routing/AppLink";

// ─── helpers ────────────────────────────────────────────────────────────────
export function formatCurrency(v: number | string | undefined | null, currency = "USD"): string {
    const n = typeof v === "string" ? parseFloat(v) || 0 : (v ?? 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(isNaN(n as number) ? 0 : n as number);
}
function paymentStatusLabel(s: PaymentStatus | null | undefined): string {
    const m: Record<string, string> = { PAID: "Paid", PARTIALLY_PAID: "Partial", UNPAID: "Unpaid", OVERPAID: "Overpaid", SETTLED_ZERO: "Settled", NO_LIABILITY: "No Liability", REFUND_DUE: "Refund Due", REFUND_RECEIVED: "Refunded" };
    return s ? (m[s] ?? "Unknown") : "—";
}
function useQueryParams() {
    const { search } = useLocation();
    const p = new URLSearchParams(search);
    return { period: p.get("period") ?? undefined, severity: p.get("severity") as Severity | undefined };
}
function parseISODateToLocal(iso: string): Date | null {
    const core = iso.split("T")[0];
    const parts = core.split("-");
    if (parts.length !== 3) return null;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
}
function formatShortDate(iso: string): string {
    const d = parseISODateToLocal(iso);
    if (!d) return "—";
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    return `${month} ${d.getDate()}`;
}

// ─── main component ───────────────────────────────────────────────────────────
const TaxGuardianPage: React.FC = () => {
    const qp = useQueryParams();
    const { auth } = useAuth() as any;
    const { can } = usePermissions();
    const navigate = useNavigate();
    const userName = auth?.user?.firstName || auth?.user?.name || auth?.user?.username || "there";

    const {
        periods, snapshot, anomalies, bankAccounts,
        selectedPeriod, setSelectedPeriod,
        severityFilter, setSeverityFilter,
        loading, error, llmEnrich, updatePeriodStatus, updateAnomalyStatus,
    } = useTaxGuardian(qp.period, qp.severity);

    const [enriching, setEnriching] = useState(false);

    // Derived state
    const netTax = useMemo(() => {
        if (!snapshot) return 0;
        if (snapshot.net_tax !== undefined && snapshot.net_tax !== null) return snapshot.net_tax;
        return Object.values(snapshot.summary_by_jurisdiction || {}).reduce((s: number, j: any) => s + (j.net_tax || 0), 0);
    }, [snapshot]);

    const currency = snapshot?.country === "US" ? "USD" : "CAD";
    const paymentsTotal = snapshot?.payments_total ?? 0;
    const remainingBalance = snapshot?.remaining_balance ?? Math.max(0, netTax - paymentsTotal);
    const paymentStatus = snapshot?.payment_status as PaymentStatus | null;
    const jurisdictions = Object.entries(snapshot?.summary_by_jurisdiction || {});

    const openAnomalies = anomalies.filter((a: TaxAnomaly) => a.status === "OPEN");
    const highAnomalies = openAnomalies.filter((a: TaxAnomaly) => a.severity === "high");

    const dueBadge = useMemo(() => {
        if (snapshot?.is_overdue) return { text: "Overdue", cls: "bg-rose-50 text-rose-700 border-rose-200" };
        if (snapshot?.is_due_soon) return { text: "Due Soon", cls: "bg-amber-50 text-amber-700 border-amber-200" };
        return { text: "On Track", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }, [snapshot]);

    const schedule = useMemo(() => {
        const upcoming = periods.filter(p => p.due_date && p.status !== "FILED").slice(0, 3);
        if (upcoming.length === 0) return [
            { day: "Q1 2025 — Due Apr 15", items: [{ title: "Federal GST/HST Return", time: "Due April 15, 2025", status: "Upcoming", color: "text-slate-500" }] },
            { day: "Q2 2025 — Due Jul 15", items: [{ title: "State Sales Tax — WA", time: "Due July 15, 2025", status: "Upcoming", color: "text-slate-500" }] },
        ];
        return upcoming.map(p => ({
            day: `${p.period_key} — Due ${p.due_date ? formatShortDate(p.due_date) : "TBD"}`,
            items: [{ title: `${p.period_key} Return`, time: p.due_date ? formatShortDate(p.due_date) : "TBD", status: p.is_overdue ? "Overdue" : "Upcoming", color: p.is_overdue ? "text-rose-600 font-semibold" : "text-slate-500" }],
        }));
    }, [periods]);

    const handleEnrich = async () => {
        if (!selectedPeriod) return;
        setEnriching(true);
        try {
            await llmEnrich(selectedPeriod);
        } catch (e: any) {
            console.error(e);
        } finally {
            setEnriching(false);
        }
    };

    if (loading && !snapshot) return (
        <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mb-4 text-slate-400" />
            <p>Loading tax profile...</p>
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-slate-50 text-slate-900 px-4 py-6">
            <div className="mx-auto max-w-7xl space-y-6">

                {/* Header */}
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Tax Guardian</p>
                        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
                            {highAnomalies.length > 0 ? (
                                <span><span className="text-rose-600">{highAnomalies.length} high-priority issues</span> need attention.</span>
                            ) : (
                                <span>Your tax standing is <span className="mb-accent-underline text-emerald-700">on track.</span></span>
                            )}
                        </h1>
                        <p className="text-sm text-slate-500">
                            Live snapshot of {selectedPeriod} · {snapshot?.country || "Multi-Jurisdiction"}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="relative">
                            <select value={selectedPeriod || ""} onChange={e => setSelectedPeriod(e.target.value)}
                                className="appearance-none rounded-full border border-slate-200 bg-white pl-4 pr-8 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none cursor-pointer">
                                {periods.map(p => <option key={p.period_key} value={p.period_key}>{p.period_key} Return</option>)}
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-2 text-slate-400" />
                        </div>

                        {can("tax.guardian.export") && selectedPeriod && (
                            <a href={`/api/tax/periods/${selectedPeriod}/export.json`} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                                <Download size={14} className="mr-1.5" /> Export
                            </a>
                        )}

                        <button onClick={handleEnrich} disabled={enriching || !selectedPeriod}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm hover:bg-emerald-100 disabled:opacity-50 transition-colors">
                            <Sparkles size={14} className="mr-1.5 text-emerald-600" />
                            {enriching ? "Analyzing…" : "Run AI Audit"}
                        </button>
                    </div>
                </header>

                {/* Top KPI Cards (Mathching Dashboard Stats) */}
                <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    <div className="rounded-3xl border border-slate-100 bg-white/90 px-4 py-4 shadow-sm">
                        <p className="text-xs font-medium text-slate-500">Net Tax Liability</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900 font-mono-soft">{formatCurrency(netTax, currency)}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${dueBadge.cls}`}>
                                {dueBadge.text}
                            </span>
                            <span className="text-slate-500">Due {snapshot?.due_date ? formatShortDate(snapshot.due_date) : "—"}</span>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white/90 px-4 py-4 shadow-sm">
                        <p className="text-xs font-medium text-slate-500">Remaining Balance</p>
                        <p className={`mt-2 text-xl font-semibold font-mono-soft ${remainingBalance > 0 ? "text-amber-700" : "text-slate-900"}`}>
                            {formatCurrency(remainingBalance, currency)}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
                            <span>{formatCurrency(paymentsTotal, currency)} paid so far</span>
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                {paymentStatusLabel(paymentStatus)}
                            </span>
                        </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white/90 px-4 py-4 shadow-sm xl:col-span-2">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-medium text-slate-500">Anomalies Detected</p>
                            <div className="text-[11px] font-semibold text-sky-700 cursor-pointer hover:text-sky-900">Review all</div>
                        </div>
                        <p className="mt-2 text-xl font-semibold text-slate-900 font-mono-soft">{openAnomalies.length}</p>

                        <div className="mt-1 flex items-center gap-3 text-[11px]">
                            {highAnomalies.length > 0 ? (
                                <div className="flex items-center gap-1.5 text-rose-700 font-medium">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                    <span>{highAnomalies.length} priority blockers</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-emerald-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span>No severity blockers</span>
                                </div>
                            )}
                            <div className="text-slate-500">
                                {anomalies.length - openAnomalies.length} resolved this period
                            </div>
                        </div>
                    </div>
                </section>

                {/* AI Insight banner */}
                {snapshot?.llm_summary && (
                    <div className="rounded-2xl bg-indigo-50/80 border border-indigo-100/50 p-4 flex items-start gap-3 shadow-sm">
                        <Sparkles size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-semibold text-indigo-900">AI Tax Summary</h3>
                            <p className="text-xs text-indigo-700/80 mt-1 max-w-4xl leading-relaxed">{snapshot.llm_summary}</p>
                        </div>
                    </div>
                )}

                {/* Two column layout matching Dashboard grid gap-4 lg:grid-cols-[1.15fr,1.1fr] */}
                <section className="grid gap-4 lg:grid-cols-[1fr,1.1fr]">

                    {/* Anomalies List Column */}
                    <div className="rounded-3xl border border-slate-100 bg-white/90 p-4 sm:p-5 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-slate-500">Action Required</p>
                                <p className="mt-1 text-sm text-slate-500">Items flagged for review.</p>
                            </div>
                            <div className="flex gap-2 text-xs">
                                {(["all", "high", "medium", "low"] as const).map(s => (
                                    <button key={s} onClick={() => setSeverityFilter(s as any)}
                                        className={`px-3 py-1 rounded-full border capitalize transition-all ${(severityFilter || "all") === s
                                                ? "border-slate-300 bg-slate-50 text-slate-800 font-medium"
                                                : "border-transparent text-slate-500 hover:bg-slate-50"
                                            }`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-1 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                            <div className="flex items-center justify-between text-[11px] text-slate-600 mb-2 px-2">
                                <span>Description</span>
                                <span>Diff · Status</span>
                            </div>
                            <div className="space-y-1.5 text-xs">
                                {openAnomalies.filter((a: TaxAnomaly) => !severityFilter || severityFilter === "all" || a.severity === severityFilter).length > 0 ? (
                                    openAnomalies.filter((a: TaxAnomaly) => !severityFilter || severityFilter === "all" || a.severity === severityFilter).slice(0, 5).map((a: TaxAnomaly) => {
                                        const sevCol = a.severity === "high" ? "bg-rose-100 text-rose-700 border-rose-200" : a.severity === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-sky-100 text-sky-700 border-sky-200";
                                        return (
                                            <div key={a.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm border border-slate-100 hover:border-slate-200 transition">
                                                <div className="flex-1 truncate pr-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${sevCol}`}>{a.severity}</span>
                                                        <span className="font-mono-soft text-slate-500">{a.code}</span>
                                                    </div>
                                                    <div className="mt-1 truncate text-slate-700">{a.description}</div>
                                                </div>
                                                <div className="w-24 text-right flex flex-col items-end gap-1">
                                                    <span className={`font-mono-soft font-medium ${a.difference ? "text-rose-600" : "text-slate-400"}`}>
                                                        {a.difference ? formatCurrency(a.difference, currency) : "—"}
                                                    </span>
                                                    <button onClick={() => updateAnomalyStatus(selectedPeriod!, a.id, "RESOLVED", "all")}
                                                        className="text-[10px] text-emerald-600 font-semibold hover:text-emerald-700 hover:underline">
                                                        Resolve ✓
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-slate-500 text-sm px-2 py-5 text-center flex flex-col items-center gap-2">
                                        <ShieldCheck size={24} className="text-emerald-400" />
                                        No open anomalies found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Schedule and breakdown */}
                    <div className="space-y-4">
                        {/* Schedule Card */}
                        <div className="rounded-3xl border border-slate-100 bg-white/90 p-4 sm:p-5 shadow-sm flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-slate-500">Upcoming Filings</p>
                                    <p className="mt-1 text-sm text-slate-500">Deadlines and pending returns.</p>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-xs">
                                {schedule.length > 0 ? (
                                    schedule.map((group, idx) => (
                                        <div key={idx} className="rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden">
                                            <div className="bg-slate-100/50 px-3 py-2 text-[11px] font-medium text-slate-600 border-b border-slate-100">
                                                {group.day}
                                            </div>
                                            <div className="p-3">
                                                {group.items.map((item, ii) => (
                                                    <div key={ii} className="flex justify-between items-center">
                                                        <span className="font-medium text-slate-800">{item.title}</span>
                                                        <span className={item.color}>{item.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-slate-500 text-sm px-2 py-3">No upcoming filings.</div>
                                )}
                            </div>
                        </div>

                        {/* Pipeline/Jurisdictions summary */}
                        <div className="rounded-3xl border border-slate-100 bg-white/90 p-4 sm:p-5 shadow-sm flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-slate-500">Jurisdictions</p>
                                    <p className="mt-1 text-sm text-slate-500">Breakdown of net tax by region.</p>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                                {jurisdictions.length > 0 ? (
                                    jurisdictions.slice(0, 4).map(([code, data]: any) => (
                                        <div key={code} className="rounded-2xl bg-slate-50/80 border border-slate-100 px-3 py-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] text-slate-500">{code}</p>
                                                <p className="mt-1 text-sm font-semibold text-slate-900">{data.status || "Active"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-slate-900 font-mono-soft">{formatCurrency(data.net_tax, currency)}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 rounded-2xl bg-slate-50/80 border border-slate-100 px-3 py-4 text-center text-slate-500 text-sm">
                                        No jurisdiction data available.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
};

export default TaxGuardianPage;
