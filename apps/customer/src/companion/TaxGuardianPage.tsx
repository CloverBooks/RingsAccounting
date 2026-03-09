import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    ShieldCheck, PieChart, BarChart3, Sparkles, Calculator,
    FileText, Bell, Settings, AlertTriangle, CheckCircle2,
    ArrowUpRight, RefreshCw, Download, ChevronDown, X,
    CreditCard, Globe, Zap, LogOut,
} from "lucide-react";
import {
    useTaxGuardian,
    type Severity, type Status, type TaxAnomaly,
    type PaymentStatus, type TaxPayment, type TaxPaymentKind,
} from "./useTaxGuardian";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";

// ─── helpers ────────────────────────────────────────────────────────────────
export function formatCurrency(v: number | string | undefined | null, currency = "USD"): string {
    const n = typeof v === "string" ? parseFloat(v) || 0 : (v ?? 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(isNaN(n as number) ? 0 : n as number);
}
function paymentStatusLabel(s: PaymentStatus | null | undefined): string {
    const m: Record<string, string> = { PAID: "Paid", PARTIALLY_PAID: "Partial", UNPAID: "Unpaid", OVERPAID: "Overpaid", SETTLED_ZERO: "Settled", NO_LIABILITY: "No Liability", REFUND_DUE: "Refund Due", REFUND_RECEIVED: "Refunded" };
    return s ? (m[s] ?? "Unknown") : "—";
}
function periodSortKey(k: string): number {
    const q = k.match(/^Q([1-4])\s+(\d{4})$/); if (q) return +q[2] * 10 + +q[1];
    const m = k.match(/^(\d{4})-(\d{2})$/); if (m) return +m[1] * 100 + +m[2];
    return 0;
}
function useQueryParams() {
    const { search } = useLocation();
    const p = new URLSearchParams(search);
    return { period: p.get("period") ?? undefined, severity: p.get("severity") as Severity | undefined };
}
function Toast({ message, type, onClose }: { message: string; type: string; onClose: () => void }) {
    const bg = type === "error" ? "bg-rose-600" : type === "success" ? "bg-emerald-600" : "bg-violet-600";
    return (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-2xl ${bg}`}>
            {message}<button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
    );
}

// ─── NAV items ────────────────────────────────────────────────────────────────
const NAV = [
    { icon: <PieChart size={18} />, to: "/dashboard" },
    { icon: <BarChart3 size={18} />, to: "/banking" },
    { icon: <CreditCard size={18} />, to: "/expenses" },
    { icon: <FileText size={18} />, to: "/invoices" },
    { icon: <Calculator size={18} />, to: "/companion/tax", active: true },
    { icon: <Globe size={18} />, to: "/workflows" },
];

// ─── main component ───────────────────────────────────────────────────────────
const TaxGuardianPage: React.FC = () => {
    const qp = useQueryParams();
    const { auth, logout } = useAuth() as any;
    const { can } = usePermissions();
    const navigate = useNavigate();
    const userName = auth?.user?.firstName || auth?.user?.name || auth?.user?.username || "there";
    const initials = userName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "CB";

    const {
        periods, snapshot, anomalies, bankAccounts,
        selectedPeriod, setSelectedPeriod,
        severityFilter, setSeverityFilter,
        loading, error, llmEnrich, resetPeriod,
        createPayment, updatePayment, deletePayment,
        updatePeriodStatus, updateAnomalyStatus,
    } = useTaxGuardian(qp.period, qp.severity);

    const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
    const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
    const [enriching, setEnriching] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [resetReason, setResetReason] = useState("");
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ id: null as string | null, kind: "PAYMENT" as TaxPaymentKind, bank_account_id: "", amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "EFT", reference: "", notes: "" });
    const showToast = (m: string, t: "success" | "error" | "info") => setToast({ message: m, type: t });

    const netTax = useMemo(() => {
        if (!snapshot) return 0;
        if (snapshot.net_tax !== undefined && snapshot.net_tax !== null) return snapshot.net_tax;
        return Object.values(snapshot.summary_by_jurisdiction || {}).reduce((s: number, j: any) => s + (j.net_tax || 0), 0);
    }, [snapshot]);

    const currency = snapshot?.country === "US" ? "USD" : "CAD";
    const payments: TaxPayment[] = (snapshot?.payments as any) || [];
    const paymentsTotal = snapshot?.payments_total ?? 0;
    const remainingBalance = snapshot?.remaining_balance ?? (netTax - paymentsTotal);
    const paymentStatus = snapshot?.payment_status as PaymentStatus | null;

    const trendPeriods = useMemo(() => {
        const s = [...periods].sort((a, b) => periodSortKey(a.period_key) - periodSortKey(b.period_key));
        return s.slice(Math.max(0, s.length - 12));
    }, [periods]);

    const jurisdictions = Object.entries(snapshot?.summary_by_jurisdiction || {});
    const openAnomalies = anomalies.filter((a: TaxAnomaly) => a.status === "OPEN");
    const highAnomalies = openAnomalies.filter((a: TaxAnomaly) => a.severity === "high");

    const dueBadge = useMemo(() => {
        if (snapshot?.is_overdue) return { text: "Overdue", cls: "bg-rose-500 text-white" };
        if (snapshot?.is_due_soon) return { text: "Due Soon", cls: "bg-amber-400 text-black" };
        return { text: "On Track", cls: "bg-[#A3E635] text-black" };
    }, [snapshot]);

    // monthly bar data: use trendPeriods pairs, pad to 12
    const barMonths = useMemo(() => {
        const base = trendPeriods.map(p => ({
            label: (p.period_key || "").replace(/20(\d\d)/, "'$1").slice(0, 6),
            after: Math.min(230, Math.max(8, Math.round((Number(p.payments_total) || 0) / 200))),
            before: Math.min(130, Math.max(4, Math.round((Number(p.net_tax) || 0) / 200))),
        }));
        if (base.length >= 12) return base.slice(-12);
        const pad = [
            { label: "Q2 '24", after: 120, before: 90 }, { label: "Q3 '24", after: 145, before: 110 },
            { label: "Q4 '24", after: 182, before: 140 }, { label: "Q1 '25", after: 98, before: 80 },
        ];
        return [...pad, ...base].slice(-12);
    }, [trendPeriods]);

    // filing schedule — derive from periods with due dates
    const schedule = useMemo(() => {
        const upcoming = periods.filter(p => p.due_date && p.status !== "FILED").slice(0, 3);
        if (upcoming.length === 0) return [
            { day: "Q1 2025 — Due Apr 15", items: [{ title: "Federal GST/HST Return", time: "Due April 15, 2025", color: "bg-violet-500/20 text-violet-400 border-violet-500/20", icon: "🏛️" }] },
            { day: "Q2 2025 — Due Jul 15", items: [{ title: "State Sales Tax — WA", time: "Due July 15, 2025", color: "bg-[#A3E635]/20 text-[#A3E635] border-[#A3E635]/20", icon: "🌲" }] },
            { day: "Q2 2025 — Due Jul 31", items: [{ title: "Texas Franchise Tax", time: "Due July 31, 2025", color: "bg-amber-500/20 text-amber-400 border-amber-500/20", icon: "⭐" }] },
        ];
        return upcoming.map(p => ({
            day: `${p.period_key} — Due ${p.due_date?.slice(0, 10)}`,
            items: [{ title: `${p.period_key} Return`, time: p.due_date?.slice(0, 10) || "TBD", color: p.is_overdue ? "bg-rose-500/20 text-rose-400 border-rose-500/20" : "bg-violet-500/20 text-violet-400 border-violet-500/20", icon: "📋" }],
        }));
    }, [periods]);

    // pipeline bar — jurisdiction liability bars
    const pipelineBars = useMemo(() => {
        if (jurisdictions.length > 0) {
            const maxJ = Math.max(1, ...jurisdictions.map(([, d]: any) => d.net_tax || 0));
            return jurisdictions.slice(0, 10).map(([, d]: any) => Math.max(8, Math.round(((d.net_tax || 0) / maxJ) * 186)));
        }
        return [28, 54, 82, 126, 164, 186, 168, 144, 124, 112];
    }, [jurisdictions]);

    const pipelineLabels = jurisdictions.length > 0 ? jurisdictions.slice(0, 10).map(([code]: any) => code) : ["WA", "TX", "NY", "CA", "FL", "IL", "PA", "OH", "GA", "NC"];

    // donut-style numbers
    const paidPct = netTax > 0 ? Math.round((paymentsTotal / netTax) * 100) : (paymentStatus === "PAID" ? 100 : 0);
    const prevPeriod = trendPeriods.length > 1 ? trendPeriods[trendPeriods.length - 2] : null;
    const prevNetTax = prevPeriod?.net_tax || 0;

    const handleEnrich = async () => { if (!selectedPeriod) return; setEnriching(true); try { await llmEnrich(selectedPeriod); showToast("AI analysis complete", "success"); } catch (e: any) { showToast(e.message || "AI analysis failed", "error"); } finally { setEnriching(false); } };
    const handleResetPeriod = async () => { if (!selectedPeriod) return; setResetting(true); try { await resetPeriod(selectedPeriod, resetReason); setResetOpen(false); setResetReason(""); showToast("Period reset", "success"); } catch (e: any) { showToast(e.message || "Reset failed", "error"); } finally { setResetting(false); } };
    const handleStatusUpdate = async (s: string) => { if (!selectedPeriod) return; try { await updatePeriodStatus(selectedPeriod, s); showToast(`Status updated to ${s}`, "success"); } catch (e: any) { showToast(e.message || "Update failed", "error"); } };

    if (loading && !snapshot) return (
        <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0b0b0b] text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Reset dialog */}
            {resetOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#131313] border border-white/10 rounded-2xl p-6 shadow-2xl">
                        <div className="flex items-start justify-between mb-4">
                            <div><h2 className="text-base font-semibold text-white">Reset Filed Return</h2><p className="text-xs text-white/50 mt-1">This will reopen the period for changes.</p></div>
                            <button onClick={() => setResetOpen(false)} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
                        </div>
                        <input value={resetReason} onChange={e => setResetReason(e.target.value)} placeholder="Reason (optional)" className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50" />
                        <div className="mt-4 flex justify-end gap-3">
                            <button onClick={() => setResetOpen(false)} className="rounded-lg px-4 py-2 text-xs border border-white/10 text-white/50 hover:text-white">Cancel</button>
                            <button onClick={handleResetPeriod} disabled={resetting} className="rounded-lg px-4 py-2 text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 disabled:opacity-50">{resetting ? "Resetting…" : "Reset"}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-[1500px] p-4 md:p-6">
                <div className="relative min-h-screen rounded-[36px] border border-white/5 bg-black shadow-2xl overflow-hidden">

                    {/* background glow */}
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(139,92,246,0.18),transparent_22%),radial-gradient(circle_at_78%_18%,rgba(163,230,53,0.10),transparent_18%),radial-gradient(circle_at_30%_85%,rgba(56,189,248,0.10),transparent_24%),radial-gradient(circle_at_75%_88%,rgba(139,92,246,0.08),transparent_18%)]" />

                    <div className="relative z-10 grid grid-cols-[76px_1fr] min-h-screen">

                        {/* ── Left Icon Rail ── */}
                        <aside className="border-r border-white/5 bg-black/80 px-2.5 py-5 flex flex-col justify-between">
                            <div className="space-y-6">
                                {/* Logo */}
                                <div className="flex items-center justify-center">
                                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.35)]">
                                        <ShieldCheck size={22} className="text-white" />
                                    </div>
                                </div>
                                {/* Nav icons */}
                                <div className="space-y-3 pt-3">
                                    {NAV.map((item, i) => (
                                        <button key={i} onClick={() => navigate(item.to)}
                                            className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${(item as any).active ? "border-violet-500/40 bg-violet-500/15 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.2)]" : "border-transparent text-white/40 hover:bg-white/5 hover:text-white/70"}`}>
                                            {item.icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Bottom */}
                            <div className="flex flex-col items-center gap-3 pb-2">
                                <button className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 hover:text-white/70" onClick={() => navigate("/settings")}><Settings size={16} /></button>
                                <button className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 hover:text-white/70"><Bell size={16} /></button>
                                <button className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 hover:text-rose-400" onClick={logout}><LogOut size={16} /></button>
                            </div>
                        </aside>

                        {/* ── Main Content ── */}
                        <main className="p-6 md:p-8 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>

                            {/* Header */}
                            <header className="mb-6 flex items-start justify-between gap-6">
                                <div>
                                    <h1 className="text-4xl font-semibold tracking-tight text-white">Tax Guardian 🛡️</h1>
                                    <p className="mt-2 text-sm text-white/60">
                                        {highAnomalies.length > 0
                                            ? <span className="text-rose-400">{highAnomalies.length} high-priority issue{highAnomalies.length > 1 ? "s" : ""} require attention · </span>
                                            : <span className="text-[#A3E635]">No blockers · </span>}
                                        {selectedPeriod} · {snapshot?.country || "Multi-Jurisdiction"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 pt-1 flex-wrap">
                                    {/* Period selector */}
                                    <div className="relative">
                                        <select value={selectedPeriod || ""} onChange={e => setSelectedPeriod(e.target.value)}
                                            className="h-11 appearance-none rounded-xl bg-[#131313] border border-white/10 pl-3 pr-8 text-sm text-white focus:outline-none cursor-pointer">
                                            {periods.map(p => <option key={p.period_key} value={p.period_key} className="bg-[#131313]">{p.period_key}</option>)}
                                        </select>
                                        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-3.5 text-white/40" />
                                    </div>
                                    {can("tax.guardian.export") && selectedPeriod && (
                                        <a href={`/api/tax/periods/${selectedPeriod}/export.json`} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#131313] border border-white/10 text-white/60 hover:text-white transition-all"><Download size={16} /></a>
                                    )}
                                    <button onClick={handleEnrich} disabled={enriching || !selectedPeriod}
                                        className="flex h-11 items-center gap-2 rounded-xl bg-violet-600/20 border border-violet-500/30 px-4 text-sm font-medium text-violet-300 hover:bg-violet-600/30 transition-all disabled:opacity-50">
                                        <Sparkles size={16} />{enriching ? "Analyzing…" : "AI Audit"}
                                    </button>
                                    <div className="h-11 w-11 rounded-xl border border-white/10 bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">{initials}</div>
                                </div>
                            </header>

                            {/* ── Grid ── */}
                            <div className="grid grid-cols-12 gap-4 auto-rows-[minmax(120px,auto)]">

{/* ── CARD 1: Tax Report (main chart, 8 cols) ── */ }
<section className="col-span-12 xl:col-span-8 rounded-2xl border border-white/5 bg-[#131313]/95 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
    <div className="mb-5 flex items-start justify-between gap-4">
        <div>
            <div className="text-[26px] font-semibold text-white">Tax Report</div>
            <div className="mt-5 flex flex-wrap items-end gap-8">
                <div>
                    <div className="flex items-start gap-2">
                        <div className="text-5xl font-light leading-none tracking-tight">{formatCurrency(paymentsTotal, currency)}</div>
                        <span className={`rounded-lg px-2 py-1 text-xs font-semibold mt-1 ${dueBadge.cls}`}>{dueBadge.text}</span>
                    </div>
                    <div className="mt-2 text-sm text-white/60">Total Paid This Period</div>
                </div>
                <div>
                    <div className="flex items-start gap-2">
                        <div className="text-4xl font-light leading-none tracking-tight text-white/90">{formatCurrency(netTax, currency)}</div>
                        <span className="rounded-lg bg-violet-500/20 border border-violet-500/30 px-2 py-1 text-xs font-semibold text-violet-300 mt-1">Liability</span>
                    </div>
                    <div className="mt-2 text-sm text-white/50">Net Tax Liability</div>
                </div>
                {remainingBalance > 0 && (
                    <div>
                        <div className="flex items-start gap-2">
                            <div className="text-3xl font-light leading-none tracking-tight text-rose-400">{formatCurrency(remainingBalance, currency)}</div>
                            <span className="rounded-lg bg-rose-500/20 border border-rose-500/30 px-2 py-1 text-xs font-semibold text-rose-300 mt-1">Owed</span>
                        </div>
                        <div className="mt-2 text-sm text-white/40">Remaining Balance</div>
                    </div>
                )}
            </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
                <select value={selectedPeriod || ""} onChange={e => setSelectedPeriod(e.target.value)}
                    className="h-fit appearance-none rounded-xl bg-violet-600/80 border-0 px-5 py-3 text-sm font-medium text-white focus:outline-none cursor-pointer shadow-[0_8px_24px_rgba(139,92,246,0.25)]">
                    {periods.map(p => <option key={p.period_key} value={p.period_key} className="bg-[#131313]">{p.period_key}</option>)}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-3 top-3.5 text-white/60" />
            </div>
        </div>
    </div>

    {/* Legends */}
    <div className="mb-5 flex items-center gap-5 text-sm">
        <div className="flex items-center gap-2 text-white/80"><span className="h-2.5 w-2.5 rounded-full bg-[#A3E635]" />Payments Made</div>
        <div className="flex items-center gap-2 text-white/50"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Tax Liability</div>
    </div>

    {/* Bar chart */}
    <div className="relative h-[280px] pr-10">
        <div className="absolute right-0 top-0 flex h-full flex-col justify-between text-right text-xs text-white/30">
            <span>High</span><span>Mid</span><span>Low</span><span>Min</span><span>0</span>
        </div>
        <div className="flex h-full items-end justify-between gap-1.5 pr-10">
            {barMonths.map((m, i) => (
                <div key={i} className="flex h-full flex-1 flex-col justify-end gap-2 group cursor-pointer">
                    <div className="flex h-[240px] items-end justify-center gap-0.5">
                        <div className="w-2 rounded-t-full bg-[#A3E635] shadow-[0_0_16px_rgba(163,230,53,0.3)] transition-all group-hover:shadow-[0_0_24px_rgba(163,230,53,0.5)]" style={{ height: `${m.after}px` }} />
                        <div className="w-2 rounded-t-full bg-violet-500 shadow-[0_0_16px_rgba(139,92,246,0.25)] transition-all group-hover:shadow-[0_0_24px_rgba(139,92,246,0.45)]" style={{ height: `${m.before}px` }} />
                    </div>
                    <div className="text-center text-[10px] text-white/35">{m.label}</div>
                </div>
            ))}
        </div>
    </div>
</section>

{/* ── CARD 2: Filing Schedule (4 cols) ── */ }
<section className="col-span-12 xl:col-span-4 rounded-2xl border border-white/5 bg-[#131313]/95 p-6">
    <div className="mb-5 flex items-center justify-between">
        <div>
            <div className="text-[24px] font-semibold text-white">Filing Schedule</div>
            <div className="mt-2 text-sm text-white/50">{periods.length} active periods</div>
        </div>
        <div className="flex gap-2 pt-1">
            <button onClick={() => handleStatusUpdate("REVIEWED")} disabled={snapshot?.status !== "DRAFT"} className="h-10 px-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white/60 hover:text-white disabled:opacity-40 transition-all">Review</button>
            <button onClick={() => handleStatusUpdate("FILED")} disabled={snapshot?.status === "FILED"} className="h-10 px-4 rounded-xl bg-[#A3E635] text-black text-xs font-bold disabled:opacity-40 hover:bg-[#bef264] transition-all shadow-[0_0_16px_rgba(163,230,53,0.25)]">File ↗</button>
        </div>
    </div>

    {/* Status steps */}
    <div className="mb-5 grid grid-cols-4 gap-1 text-center">
        {["Draft", "Reviewed", "Filed", "Paid"].map((step, i) => {
            const progressMap: Record<string, number> = { DRAFT: 1, REVIEWED: 2, FILED: 3 };
            const cur = progressMap[snapshot?.status || "DRAFT"] || 1;
            const done = i < cur; const active = i === cur - 1;
            return (
                <div key={step} className="flex flex-col items-center gap-1.5">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${done || active ? "bg-[#A3E635] text-black" : "bg-white/5 text-white/30"}`}>
                        {done ? "✓" : i + 1}
                    </div>
                    <div className={`text-[10px] font-medium ${active ? "text-white" : done ? "text-[#A3E635]" : "text-white/30"}`}>{step}</div>
                </div>
            );
        })}
    </div>

    {/* AI summary strip */}
    {snapshot?.llm_summary && (
        <div className="mb-4 flex items-start gap-2 bg-violet-500/8 border border-violet-500/20 rounded-xl p-3">
            <Sparkles size={13} className="text-violet-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-violet-200/80 leading-relaxed line-clamp-2">{snapshot.llm_summary}</p>
        </div>
    )}

    {/* Filing items */}
    <div className="space-y-4">
        {schedule.map((group, gi) => (
            <div key={gi}>
                <div className="mb-2 border-t border-white/5 pt-2.5 text-xs text-white/35">{group.day}</div>
                <div className="space-y-2">
                    {group.items.map((item, ii) => (
                        <div key={ii} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-4 py-3.5">
                            <div className="flex items-center gap-3">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm ${item.color}`}>{item.icon}</div>
                                <div>
                                    <div className="text-sm text-white/90 font-medium">{item.title}</div>
                                    <div className="text-xs text-white/40 mt-0.5">{item.time}</div>
                                </div>
                            </div>
                            <button className="text-white/25 hover:text-white/60">⋮</button>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>

    {snapshot?.status === "FILED" && (
        <button onClick={() => setResetOpen(true)} className="mt-4 w-full text-xs text-rose-400/60 hover:text-rose-400 transition-colors">Reset filed return…</button>
    )}
</section>

{/* ── CARD 3: Payments Donut (4 cols) ── */ }
<section className="col-span-12 lg:col-span-4 rounded-2xl border border-white/5 bg-[#131313]/95 p-6">
    <div className="mb-4 flex items-center justify-between">
        <div className="text-[24px] font-semibold">Payments Status</div>
        <button onClick={() => navigate("/companion/tax?tab=payments")} className="flex h-10 w-10 items-center justify-center bg-black/60 border border-white/10 rounded-xl text-white/50 hover:text-white transition-all"><ArrowUpRight size={16} /></button>
    </div>

    {/* Ring chart */}
    <div className="relative mx-auto h-[240px] w-full max-w-[320px] mt-4 overflow-hidden">
        <svg className="w-full h-full" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
            <circle cx="60" cy="60" r="44" fill="none" stroke="#A3E635" strokeWidth="12"
                strokeDasharray={`${2.76 * Math.max(0, Math.min(100, paidPct))} 276`}
                strokeLinecap="round" transform="rotate(-90 60 60)"
                style={{ filter: "drop-shadow(0 0 6px rgba(163,230,53,0.5))" }} />
            <circle cx="60" cy="60" r="44" fill="none" stroke="#8B5CF6" strokeWidth="12"
                strokeDasharray={`${2.76 * Math.max(0, 100 - paidPct)} 276`}
                strokeDashoffset={-2.76 * Math.max(0, Math.min(100, paidPct))}
                strokeLinecap="round" transform="rotate(-90 60 60)"
                style={{ filter: "drop-shadow(0 0 6px rgba(139,92,246,0.3))" }} />
            <text x="60" y="57" textAnchor="middle" fill="white" fontSize="14" fontWeight="300" fontFamily="Inter">{paidPct}%</text>
            <text x="60" y="69" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="6" fontFamily="Inter">paid</text>
        </svg>
    </div>

    {/* Quick stats */}
    <div className="mt-2 space-y-2">
        {[
            { label: "Net Liability", value: formatCurrency(netTax, currency), color: "text-white" },
            { label: "Payments Made", value: formatCurrency(paymentsTotal, currency), color: "text-[#A3E635]" },
            { label: "Remaining", value: formatCurrency(remainingBalance, currency), color: remainingBalance > 0 ? "text-rose-400" : "text-[#A3E635]" },
        ].map(s => (
            <div key={s.label} className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-3 py-2.5">
                <span className="text-xs text-white/40">{s.label}</span>
                <span className={`text-sm font-semibold font-mono ${s.color}`}>{s.value}</span>
            </div>
        ))}
        <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-3 py-2.5">
            <span className="text-xs text-white/40">Status</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${paymentStatus === "PAID" ? "bg-[#A3E635]/20 text-[#A3E635]" : paymentStatus === "UNPAID" ? "bg-rose-500/20 text-rose-400" : "bg-violet-500/20 text-violet-400"}`}>{paymentStatusLabel(paymentStatus)}</span>
        </div>
    </div>
</section>

{/* ── CARD 4: Jurisdiction Pipeline (4 cols) ── */ }
<section className="col-span-12 lg:col-span-4 rounded-2xl border border-white/5 bg-[#131313]/95 p-6">
    <div className="mb-4 flex items-center justify-between">
        <div className="text-[24px] font-semibold">Tax by Jurisdiction</div>
        <button onClick={() => navigate("/companion/tax")} className="flex h-10 w-10 items-center justify-center bg-black/60 border border-white/10 rounded-xl text-white/50 hover:text-white transition-all"><ArrowUpRight size={16} /></button>
    </div>

    <div className="mb-4 flex flex-wrap gap-3 text-xs">
        {[["Fed / GST", "bg-[#A3E635]"], ["State Sales", "bg-violet-500"], ["Payroll", "bg-amber-400"], ["Exempt", "bg-white/30"]].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5 text-white/50"><span className={`h-2 w-2 rounded-full ${c}`} />{l}</div>
        ))}
    </div>

    <div className="mb-3">
        <div className="text-5xl font-light">{formatCurrency(netTax, currency)}</div>
        <div className="mt-1 text-sm text-white/40">Total across {jurisdictions.length || pipelineLabels.length} jurisdictions</div>
    </div>

    <div className="flex items-end gap-1.5 h-[140px] mt-6">
        {pipelineBars.map((h, i) => {
            const pct = i / Math.max(1, pipelineBars.length - 1);
            const color = pct < 0.3 ? "bg-white/50" : pct < 0.5 ? "bg-amber-400" : pct < 0.75 ? "bg-violet-500" : "bg-[#A3E635]";
            return (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1 group cursor-pointer">
                    <div className={`w-full rounded-t-sm ${color} transition-all group-hover:brightness-125`} style={{ height: `${Math.min(h, 140)}px`, boxShadow: "0 0 8px rgba(163,230,53,0.2)" }} />
                    <div className="text-[8px] text-white/25 truncate w-full text-center">{pipelineLabels[i] || ""}</div>
                </div>
            );
        })}
    </div>
</section>

{/* ── CARD 5: AI Companion (4 cols) ── */ }
<section className="col-span-12 lg:col-span-4 rounded-2xl border border-white/5 bg-[#131313]/95 p-6 relative overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(139,92,246,0.22),transparent_28%),radial-gradient(circle_at_65%_15%,rgba(163,230,53,0.12),transparent_26%)]" />
    <div className="relative z-10 h-full flex flex-col justify-between">
        <div>
            <div className="mb-1 flex items-center gap-2">
                <Sparkles size={18} className="text-violet-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">AI Companion</span>
            </div>
            <div className="mb-6 text-[36px] font-light tracking-tight text-white leading-tight">Tax<br />Intelligence</div>
        </div>

        <div className="space-y-2 text-sm text-white/50">
            {[
                { q: "What's my effective tax rate this quarter?", tag: "Rate" },
                { q: "Which jurisdiction has the most exposure?", tag: "Nexus" },
                { q: "Are there any reconciliation gaps?", tag: "Audit" },
                { q: "Summarize this period's anomalies", tag: "Flags" },
            ].map(({ q, tag }) => (
                <div key={q} onClick={() => navigate("/ai-companion")} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-4 py-2.5 cursor-pointer hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group">
                    <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors truncate pr-2">{q}</span>
                    <span className="text-[9px] font-bold text-violet-400 bg-violet-500/15 border border-violet-500/20 px-1.5 py-0.5 rounded-md shrink-0">{tag}</span>
                </div>
            ))}
        </div>

        <div className="mt-5 flex justify-end">
            <button onClick={handleEnrich} disabled={enriching || !selectedPeriod}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white shadow-[0_8px_24px_rgba(139,92,246,0.3)] hover:bg-violet-500 transition-all disabled:opacity-50 flex items-center gap-2">
                <Sparkles size={14} />{enriching ? "Analyzing…" : "Run AI Audit"}
            </button>
        </div>
    </div>
</section>

{/* ── CARD 6: Anomalies table (full width) ── */ }
<section className="col-span-12 rounded-2xl border border-white/5 bg-[#131313]/70 overflow-hidden">
    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="text-lg font-semibold text-white">Tax Anomalies</div>
            {openAnomalies.length > 0 && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${highAnomalies.length > 0 ? "bg-rose-500/15 text-rose-400 border border-rose-500/25" : "bg-amber-500/15 text-amber-400 border border-amber-500/25"}`}>{openAnomalies.length} open</span>}
        </div>
        <div className="flex items-center gap-2">
            {(["all", "high", "medium", "low"] as const).map(s => (
                <button key={s} onClick={() => setSeverityFilter(s as any)} className={`px-3 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all border ${(severityFilter || "all") === s ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : "border-white/5 bg-black/30 text-white/30 hover:text-white/60"}`}>
                    {s === "all" ? "All" : s}
                </button>
            ))}
        </div>
    </div>

    {anomalies.length === 0 ? (
        <div className="py-10 text-center text-white/30 text-sm flex flex-col items-center gap-2">
            <ShieldCheck size={28} className="text-[#A3E635]/40" />
            No anomalies detected for {selectedPeriod}. All clear!
        </div>
    ) : (
        <table className="w-full text-sm">
            <thead><tr className="text-[10px] uppercase tracking-wider text-white/25 border-b border-white/5 bg-black/20">
                {["Severity", "Code", "Description", "Expected", "Actual", "Diff", "Status", ""].map(h => <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-white/[0.04]">
                {anomalies.filter((a: TaxAnomaly) => !severityFilter || severityFilter === "all" || a.severity === severityFilter).slice(0, 8).map((a: TaxAnomaly) => {
                    const sevCol = a.severity === "high" ? "text-rose-400 bg-rose-400/10" : a.severity === "medium" ? "text-amber-400 bg-amber-400/10" : "text-sky-400 bg-sky-400/10";
                    const stCol = a.status === "RESOLVED" ? "text-[#A3E635]" : a.status === "ACKNOWLEDGED" ? "text-sky-400" : "text-amber-400";
                    return (
                        <tr key={a.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${sevCol}`}>{a.severity}</span></td>
                            <td className="px-5 py-3.5 font-mono text-xs text-white/70">{a.code}</td>
                            <td className="px-5 py-3.5 text-white/60 text-xs max-w-[240px] truncate">{a.description}</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-white/50">{a.expected_tax_amount ? formatCurrency(a.expected_tax_amount, currency) : "—"}</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-white/50">{a.actual_tax_amount ? formatCurrency(a.actual_tax_amount, currency) : "—"}</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-rose-400">{a.difference && a.difference !== 0 ? formatCurrency(a.difference, currency) : "—"}</td>
                            <td className="px-5 py-3.5"><span className={`text-[10px] font-semibold ${stCol}`}>{a.status}</span></td>
                            <td className="px-5 py-3.5">
                                {a.status === "OPEN" && (
                                    <button onClick={async () => { try { await updateAnomalyStatus(selectedPeriod!, a.id, "RESOLVED", "all"); showToast("Resolved", "success"); } catch (e: any) { showToast(e.message, "error"); } }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg px-2.5 py-1 text-[10px] font-semibold bg-[#A3E635]/10 text-[#A3E635] border border-[#A3E635]/20 hover:bg-[#A3E635]/20 flex items-center gap-1">
                                        <CheckCircle2 size={10} />Resolve
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    )}
</section>

              </div > {/* end grid */ }
            </main >

          </div > {/* end grid cols */ }
        </div > {/* end rounded container */ }
      </div > {/* end outer padding */ }
    </div >
  );
};

export default TaxGuardianPage;
