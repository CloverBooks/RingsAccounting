import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    AlertTriangle, RefreshCw, CheckCircle2, ChevronDown, Download,
    Sparkles, FileText, ShieldCheck, X, Check, Search, TrendingUp,
    ArrowUpRight, ArrowDownRight, CreditCard, Trash2, Pencil,
    MoreHorizontal, Calendar, Globe, Zap, Clock,
} from "lucide-react";
import {
    useTaxGuardian,
    type Severity, type Status, type TaxAnomaly,
    type PaymentStatus, type TaxPayment, type TaxPaymentKind,
} from "./useTaxGuardian";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";

// ─── Helpers ────────────────────────────────────────────────────────────────

export function formatCurrency(v: number | string | undefined | null, currency = "USD"): string {
    const n = typeof v === "string" ? parseFloat(v) || 0 : v || 0;
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(isNaN(n as number) ? 0 : n as number);
}

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

function paymentStatusLabel(s: PaymentStatus | null | undefined): string {
    const map: Record<string, string> = {
        PAID: "Paid", PARTIALLY_PAID: "Partial", UNPAID: "Unpaid", OVERPAID: "Overpaid",
        SETTLED_ZERO: "Settled", NO_LIABILITY: "No Liability", REFUND_DUE: "Refund Due",
        REFUND_PARTIALLY_RECEIVED: "Partial Refund", REFUND_RECEIVED: "Refunded", REFUND_OVERRECEIVED: "Over-Refunded",
    };
    return s ? (map[s] ?? "Unknown") : "—";
}

function paymentStatusColor(s: PaymentStatus | null | undefined): string {
    if (!s) return "text-slate-400 bg-slate-400/10 border-slate-400/20";
    if (["PAID", "REFUND_RECEIVED", "SETTLED_ZERO", "NO_LIABILITY"].includes(s)) return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    if (["PARTIALLY_PAID", "REFUND_PARTIALLY_RECEIVED"].includes(s)) return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    if (["UNPAID", "REFUND_DUE"].includes(s)) return "text-rose-400 bg-rose-400/10 border-rose-400/20";
    return "text-sky-400 bg-sky-400/10 border-sky-400/20";
}

function periodSortKey(k: string): number {
    const q = k.match(/^Q([1-4])\s+(\d{4})$/);
    if (q) return Number(q[2]) * 10 + Number(q[1]);
    const m = k.match(/^(\d{4})-(\d{2})$/);
    if (m) return Number(m[1]) * 100 + Number(m[2]);
    return 0;
}

// ─── Tiny Toast ─────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: string; onClose: () => void }) {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
    const colors = type === "error" ? "bg-rose-500/90" : type === "success" ? "bg-emerald-500/90" : "bg-sky-500/90";
    return (
        <div className={cx("fixed top-5 right-5 z-[100] flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-md border border-white/10", colors)}>
            {message}
            <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
    );
}

// ─── Glass card helper ───────────────────────────────────────────────────────

const Glass = ({ children, className = "", hover = false }: any) => (
    <div className={cx(
        "rounded-2xl border border-white/[0.07] bg-white/[0.04] backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]",
        hover && "transition-all hover:border-white/[0.12] hover:bg-white/[0.07] hover:shadow-lg",
        className
    )}>{children}</div>
);

// ─── Page ───────────────────────────────────────────────────────────────────

function useQueryParams() {
    const { search } = useLocation();
    const p = new URLSearchParams(search);
    return { period: p.get("period") ?? undefined, severity: p.get("severity") as Severity | undefined };
}

const TaxGuardianPage: React.FC = () => {
    const qp = useQueryParams();
    const { auth } = useAuth();
    const { can } = usePermissions();
    const userName = auth?.user?.firstName || auth?.user?.username || "there";
    const navigate = useNavigate();
    const location = useLocation();

    const {
        periods, snapshot, anomalies, bankAccounts,
        selectedPeriod, setSelectedPeriod,
        severityFilter, setSeverityFilter,
        loading, error, refresh, llmEnrich,
        resetPeriod, createPayment, updatePayment, deletePayment,
        updatePeriodStatus, updateAnomalyStatus,
    } = useTaxGuardian(qp.period, qp.severity);

    const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
    const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
    const [enriching, setEnriching] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [resetReason, setResetReason] = useState("");
    const [resetting, setResetting] = useState(false);
    const [paymentSaving, setPaymentSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "payments" | "anomalies" | "filings">("overview");
    const [paymentForm, setPaymentForm] = useState<{
        id: string | null; kind: TaxPaymentKind; bank_account_id: string;
        amount: string; payment_date: string; method: string; reference: string; notes: string;
    }>({ id: null, kind: "PAYMENT", bank_account_id: "", amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "EFT", reference: "", notes: "" });

    const showToast = (message: string, type: "success" | "error" | "info") => setToast({ message, type });

    const filteredAnomalies = useMemo(() => anomalies.filter((a: TaxAnomaly) => {
        if (severityFilter !== "all" && a.severity !== severityFilter) return false;
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        return true;
    }), [anomalies, severityFilter, statusFilter]);

    useEffect(() => {
        if (!selectedPeriod) return;
        const p = new URLSearchParams(location.search);
        p.set("period", selectedPeriod);
        if (severityFilter !== "all") p.set("severity", severityFilter); else p.delete("severity");
        navigate({ pathname: location.pathname, search: p.toString() ? `?${p}` : "" }, { replace: true });
    }, [location.pathname, location.search, navigate, selectedPeriod, severityFilter]);

    const handleEnrich = async () => {
        if (!selectedPeriod) return;
        setEnriching(true);
        try { await llmEnrich(selectedPeriod); showToast("AI analysis complete", "success"); }
        catch (e: any) { showToast(e.message || "AI analysis failed", "error"); }
        finally { setEnriching(false); }
    };
    const handleStatusUpdate = async (s: string) => {
        if (!selectedPeriod) return;
        try { await updatePeriodStatus(selectedPeriod, s); showToast(`Status updated to ${s}`, "success"); }
        catch (e: any) { showToast(e.message || "Update failed", "error"); }
    };
    const handleAnomalyAction = async (id: string, status: Status) => {
        if (!selectedPeriod) return;
        try { await updateAnomalyStatus(selectedPeriod, id, status, statusFilter); showToast("Anomaly updated", "success"); }
        catch (e: any) { showToast(e.message || "Failed", "error"); }
    };
    const handleResetPeriod = async () => {
        if (!selectedPeriod) return;
        setResetting(true);
        try { await resetPeriod(selectedPeriod, resetReason); setResetOpen(false); setResetReason(""); showToast("Period reset", "success"); }
        catch (e: any) { showToast(e.message || "Reset failed", "error"); }
        finally { setResetting(false); }
    };
    const savePayment = async () => {
        if (!selectedPeriod) return;
        setPaymentSaving(true);
        try {
            if (!paymentForm.amount.trim()) throw new Error("Amount required");
            if (!paymentForm.bank_account_id) throw new Error("Bank account required");
            const payload = { kind: paymentForm.kind, bank_account_id: paymentForm.bank_account_id, amount: paymentForm.amount, payment_date: paymentForm.payment_date, method: paymentForm.method, reference: paymentForm.reference, notes: paymentForm.notes };
            if (paymentForm.id) { await updatePayment(selectedPeriod, paymentForm.id, payload); showToast("Payment updated", "success"); }
            else { await createPayment(selectedPeriod, payload); showToast("Payment recorded", "success"); }
            setPaymentForm(f => ({ ...f, id: null, amount: "", reference: "", notes: "" }));
        } catch (e: any) { showToast(e.message || "Failed", "error"); }
        finally { setPaymentSaving(false); }
    };

    const netTax = useMemo(() => {
        if (!snapshot) return 0;
        if (snapshot.net_tax !== undefined && snapshot.net_tax !== null) return snapshot.net_tax;
        return Object.values(snapshot.summary_by_jurisdiction || {}).reduce((s: number, j: any) => s + (j.net_tax || 0), 0);
    }, [snapshot]);

    useEffect(() => {
        if (paymentForm.id) return;
        if (!bankAccounts?.length) return;
        if (!paymentForm.bank_account_id) setPaymentForm(f => ({ ...f, bank_account_id: bankAccounts[0].id }));
    }, [bankAccounts, paymentForm.bank_account_id, paymentForm.id]);

    const currency = snapshot?.country === "US" ? "USD" : "CAD";
    const payments: TaxPayment[] = (snapshot?.payments as any) || [];
    const paymentsTotal = snapshot?.payments_total ?? 0;
    const remainingBalance = snapshot?.remaining_balance ?? (netTax - paymentsTotal);
    const paymentStatus = snapshot?.payment_status as PaymentStatus | null;
    const trendPeriods = useMemo(() => {
        const s = [...periods].sort((a, b) => periodSortKey(a.period_key) - periodSortKey(b.period_key));
        return s.slice(Math.max(0, s.length - 8));
    }, [periods]);
    const jurisdictions = Object.entries(snapshot?.summary_by_jurisdiction || {});
    const dueBadge = useMemo(() => {
        if (snapshot?.is_overdue) return { text: "Overdue", cls: "text-rose-400 bg-rose-400/10 border-rose-400/20" };
        if (snapshot?.is_due_soon) return { text: "Due Soon", cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" };
        return { text: "On Track", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" };
    }, [snapshot]);

if (loading && !snapshot) return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center"><RefreshCw className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-3" /><p className="text-sm text-slate-400">Loading Tax Guardian...</p></div>
    </div>
);

const openAnomalies = anomalies.filter((a: TaxAnomaly) => a.status === "OPEN");
const highAnomalies = openAnomalies.filter((a: TaxAnomaly) => a.severity === "high");

return (
    <div className="min-h-screen bg-[#0A0A0F] text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {/* Background blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
            <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-600/8 blur-[100px]" />
            <div className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-600/5 blur-[80px]" />
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/* Reset Dialog */}
        {resetOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <Glass className="w-full max-w-md p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div><h2 className="text-base font-semibold text-white">Reset Filed Return</h2><p className="mt-1 text-xs text-slate-400">This will reopen the period. Transactions are preserved.</p></div>
                        <button onClick={() => setResetOpen(false)} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
                    </div>
                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">Reason (optional)</label>
                    <input value={resetReason} onChange={e => setResetReason(e.target.value)} placeholder="e.g., Filing was premature" className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" />
                    <div className="mt-4 flex justify-end gap-3">
                        <button onClick={() => setResetOpen(false)} className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white border border-white/10">Cancel</button>
                        <button onClick={handleResetPeriod} disabled={resetting} className="rounded-xl px-4 py-2 text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 disabled:opacity-50">
                            {resetting ? "Resetting…" : "Reset Return"}
                        </button>
                    </div>
                </Glass>
            </div>
        )}

        <div className="relative mx-auto max-w-[1400px] px-4 py-6 md:px-8">
            {/* ── Header ── */}
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
                        <span>Tax Guardian</span>
                        <span>/</span>
                        <span className="text-slate-300">{selectedPeriod || "No Period"}</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Tax Center</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {highAnomalies.length > 0 ? (
                            <span className="text-rose-400">{highAnomalies.length} high-priority issue{highAnomalies.length > 1 ? "s" : ""} require attention</span>
                        ) : (
                            <span className="text-emerald-400">No high-priority issues · </span>
                        )}
                        <span className="text-slate-500">{selectedPeriod}</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Period selector */}
                    <div className="relative">
                        <select value={selectedPeriod || ""} onChange={e => setSelectedPeriod(e.target.value)}
                            className="h-9 appearance-none rounded-xl bg-white/[0.06] border border-white/10 pl-3 pr-8 text-sm text-white focus:outline-none focus:border-violet-500/50 cursor-pointer">
                            {periods.map(p => <option key={p.period_key} value={p.period_key} className="bg-[#1a1a2e]">{p.period_key}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    </div>

                    <button onClick={handleEnrich} disabled={enriching || !selectedPeriod}
                        className="flex h-9 items-center gap-2 rounded-xl bg-violet-600/20 border border-violet-500/30 px-4 text-sm font-medium text-violet-300 hover:bg-violet-600/30 transition-all disabled:opacity-50">
                        <Sparkles className="h-4 w-4" />
                        {enriching ? "Analyzing…" : "AI Audit"}
                    </button>

                    {can("tax.guardian.export") && selectedPeriod && (
                        <a href={`/api/tax/periods/${selectedPeriod}/export.json`}
                            className="flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/[0.10] transition-all">
                            <Download className="h-4 w-4" />Export
                        </a>
                    )}

                    {snapshot?.status === "FILED" && (
                        <button onClick={() => setResetOpen(true)} className="flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/[0.10]">
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* ── AI Summary Banner ── */}
            {snapshot?.llm_summary && (
                <Glass className="mb-6 p-4 flex items-start gap-4" style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.08),rgba(16,16,28,0.6))" }}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30">
                        <Sparkles className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-violet-400 mb-1">AI Companion Analysis</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{snapshot.llm_summary}</p>
                    </div>
                </Glass>
            )}

            {/* ── KPI Row ── */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                    { label: "Net Tax Liability", value: formatCurrency(netTax, currency), badge: dueBadge.text, badgeCls: dueBadge.cls, icon: <TrendingUp className="h-4 w-4" />, iconBg: "bg-violet-500/20 text-violet-400" },
                    { label: "Payments Made", value: formatCurrency(paymentsTotal, currency), badge: `${payments.length} txn${payments.length !== 1 ? "s" : ""}`, badgeCls: "text-sky-400 bg-sky-400/10 border-sky-400/20", icon: <CreditCard className="h-4 w-4" />, iconBg: "bg-sky-500/20 text-sky-400" },
                    { label: "Remaining Balance", value: formatCurrency(remainingBalance, currency), badge: paymentStatusLabel(paymentStatus), badgeCls: paymentStatusColor(paymentStatus), icon: <CheckCircle2 className="h-4 w-4" />, iconBg: remainingBalance <= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400" },
                    { label: "Open Anomalies", value: String(openAnomalies.length), badge: highAnomalies.length > 0 ? `${highAnomalies.length} High` : "All Clear", badgeCls: highAnomalies.length > 0 ? "text-rose-400 bg-rose-400/10 border-rose-400/20" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <AlertTriangle className="h-4 w-4" />, iconBg: highAnomalies.length > 0 ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400" },
                ].map((k, i) => (
                    <Glass key={i} className="p-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className={cx("flex h-8 w-8 items-center justify-center rounded-lg", k.iconBg)}>{k.icon}</div>
                            <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", k.badgeCls)}>{k.badge}</span>
                        </div>
                        <p className="text-2xl font-bold text-white tracking-tight">{k.value}</p>
                        <p className="mt-1 text-xs text-slate-500">{k.label}</p>
                    </Glass>
                ))}
            </div>

            {/* ── Period History Scroller ── */}
            {trendPeriods.length > 1 && (
                <div className="mb-6 overflow-x-auto">
                    <div className="flex gap-3 pb-1 min-w-max">
                        {trendPeriods.map(p => {
                            const isSel = p.period_key === selectedPeriod;
                            const statusCls = p.payment_status ? paymentStatusColor(p.payment_status as PaymentStatus) : "text-slate-500 bg-slate-500/10 border-slate-500/20";
                            return (
                                <button key={p.period_key} onClick={() => setSelectedPeriod(p.period_key)}
                                    className={cx("rounded-xl border px-4 py-3 text-left transition-all min-w-[150px]",
                                        isSel ? "border-violet-500/50 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]" : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.06]")}>
                                    <div className="text-xs font-semibold text-slate-300">{p.period_key}</div>
                                    <div className="mt-1.5 text-base font-bold text-white">{formatCurrency(p.net_tax, currency)}</div>
                                    <span className={cx("mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusCls)}>
                                        {paymentStatusLabel(p.payment_status as PaymentStatus)}
                                    </span>
                                    {(p.anomaly_counts?.high ?? 0) > 0 && (
                                        <span className="ml-1.5 inline-block rounded-full bg-rose-400/10 border border-rose-400/20 text-rose-400 px-1.5 py-0.5 text-[10px] font-bold">{p.anomaly_counts.high}H</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Tab Nav ── */}
            <div className="mb-6 flex gap-1 rounded-xl bg-white/[0.04] border border-white/[0.07] p-1 w-fit">
                {(["overview", "payments", "anomalies", "filings"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={cx("rounded-lg px-4 py-2 text-sm font-medium transition-all capitalize",
                            activeTab === tab ? "bg-white/[0.10] text-white shadow-sm" : "text-slate-500 hover:text-slate-300")}>
                        {tab}
                        {tab === "anomalies" && openAnomalies.length > 0 && (
                            <span className={cx("ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold", highAnomalies.length > 0 ? "bg-rose-500/20 text-rose-400" : "bg-slate-500/20 text-slate-400")}>
                                {openAnomalies.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Overview Tab ── */}
            {activeTab === "overview" && (
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    {/* Left: Trend Chart + Jurisdiction Breakdown */}
                    <div className="space-y-6">
                        {/* Trend Chart */}
                        <Glass className="p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-semibold text-white">Tax Liability Trend</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Net liability vs total payments across periods</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-400">
                                    <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded-full bg-violet-500 inline-block" /><span>Liability</span></span>
                                    <span className="flex items-center gap-1.5"><span className="h-2 w-5 rounded-full bg-emerald-500 inline-block" /><span>Paid</span></span>
                                </div>
                            </div>
                            {(() => {
                                const W = 500, H = 140;
                                const maxV = Math.max(10, ...trendPeriods.map(p => Math.max(Number(p.net_tax) || 0, Number(p.payments_total) || 0)));
                                const mkPath = (key: string) => trendPeriods.map((p, i) => {
                                    const v = Number((p as any)[key]) || 0;
                                    const x = trendPeriods.length < 2 ? W / 2 : (i / (trendPeriods.length - 1)) * (W - 40) + 20;
                                    const y = H - (v / maxV) * (H - 20) - 10;
                                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                                }).join(" ");
                                const mkFill = (key: string, color: string) => trendPeriods.length < 2 ? null : (() => {
                                    const pts = trendPeriods.map((p, i) => {
                                        const v = Number((p as any)[key]) || 0;
                                        const x = (i / (trendPeriods.length - 1)) * (W - 40) + 20;
                                        const y = H - (v / maxV) * (H - 20) - 10;
                                        return `${x},${y}`;
                                    });
                                    return <path d={`M ${pts[0]} L ${pts.join(" L ")} L ${(W - 20)},${H} L 20,${H} Z`} fill={color} opacity={0.08} />;
                                })();
                                return (
                                    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
                                        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: 140 }}>
                                            {[0, 25, 50, 75, 100].map(pct => {
                                                const y = H - (pct / 100) * (H - 20) - 10;
                                                return <g key={pct}><line x1={20} x2={W - 20} y1={y} y2={y} stroke="white" strokeOpacity={0.04} strokeDasharray="3 4" /><text x={15} y={y + 4} fontSize={9} fill="#52525b" textAnchor="end">{(maxV * pct / 100 / 1000).toFixed(0)}k</text></g>;
                                            })}
                                            {mkFill("net_tax", "#8b5cf6")}
                                            {mkFill("payments_total", "#10b981")}
                                            {trendPeriods.length > 0 && <>
                                                <path d={mkPath("net_tax")} fill="none" stroke="#8b5cf6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                                                <path d={mkPath("payments_total")} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
                                            </>}
                                            {trendPeriods.map((p, i) => {
                                                const v = Number(p.net_tax) || 0;
                                                const x = trendPeriods.length < 2 ? W / 2 : (i / (trendPeriods.length - 1)) * (W - 40) + 20;
                                                const y = H - (v / maxV) * (H - 20) - 10;
                                                return <g key={i}><circle cx={x} cy={y} r={3.5} fill="#8b5cf6" className="cursor-pointer" /><text x={x} y={H + 12} fontSize={9} fill="#52525b" textAnchor="middle">{p.period_key.replace("20", "'")}</text></g>;
                                            })}
                                        </svg>
                                    </div>
                                );
                            })()}
                        </Glass>

                        {/* Jurisdiction Breakdown */}
                        <Glass className="p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-semibold text-white">Tax by Jurisdiction</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">{jurisdictions.length} active jurisdiction{jurisdictions.length !== 1 ? "s" : ""}</p>
                                </div>
                                <Globe className="h-4 w-4 text-slate-500" />
                            </div>
                            {jurisdictions.length === 0 ? (
                                <p className="text-sm text-slate-500 py-4 text-center">No jurisdiction data for this period</p>
                            ) : (
                                <div className="space-y-3">
                                    {jurisdictions.map(([code, data]: [string, any]) => {
                                        const jNet = data.net_tax || 0;
                                        const pct = netTax > 0 ? Math.round((jNet / netTax) * 100) : 0;
                                        return (
                                            <div key={code} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 hover:bg-white/[0.05] transition-all">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">{code === "US" || code === "WA" || code === "TX" || code === "NY" || code === "CA" ? "🇺🇸" : code === "CA_GST" ? "🇨🇦" : "🌐"}</span>
                                                        <span className="text-sm font-semibold text-white">{code}</span>
                                                        {data.status && <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-semibold", data.status === "FILED" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-slate-400 bg-slate-400/10 border-slate-400/20")}>{data.status}</span>}
                                                    </div>
                                                    <span className="text-sm font-bold text-white">{formatCurrency(jNet, currency)}</span>
                                                </div>
                                                <div className="flex gap-2 text-xs text-slate-500 mb-2">
                                                    {data.taxable_sales && <span>Taxable: {formatCurrency(data.taxable_sales, currency)}</span>}
                                                    {data.exempt_sales && <span>Exempt: {formatCurrency(data.exempt_sales, currency)}</span>}
                                                </div>
                                                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                                                    <div className="h-full rounded-full bg-violet-500/60 transition-all" style={{ width: `${pct}%` }} />
                                                </div>
                                                <p className="mt-1 text-right text-[10px] text-slate-600">{pct}% of total</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Glass>
                    </div>

                    {/* Right: Status + Quick Actions + Filing Timeline */}
                    <div className="space-y-5">
                        {/* Period Status Card */}
                        <Glass className="p-5" style={{ background: "linear-gradient(135deg,rgba(139,92,246,0.07),rgba(10,10,15,0.8))" }}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-white">Filing Status</h3>
                                <span className={cx("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                                    snapshot?.status === "FILED" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
                                        snapshot?.status === "REVIEWED" ? "text-sky-400 bg-sky-400/10 border-sky-400/20" :
                                            "text-amber-400 bg-amber-400/10 border-amber-400/20")}>
                                    {snapshot?.status || "Draft"}
                                </span>
                            </div>
                            {snapshot?.due_date && (
                                <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Due {new Date(snapshot.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                                    <span className={cx("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", dueBadge.cls)}>{dueBadge.text}</span>
                                </div>
                            )}
                            {/* Filing steps */}
                            {[
                                { label: "Draft created", done: true },
                                { label: "Transactions reviewed", done: (openAnomalies.length === 0) },
                                { label: "Period reviewed", done: ["REVIEWED", "FILED"].includes(snapshot?.status || "") },
                                { label: "Return filed", done: snapshot?.status === "FILED" },
                            ].map((step, i) => (
                                <div key={i} className="flex items-center gap-3 py-2 border-b border-white/[0.05] last:border-0">
                                    <div className={cx("flex h-5 w-5 items-center justify-center rounded-full shrink-0", step.done ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.05] text-slate-600")}>
                                        {step.done ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                    </div>
                                    <span className={cx("text-xs", step.done ? "text-slate-300" : "text-slate-600")}>{step.label}</span>
                                </div>
                            ))}
                            <div className="mt-5 grid grid-cols-2 gap-2">
                                <button onClick={() => handleStatusUpdate("REVIEWED")} disabled={snapshot?.status !== "DRAFT"}
                                    className="rounded-xl py-2.5 text-xs font-semibold bg-white/[0.06] border border-white/10 text-slate-300 hover:bg-white/[0.10] disabled:opacity-40 transition-all">
                                    Mark Reviewed
                                </button>
                                <button onClick={() => handleStatusUpdate("FILED")} disabled={snapshot?.status === "FILED"}
                                    className="rounded-xl py-2.5 text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                                    File Return
                                </button>
                            </div>
                        </Glass>

                        {/* Quick Links */}
                        <Glass className="p-5">
                            <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
                            <div className="space-y-1.5">
                                {[
                                    { label: "View Tax Settings", to: "/companion/tax/settings", icon: <Zap className="h-3.5 w-3.5" /> },
                                    { label: "Tax Rate Catalog", to: "/companion/tax/catalog", icon: <FileText className="h-3.5 w-3.5" /> },
                                    { label: "Product Tax Rules", to: "/companion/tax/product-rules", icon: <Globe className="h-3.5 w-3.5" /> },
                                ].map(l => (
                                    <Link key={l.to} to={l.to} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all">
                                        <span className="text-violet-400">{l.icon}</span>{l.label}
                                        <ArrowUpRight className="h-3 w-3 ml-auto opacity-50" />
                                    </Link>
                                ))}
                                {can("tax.guardian.export") && selectedPeriod && (<>
                                    <a href={`/api/tax/periods/${selectedPeriod}/export.csv`} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"><Download className="h-3.5 w-3.5 text-sky-400" />Export CSV<ArrowUpRight className="h-3 w-3 ml-auto opacity-50" /></a>
                                    <a href={`/api/tax/periods/${selectedPeriod}/anomalies/export.csv`} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" />Anomalies CSV<ArrowUpRight className="h-3 w-3 ml-auto opacity-50" /></a>
                                </>)}
                            </div>
                        </Glass>

                        {/* Anomaly Summary mini */}
                        <Glass className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-white">Anomaly Summary</h3>
                                <button onClick={() => setActiveTab("anomalies")} className="text-xs text-violet-400 hover:text-violet-300">View All</button>
                            </div>
                            {[{ sev: "high", label: "High", cls: "text-rose-400 bg-rose-400/10 border-rose-400/20" }, { sev: "medium", label: "Medium", cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" }, { sev: "low", label: "Low", cls: "text-sky-400 bg-sky-400/10 border-sky-400/20" }].map(sv => {
                                const count = anomalies.filter((a: TaxAnomaly) => a.severity === sv.sev && a.status === "OPEN").length;
                                return (
                                    <div key={sv.sev} className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
                                        <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-semibold", sv.cls)}>{sv.label}</span>
                                        <span className="text-sm font-bold text-white">{count}</span>
                                    </div>
                                );
                            })}
                        </Glass>
                    </div>
                </div>
            )}

            {/* ── Payments Tab ── */}
            {activeTab === "payments" && (
                <div className="space-y-6">
                    <Glass className="overflow-hidden">
                        <div className="p-5 border-b border-white/[0.07] flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-white">Payments &amp; Refunds</h2>
                                <p className="text-xs text-slate-500 mt-0.5">{payments.length} transaction{payments.length !== 1 ? "s" : ""} · Net {formatCurrency(paymentsTotal, currency)}</p>
                            </div>
                        </div>
                        {payments.length === 0 ? (
                            <div className="py-16 text-center text-sm text-slate-500">No payments recorded for {selectedPeriod}.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/[0.05]">
                                        {["Date", "Type", "Method", "Reference", "Amount", ""].map(h => <th key={h} className="px-5 py-3 text-left font-semibold">{h}</th>)}
                                    </tr></thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                        {payments.map((p: TaxPayment) => (
                                            <tr key={p.id} className="group hover:bg-white/[0.03] transition-colors">
                                                <td className="px-5 py-3.5 text-slate-300 tabular-nums">{p.payment_date?.slice(0, 10)}</td>
                                                <td className="px-5 py-3.5"><span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", p.kind === "REFUND" ? "text-sky-400 bg-sky-400/10 border-sky-400/20" : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20")}>{p.kind || "PAYMENT"}</span></td>
                                                <td className="px-5 py-3.5 text-slate-400">{p.method}</td>
                                                <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{p.reference || "—"}</td>
                                                <td className="px-5 py-3.5 font-semibold text-white tabular-nums">{p.kind === "REFUND" ? "+" : ""}{formatCurrency(p.amount, currency)}</td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setPaymentForm({ id: p.id, kind: p.kind || "PAYMENT", bank_account_id: p.bank_account_id || "", amount: String(p.amount), payment_date: (p.payment_date || "").slice(0, 10), method: p.method || "EFT", reference: p.reference || "", notes: p.notes || "" })} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.08]"><Pencil className="h-3.5 w-3.5" /></button>
                                                        <button onClick={async () => { if (confirm("Delete this payment?")) { try { await deletePayment(selectedPeriod!, p.id); showToast("Deleted", "success"); } catch (e: any) { showToast(e.message, "error"); } } }} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-400/10"><Trash2 className="h-3.5 w-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Glass>

                    {/* Add Payment Form */}
                    <Glass className="p-6">
                        <h3 className="text-sm font-semibold text-white mb-5">{paymentForm.id ? "Edit Payment" : "Record New Transaction"}</h3>
                        <div className="mb-4 flex gap-2">
                            {(["PAYMENT", "REFUND"] as TaxPaymentKind[]).map(k => (
                                <button key={k} onClick={() => setPaymentForm(f => ({ ...f, kind: k }))}
                                    className={cx("rounded-xl px-4 py-2 text-xs font-semibold border transition-all", paymentForm.kind === k ? (k === "PAYMENT" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-sky-500/20 border-sky-500/40 text-sky-300") : "bg-white/[0.04] border-white/[0.07] text-slate-500 hover:text-slate-300")}>
                                    {k === "PAYMENT" ? "Payment to Agency" : "Refund Received"}
                                </button>
                            ))}
                        </div>
                        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                            {[
                                { label: "Amount", col: 1, el: <input value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="mt-1 w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" /> },
                                { label: "Date", col: 1, el: <input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} className="mt-1 w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50" /> },
                                { label: "Bank Account", col: 2, el: <select value={paymentForm.bank_account_id} onChange={e => setPaymentForm(f => ({ ...f, bank_account_id: e.target.value }))} className="mt-1 w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 bg-[#0a0a0f]"><option value="">Select…</option>{bankAccounts.map(b => <option key={b.id} value={b.id} className="bg-[#1a1a2e]">{b.name}</option>)}</select> },
                                { label: "Method", col: 1, el: <select value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))} className="mt-1 w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 bg-[#0a0a0f]"><option>EFT</option><option>Cheque</option><option>Card</option><option>ACH</option><option>Wire</option><option>Other</option></select> },
                                { label: "Reference", col: 1, el: <input value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} placeholder="CRA ref…" className="mt-1 w-full rounded-xl bg-white/[0.05] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50" /> },
                            ].map((field, i) => <div key={i} className={`md:col-span-${field.col}`}><label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{field.label}</label>{field.el}</div>)}
                        </div>
                        <div className="mt-5 flex justify-end gap-3">
                            {paymentForm.id && <button onClick={() => setPaymentForm(f => ({ ...f, id: null, amount: "", reference: "", notes: "" }))} className="rounded-xl px-4 py-2 text-xs font-medium border border-white/[0.07] text-slate-400 hover:text-white">Cancel Edit</button>}
                            <button onClick={savePayment} disabled={paymentSaving || !selectedPeriod || !paymentForm.bank_account_id}
                                className="rounded-xl px-5 py-2 text-xs font-bold bg-violet-600/30 border border-violet-500/50 text-violet-200 hover:bg-violet-600/40 transition-all disabled:opacity-50">
                                {paymentSaving ? "Saving…" : paymentForm.id ? "Update Payment" : "Record Payment"}
                            </button>
                        </div>
                    </Glass>
                </div>
            )}

            {/* ── Anomalies Tab ── */}
            {activeTab === "anomalies" && (
                <div>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <div className="flex gap-2">
                            {(["all", "high", "medium", "low"] as const).map(s => (
                                <button key={s} onClick={() => setSeverityFilter(s as any)}
                                    className={cx("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all border",
                                        severityFilter === s ? "border-violet-500/50 bg-violet-500/20 text-violet-300" : "border-white/[0.07] bg-white/[0.04] text-slate-500 hover:text-slate-300")}>
                                    {s === "all" ? "All Severity" : s}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 ml-2">
                            {(["all", "OPEN", "RESOLVED", "ACKNOWLEDGED"] as const).map(s => (
                                <button key={s} onClick={() => setStatusFilter(s as any)}
                                    className={cx("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all border",
                                        statusFilter === s ? "border-violet-500/50 bg-violet-500/20 text-violet-300" : "border-white/[0.07] bg-white/[0.04] text-slate-500 hover:text-slate-300")}>
                                    {s === "all" ? "All Status" : s.toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredAnomalies.length === 0 ? (
                        <Glass className="py-24 text-center">
                            <ShieldCheck className="h-12 w-12 text-emerald-400/50 mx-auto mb-3" />
                            <p className="text-base font-semibold text-white">All Clear</p>
                            <p className="text-sm text-slate-500 mt-1">No anomalies match the current filters.</p>
                        </Glass>
                    ) : (
                        <div className="space-y-3">
                            {filteredAnomalies.map((a: TaxAnomaly) => {
                                const sevCls = a.severity === "high" ? "text-rose-400 bg-rose-400/10 border-rose-400/20" : a.severity === "medium" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-sky-400 bg-sky-400/10 border-sky-400/20";
                                const stCls = a.status === "RESOLVED" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : a.status === "ACKNOWLEDGED" ? "text-sky-400 bg-sky-400/10 border-sky-400/20" : "text-amber-400 bg-amber-400/10 border-amber-400/20";
                                return (
                                    <Glass key={a.id} hover className="p-5">
                                        <div className="flex items-start gap-4">
                                            <div className="pt-0.5 shrink-0">
                                                <div className={cx("h-2 w-2 rounded-full mt-1.5", a.severity === "high" ? "bg-rose-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]" : a.severity === "medium" ? "bg-amber-400" : "bg-sky-400")} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                    <span className="text-xs font-bold text-white font-mono uppercase tracking-wide">{a.code}</span>
                                                    <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", sevCls)}>{a.severity}</span>
                                                    <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", stCls)}>{a.status}</span>
                                                    {a.jurisdiction_code && <span className="rounded-full bg-violet-400/10 border border-violet-400/20 text-violet-400 px-2 py-0.5 text-[10px] font-semibold">{a.jurisdiction_code}</span>}
                                                </div>
                                                <p className="text-sm text-slate-300 leading-relaxed">{a.description}</p>
                                                {(a.expected_tax_amount || a.actual_tax_amount) && (
                                                    <div className="mt-2.5 flex gap-4 text-xs text-slate-500">
                                                        {a.expected_tax_amount && <span>Expected: <span className="text-slate-300 font-mono">{formatCurrency(a.expected_tax_amount, currency)}</span></span>}
                                                        {a.actual_tax_amount && <span>Actual: <span className="text-slate-300 font-mono">{formatCurrency(a.actual_tax_amount, currency)}</span></span>}
                                                        {a.difference && <span>Diff: <span className="text-rose-400 font-mono">{formatCurrency(a.difference, currency)}</span></span>}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="shrink-0 flex items-center gap-1.5">
                                                {a.linked_model && a.linked_id && (
                                                    <Link to={`/${a.linked_model === "Invoice" ? "invoices" : "expenses"}/${a.linked_id}`}
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.08]">
                                                        <FileText className="h-4 w-4" />
                                                    </Link>
                                                )}
                                                {a.status === "OPEN" && <>
                                                    <button onClick={() => handleAnomalyAction(a.id, "ACKNOWLEDGED")} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.07]">Acknowledge</button>
                                                    <button onClick={() => handleAnomalyAction(a.id, "RESOLVED")} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40"><Check className="h-3.5 w-3.5" />Resolve</button>
                                                </>}
                                            </div>
                                        </div>
                                    </Glass>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Filings Tab ── */}
            {activeTab === "filings" && (
                <div className="space-y-6">
                    {snapshot?.line_mappings && Object.keys(snapshot.line_mappings).length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {Object.entries(snapshot.line_mappings).map(([code, lines]: [string, any]) => (
                                <Glass key={code} className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{code === "CA" || code.startsWith("CA_") ? "🇨🇦" : "🇺🇸"}</span>
                                            <div>
                                                <p className="text-sm font-semibold text-white">{code === "CA" ? "GST/HST" : code === "QC" ? "QST" : code}</p>
                                                <p className="text-xs text-slate-500">{code} Jurisdiction</p>
                                            </div>
                                        </div>
                                        <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", snapshot.status === "FILED" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-slate-400 bg-slate-400/10 border-slate-400/20")}>{snapshot.status || "Draft"}</span>
                                    </div>
                                    <div className="space-y-2.5">
                                        {Object.entries(lines).slice(0, 6).map(([lineCode, amount]: [string, any]) => (
                                            <div key={lineCode} className="flex items-center justify-between">
                                                <span className="text-xs text-slate-400 capitalize">{lineCode.replace(/_/g, " ")}</span>
                                                <span className="text-xs font-semibold text-white font-mono">{formatCurrency(amount, currency)}</span>
                                            </div>
                                        ))}
                                        {lines.net_tax !== undefined && (
                                            <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/[0.07]">
                                                <span className="text-sm font-semibold text-white">Net Payable</span>
                                                <span className="text-sm font-bold text-white font-mono">{formatCurrency(lines.net_tax, currency)}</span>
                                            </div>
                                        )}
                                    </div>
                                </Glass>
                            ))}
                        </div>
                    ) : (
                        <Glass className="py-24 text-center">
                            <FileText className="h-12 w-12 text-slate-500/50 mx-auto mb-3" />
                            <p className="text-base font-semibold text-white">No Filing Data</p>
                            <p className="text-sm text-slate-500 mt-1">Run the AI Audit to generate filing line mappings.</p>
                            <button onClick={handleEnrich} disabled={enriching} className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600/30 inline-flex items-center gap-2 disabled:opacity-50"><Sparkles className="h-4 w-4" />{enriching ? "Analyzing…" : "Run AI Audit"}</button>
                        </Glass>
                    )}
                </div>
            )}
        </div>
    </div>
);
};

export default TaxGuardianPage;
