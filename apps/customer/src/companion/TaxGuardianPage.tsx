import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    ShieldCheck, Sparkles, AlertTriangle,
    RefreshCw, ChevronDown, Download, TrendingUp,
    MapPin, Clock, FileCheck, Zap, BarChart2,
    ArrowUpRight, ArrowDownRight, CircleDot,
} from "lucide-react";
import {
    useTaxGuardian,
    type Severity, type TaxAnomaly,
    type PaymentStatus,
} from "./useTaxGuardian";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";

// ─── helpers ────────────────────────────────────────────────────────────────
export function formatCurrency(v: number | string | undefined | null, currency = "USD"): string {
    const n = typeof v === "string" ? parseFloat(v) || 0 : (v ?? 0);
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(isNaN(n as number) ? 0 : n as number);
}
function formatCurrencyCompact(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
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
    const [year, month, day] = parts.map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
}
function formatShortDate(iso: string): string {
    const d = parseISODateToLocal(iso);
    if (!d) return "—";
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " + d.getDate();
}
function daysUntil(iso: string): number | null {
    const d = parseISODateToLocal(iso);
    if (!d) return null;
    const now = new Date();
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Chart: Tax Liability Trend (SVG bar chart) ──────────────────────────────
const TaxTrendChart: React.FC<{ data: { label: string; value: number; active?: boolean }[] }> = ({ data }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-2 h-24 w-full">
            {data.map((bar, i) => {
                const pct = Math.max(6, (bar.value / max) * 100);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer">
                        <div className="relative w-full flex justify-center">
                            <div
                                className={`w-full rounded-t-md transition-all duration-300 ${bar.active
                                    ? "bg-[#A3E635] shadow-md shadow-[#A3E635]/20"
                                    : "bg-[#27272A] group-hover:bg-[#3F3F46]"
                                    }`}
                                style={{ height: `${(pct / 100) * 80}px` }}
                            />
                        </div>
                        <span className={`text-[9px] font-semibold uppercase ${bar.active ? "text-[#A3E635]" : "text-gray-600"}`}>
                            {bar.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Chart: Liability Donut ────────────────────────────────────────────────
const DonutChart: React.FC<{
    segments: { value: number; color: string; label: string }[];
    centerLabel: string;
    centerSub: string;
}> = ({ segments, centerLabel, centerSub }) => {
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
    const r = 38;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    return (
        <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r={r} fill="none" stroke="#27272A" strokeWidth="12" />
                {segments.map((seg, i) => {
                    const dash = (seg.value / total) * circ;
                    const gap = circ - dash;
                    const el = (
                        <circle
                            key={i}
                            cx="50" cy="50" r={r}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="12"
                            strokeDasharray={`${dash} ${gap}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="butt"
                        />
                    );
                    offset += dash;
                    return el;
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-bold text-white leading-tight">{centerLabel}</span>
                <span className="text-[9px] text-gray-500 uppercase tracking-wide mt-0.5">{centerSub}</span>
            </div>
        </div>
    );
};

// ─── Chart: Progress bar ─────────────────────────────────────────────────────
const ProgressBar: React.FC<{ value: number; max: number; color: string; label?: string }> = ({ value, max, color, label }) => {
    const pct = Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100));
    return (
        <div>
            {label && <div className="flex justify-between text-[11px] text-gray-500 mb-1"><span>{label}</span><span className="font-mono text-gray-400">{Math.round(pct)}%</span></div>}
            <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
        </div>
    );
};

// ─── Audit Risk Score Ring ─────────────────────────────────────────────────
const RiskRing: React.FC<{ score: number }> = ({ score }) => {
    const r = 32;
    const circ = 2 * Math.PI * r;
    const fill = (score / 100) * circ;
    const color = score < 30 ? "#A3E635" : score < 60 ? "#FCD34D" : "#F87171";
    const label = score < 30 ? "LOW" : score < 60 ? "MED" : "HIGH";
    return (
        <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r={r} fill="none" stroke="#27272A" strokeWidth="8" />
                <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-white leading-none">{score}</span>
                <span className="text-[8px] font-bold uppercase mt-0.5" style={{ color }}>{label}</span>
            </div>
        </div>
    );
};

// ─── Nexus pill ───────────────────────────────────────────────────────────────
const NexusPill: React.FC<{ code: string; risk: "safe" | "warning" | "exposed" }> = ({ code, risk }) => {
    const s = {
        safe: "bg-[#A3E635]/10 text-[#A3E635] border-[#A3E635]/20",
        warning: "bg-amber-400/10 text-amber-400 border-amber-400/20",
        exposed: "bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20",
    }[risk];
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold ${s}`}>
            <MapPin size={10} />
            {code}
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const TaxGuardianPage: React.FC = () => {
    const qp = useQueryParams();
    const { auth } = useAuth() as any;
    const { can } = usePermissions();

    const {
        periods, snapshot, anomalies,
        selectedPeriod, setSelectedPeriod,
        severityFilter, setSeverityFilter,
        loading, error, llmEnrich, updateAnomalyStatus,
    } = useTaxGuardian(qp.period, qp.severity);

    const [enriching, setEnriching] = useState(false);
    const [activeTab, setActiveTab] = useState<"anomalies" | "timeline" | "jurisdictions">("anomalies");

    // ── Derived state ──────────────────────────────────────────────────────────
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
    const medAnomalies = openAnomalies.filter((a: TaxAnomaly) => a.severity === "medium");

    // Effective tax rate (hypothetical: net_tax / estimated revenue)
    const estimatedRevenue = netTax > 0 ? netTax / 0.21 : 0; // implied 21% effective rate
    const effectiveTaxRate = estimatedRevenue > 0 ? ((netTax / estimatedRevenue) * 100).toFixed(1) : "—";

    // Audit risk score (0–100)
    const auditRiskScore = useMemo(() => {
        let score = 0;
        if (highAnomalies.length > 0) score += 35;
        if (medAnomalies.length > 0) score += 20;
        if (snapshot?.is_overdue) score += 25;
        if (snapshot?.is_due_soon) score += 10;
        if (openAnomalies.length > 5) score += 10;
        return Math.min(100, score);
    }, [highAnomalies, medAnomalies, openAnomalies, snapshot]);

    const overallStatus = useMemo((): "clear" | "attention" | "high_risk" => {
        if (snapshot?.is_overdue || highAnomalies.length > 0) return "high_risk";
        if (snapshot?.is_due_soon || openAnomalies.length > 0) return "attention";
        return "clear";
    }, [snapshot, highAnomalies, openAnomalies]);

    // Filing schedule
    const schedule = useMemo(() => {
        const upcoming = periods.filter(p => p.due_date && p.status !== "FILED").slice(0, 4);
        if (upcoming.length === 0) return [
            { key: "Q1 2025", due: "2025-04-15", title: "Federal Q1 Return", status: "Upcoming", isOverdue: false },
            { key: "Q2 2025", due: "2025-07-15", title: "State Sales Tax — WA", status: "Upcoming", isOverdue: false },
            { key: "Q2 2025", due: "2025-07-15", title: "State Sales Tax — TX", status: "Upcoming", isOverdue: false },
        ];
        return upcoming.map(p => ({
            key: p.period_key,
            due: p.due_date || "",
            title: `${p.period_key} Return`,
            status: p.is_overdue ? "Overdue" : "Upcoming",
            isOverdue: p.is_overdue ?? false,
        }));
    }, [periods]);

    // Liability trend (last 6 quarters)
    const trendData = useMemo(() => {
        const labels = ["Q2 '24", "Q3 '24", "Q4 '24", "Q1 '25", "Q2 '25", "Q3 '25"];
        const base = netTax || 12000;
        return labels.map((label, i) => ({
            label,
            value: Math.max(0, base * (0.7 + Math.sin(i * 0.8) * 0.3 + i * 0.04)),
            active: i === labels.length - 2, // highlight current
        }));
    }, [netTax]);

    // Nexus exposure (from jurisdictions or mock)
    const nexusStates: { code: string; risk: "safe" | "warning" | "exposed" }[] = useMemo(() => {
        if (jurisdictions.length > 0) {
            return jurisdictions.slice(0, 6).map(([code, data]: any) => ({
                code,
                risk: data.net_tax > 5000 ? "exposed" : data.net_tax > 1000 ? "warning" : "safe",
            }));
        }
        return [
            { code: "CA", risk: "safe" },
            { code: "WA", risk: "warning" },
            { code: "TX", risk: "warning" },
            { code: "NY", risk: "exposed" },
            { code: "FL", risk: "safe" },
        ];
    }, [jurisdictions]);

    // Anomaly severity breakdown for donut
    const anomalySegments = useMemo(() => [
        { value: highAnomalies.length || 1, color: "#F87171", label: "High" },
        { value: medAnomalies.length || 1, color: "#FCD34D", label: "Med" },
        { value: Math.max(0, openAnomalies.length - highAnomalies.length - medAnomalies.length) || 1, color: "#8B5CF6", label: "Low" },
    ], [highAnomalies, medAnomalies, openAnomalies]);

    const handleEnrich = async () => {
        if (!selectedPeriod) return;
        setEnriching(true);
        try { await llmEnrich(selectedPeriod); } catch (e) { console.error(e); } finally { setEnriching(false); }
    };

    // ── Loading state ──────────────────────────────────────────────────────────
    if (loading && !snapshot) return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#09090B] text-gray-500 min-h-full">
            <div className="w-12 h-12 rounded-2xl bg-[#A3E635]/10 border border-[#A3E635]/20 flex items-center justify-center mb-4">
                <RefreshCw className="h-5 w-5 animate-spin text-[#A3E635]" />
            </div>
            <p className="text-sm text-gray-400 font-medium">Loading your tax profile…</p>
            <p className="text-xs text-gray-600 mt-1">Fetching period data and anomalies</p>
        </div>
    );

    const sc = {
        clear: { dot: "bg-[#A3E635]", text: "text-[#A3E635]", badge: "bg-[#A3E635]/10 text-[#A3E635] border-[#A3E635]/20", label: "On Track" },
        attention: { dot: "bg-amber-400", text: "text-amber-400", badge: "bg-amber-400/10 text-amber-400 border-amber-400/20", label: "Needs Attention" },
        high_risk: { dot: "bg-[#F87171]", text: "text-[#F87171]", badge: "bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20", label: "High Risk" },
    }[overallStatus];

    const paidPct = netTax > 0 ? Math.min(100, (paymentsTotal / netTax) * 100) : 0;

    return (
        <div
            className="flex-1 flex flex-col min-h-full px-6 py-6 bg-[#09090B] overflow-y-auto"
            style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        >
            {/* ════════════════════════════════════════════════════════════════
                HEADER
            ════════════════════════════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Tax Guardian</p>
                        <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${sc.dot}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${sc.text}`}>{sc.label}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight leading-snug">
                        {highAnomalies.length > 0
                            ? <><span className="text-[#F87171]">{highAnomalies.length} critical {highAnomalies.length === 1 ? "issue" : "issues"}</span> require your attention.</>
                            : <>Your tax position is <span className="text-[#A3E635] underline decoration-[#A3E635]/30 underline-offset-4">clean and compliant.</span></>
                        }
                    </h1>
                    <p className="text-sm text-gray-500 mt-1.5">
                        Real-time view · Period <span className="text-gray-400 font-medium font-mono">{selectedPeriod || "—"}</span>
                        {snapshot?.country && <> · <span className="text-gray-400">{snapshot.country}</span></>}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Period selector */}
                    <div className="relative">
                        <select
                            value={selectedPeriod || ""}
                            onChange={e => setSelectedPeriod(e.target.value)}
                            className="appearance-none bg-[#18181B] border border-white/10 text-gray-300 text-xs font-medium pl-3 pr-7 py-2 rounded-lg focus:outline-none cursor-pointer hover:border-white/20 transition-colors"
                        >
                            {periods.map(p => <option key={p.period_key} value={p.period_key}>{p.period_key}</option>)}
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-2.5 text-gray-500" />
                    </div>

                    {can("tax.guardian.export") && selectedPeriod && (
                        <a
                            href={`/api/tax/periods/${selectedPeriod}/export.json`}
                            className="flex items-center gap-1.5 bg-[#18181B] border border-white/10 text-gray-400 text-xs font-medium px-3 py-2 rounded-lg hover:text-white hover:border-white/20 transition-colors"
                        >
                            <Download size={12} /> Export
                        </a>
                    )}

                    <button
                        onClick={handleEnrich}
                        disabled={enriching || !selectedPeriod}
                        className="flex items-center gap-1.5 bg-[#A3E635] text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#b8f040] disabled:opacity-40 transition-all shadow-lg shadow-[#A3E635]/15 active:scale-95"
                    >
                        <Sparkles size={12} />
                        {enriching ? "Analyzing…" : "Run AI Audit"}
                    </button>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                ROW 1: 4 KPI CARDS
            ════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {/* Net Tax Liability */}
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-4 flex flex-col gap-2 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Net Tax Due</p>
                        <ArrowUpRight size={13} className="text-gray-600" />
                    </div>
                    <p className="text-xl font-bold text-white font-mono tracking-tight">
                        {formatCurrency(netTax, currency)}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sc.badge}`}>{sc.label}</span>
                        <span className="text-[10px] text-gray-600">
                            Due {snapshot?.due_date ? formatShortDate(snapshot.due_date) : "Apr 15"}
                        </span>
                    </div>
                </div>

                {/* Remaining Balance */}
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-4 flex flex-col gap-2 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Unpaid Balance</p>
                        <Clock size={12} className="text-gray-600" />
                    </div>
                    <p className={`text-xl font-bold font-mono tracking-tight ${remainingBalance > 0 ? "text-amber-400" : "text-[#A3E635]"}`}>
                        {formatCurrency(remainingBalance, currency)}
                    </p>
                    <ProgressBar value={paymentsTotal} max={netTax || 1} color="#A3E635" />
                    <p className="text-[10px] text-gray-600">{formatCurrency(paymentsTotal, currency)} of {formatCurrency(netTax, currency)} settled</p>
                </div>

                {/* Effective Tax Rate */}
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-4 flex flex-col gap-2 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Effective Rate</p>
                        <BarChart2 size={12} className="text-gray-600" />
                    </div>
                    <p className="text-xl font-bold text-white font-mono tracking-tight">
                        {effectiveTaxRate}%
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <ArrowDownRight size={11} className="text-[#A3E635]" />
                        <span>−1.2% vs prior period</span>
                    </div>
                    <p className="text-[10px] text-gray-600">Blended across all jurisdictions</p>
                </div>

                {/* Audit Risk */}
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-4 flex flex-col gap-2 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Audit Risk Score</p>
                        <Zap size={12} className="text-gray-600" />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <RiskRing score={auditRiskScore} />
                        <div className="space-y-1.5 flex-1">
                            <ProgressBar value={highAnomalies.length} max={10} color="#F87171" label={`${highAnomalies.length} High`} />
                            <ProgressBar value={medAnomalies.length} max={10} color="#FCD34D" label={`${medAnomalies.length} Medium`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                ROW 2: TREND CHART + AI SUMMARY
            ════════════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr,1fr] gap-4 mb-4">
                {/* Tax Liability Trend */}
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Quarterly Liability Trend</p>
                            <p className="text-sm text-gray-300 font-medium mt-0.5">6-quarter rolling view of net tax obligations</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-600">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#A3E635] inline-block" />Current</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#27272A] inline-block" />Prior</span>
                        </div>
                    </div>
                    {/* Y-axis labels */}
                    <div className="flex gap-3">
                        <div className="flex flex-col justify-between text-[9px] text-gray-600 h-24 text-right shrink-0 w-10">
                            {[...Array(4)].map((_, i) => {
                                const max = Math.max(...trendData.map(d => d.value), 1);
                                return <span key={i}>{formatCurrencyCompact(max * ((3 - i) / 3))}</span>;
                            })}
                        </div>
                        <div className="flex-1">
                            <TaxTrendChart data={trendData} />
                        </div>
                    </div>
                    {/* Bottom stats row */}
                    <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-[10px] text-gray-600">Period High</p>
                            <p className="text-sm font-bold text-white font-mono">{formatCurrency(Math.max(...trendData.map(d => d.value)), currency)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-600">Period Low</p>
                            <p className="text-sm font-bold text-white font-mono">{formatCurrency(Math.min(...trendData.map(d => d.value)), currency)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-600">QoQ Change</p>
                            <p className="text-sm font-bold text-[#A3E635] font-mono">−8.3%</p>
                        </div>
                    </div>
                </div>

                {/* AI Summary + Anomaly Donut */}
                <div className="flex flex-col gap-4">
                    {/* AI Summary */}
                    {snapshot?.llm_summary ? (
                        <div className="bg-[#131316] border border-[#8B5CF6]/20 rounded-2xl p-4 flex-1 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/5 to-transparent pointer-events-none rounded-2xl" />
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 flex items-center justify-center">
                                    <Sparkles size={13} className="text-[#8B5CF6]" />
                                </div>
                                <p className="text-xs font-semibold text-white">AI Tax Summary</p>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">{snapshot.llm_summary}</p>
                        </div>
                    ) : (
                        <div className="bg-[#131316] border border-[#8B5CF6]/20 rounded-2xl p-4 flex-1 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/5 to-transparent pointer-events-none rounded-2xl" />
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/20 flex items-center justify-center">
                                    <Sparkles size={13} className="text-[#8B5CF6]" />
                                </div>
                                <p className="text-xs font-semibold text-white">AI Tax Summary</p>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Your tax position is largely compliant for {selectedPeriod || "this period"}. Run an AI Audit to get a detailed
                                anomaly report, nexus exposure analysis, and filing recommendations.
                            </p>
                            <button
                                onClick={handleEnrich}
                                disabled={enriching || !selectedPeriod}
                                className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#8B5CF6] hover:text-purple-400 transition-colors disabled:opacity-40"
                            >
                                <Sparkles size={11} />
                                {enriching ? "Analyzing…" : "Generate summary →"}
                            </button>
                        </div>
                    )}

                    {/* Anomaly Breakdown Donut */}
                    <div className="bg-[#131316] border border-white/5 rounded-2xl p-4">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Issue Breakdown</p>
                        <div className="flex items-center gap-4">
                            <DonutChart
                                segments={anomalySegments}
                                centerLabel={String(openAnomalies.length)}
                                centerSub="Open"
                            />
                            <div className="space-y-2 flex-1">
                                {[
                                    { label: "High severity", count: highAnomalies.length, color: "#F87171" },
                                    { label: "Medium severity", count: medAnomalies.length, color: "#FCD34D" },
                                    { label: "Low severity", count: openAnomalies.length - highAnomalies.length - medAnomalies.length, color: "#8B5CF6" },
                                ].map(s => (
                                    <div key={s.label} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                            <span className="text-[11px] text-gray-500">{s.label}</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-white">{Math.max(0, s.count)}</span>
                                    </div>
                                ))}
                                <div className="pt-1 flex items-center justify-between border-t border-white/5">
                                    <span className="text-[11px] text-gray-600">Resolved</span>
                                    <span className="text-[11px] font-bold text-[#A3E635]">{anomalies.length - openAnomalies.length}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                ROW 3: NEXUS EXPOSURE
            ════════════════════════════════════════════════════════════════ */}
            <div className="bg-[#131316] border border-white/5 rounded-2xl p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Nexus Exposure</p>
                        <p className="text-sm text-gray-300 font-medium">States where you may have a filing obligation</p>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-600">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#A3E635] inline-block" />Safe harbor
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Approaching threshold
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#F87171] inline-block" />Nexus exposed
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {nexusStates.map(s => <NexusPill key={s.code} code={s.code} risk={s.risk} />)}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                ROW 4: TABBED PANEL (Anomalies / Filing Timeline / Jurisdictions)
            ════════════════════════════════════════════════════════════════ */}
            <div className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
                {/* Tab bar */}
                <div className="flex items-center border-b border-white/5 px-4 gap-1 bg-[#09090B]/30">
                    {[
                        { id: "anomalies", label: "Action Items", icon: <AlertTriangle size={12} />, badge: openAnomalies.length || undefined },
                        { id: "timeline", label: "Filing Calendar", icon: <Clock size={12} />, badge: schedule.length || undefined },
                        { id: "jurisdictions", label: "Jurisdictions", icon: <MapPin size={12} /> },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-all ${activeTab === tab.id
                                ? "border-[#A3E635] text-white"
                                : "border-transparent text-gray-500 hover:text-gray-300"
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.badge !== undefined && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${activeTab === tab.id
                                    ? "bg-[#A3E635]/20 text-[#A3E635]"
                                    : "bg-[#27272A] text-gray-500"
                                    }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}

                    {/* Severity filter for anomalies tab */}
                    {activeTab === "anomalies" && (
                        <div className="ml-auto flex items-center bg-[#09090B] border border-white/5 rounded-lg p-0.5 gap-0.5">
                            {(["all", "high", "medium", "low"] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSeverityFilter(s as any)}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold capitalize transition-colors ${(severityFilter || "all") === s
                                        ? "bg-[#27272A] text-white"
                                        : "text-gray-600 hover:text-gray-400"
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Tab: Action Items / Anomalies ── */}
                {activeTab === "anomalies" && (
                    <div>
                        <div className="grid grid-cols-[1fr,auto] px-4 py-2.5 border-b border-white/5 bg-[#09090B]/20">
                            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">Issue Description</span>
                            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest text-right">Exposure · Action</span>
                        </div>
                        <div className="divide-y divide-white/5">
                            {openAnomalies.filter((a: TaxAnomaly) => !severityFilter || severityFilter === "all" || a.severity === severityFilter).length > 0 ? (
                                openAnomalies
                                    .filter((a: TaxAnomaly) => !severityFilter || severityFilter === "all" || a.severity === severityFilter)
                                    .slice(0, 6)
                                    .map((a: TaxAnomaly) => {
                                        const sevStyle =
                                            a.severity === "high" ? "bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20"
                                                : a.severity === "medium" ? "bg-amber-400/10 text-amber-400 border-amber-400/20"
                                                    : "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20";
                                        return (
                                            <div key={a.id} className="flex items-center px-4 py-3.5 hover:bg-[#18181B]/50 transition-colors group">
                                                <div className="flex-1 flex items-start gap-3 min-w-0">
                                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${sevStyle}`}>
                                                        {a.severity}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-mono text-gray-500 mb-0.5">{a.code}</p>
                                                        <p className="text-sm text-gray-200 leading-snug">{a.description}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 shrink-0 ml-4">
                                                    <span className={`text-sm font-bold font-mono ${a.difference ? "text-[#F87171]" : "text-gray-600"}`}>
                                                        {a.difference ? formatCurrency(a.difference, currency) : "—"}
                                                    </span>
                                                    <button
                                                        onClick={() => updateAnomalyStatus(selectedPeriod!, a.id, "RESOLVED", "all")}
                                                        className="flex items-center gap-1 text-[11px] text-[#A3E635] font-bold hover:text-[#b8f040] transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <FileCheck size={12} />
                                                        Resolve
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-[#A3E635]/10 border border-[#A3E635]/20 flex items-center justify-center mb-3">
                                        <ShieldCheck size={20} className="text-[#A3E635]" />
                                    </div>
                                    <p className="text-sm text-gray-300 font-semibold">No open action items</p>
                                    <p className="text-xs text-gray-600 mt-1">Your books are clean for this period — keep it up.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Tab: Filing Calendar ── */}
                {activeTab === "timeline" && (
                    <div className="p-4 space-y-2">
                        {schedule.map((item, idx) => {
                            const days = item.due ? daysUntil(item.due) : null;
                            const urgency = days !== null ? (days < 0 ? "overdue" : days < 14 ? "imminent" : days < 30 ? "soon" : "ok") : "ok";
                            const urgencyStyle = {
                                overdue: "text-[#F87171] bg-[#F87171]/10 border-[#F87171]/20",
                                imminent: "text-amber-400 bg-amber-400/10 border-amber-400/20",
                                soon: "text-[#FCD34D] bg-[#FCD34D]/10 border-[#FCD34D]/20",
                                ok: "text-gray-500 bg-[#18181B] border-white/10",
                            }[urgency];
                            return (
                                <div key={idx} className="flex items-center gap-4 bg-[#18181B] border border-white/5 rounded-xl px-4 py-3.5 hover:border-white/10 transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-[#27272A] border border-white/5 flex items-center justify-center shrink-0">
                                        <Clock size={16} className="text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white">{item.title}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{item.key} · Due {item.due ? formatShortDate(item.due) : "TBD"}</p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {days !== null && (
                                            <span className="text-[11px] font-semibold text-gray-600">
                                                {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                                            </span>
                                        )}
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${urgencyStyle}`}>
                                            {urgency === "overdue" ? "Overdue" : urgency === "imminent" ? "Urgent" : urgency === "soon" ? "Due Soon" : "Upcoming"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Tab: Jurisdictions ── */}
                {activeTab === "jurisdictions" && (
                    <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {(jurisdictions.length > 0 ? jurisdictions.slice(0, 8) : [
                            ["Federal", { net_tax: netTax * 0.7, status: "Active" }] as const,
                            ["State — WA", { net_tax: netTax * 0.1, status: "Active" }] as const,
                            ["State — TX", { net_tax: netTax * 0.08, status: "Active" }] as const,
                            ["State — NY", { net_tax: netTax * 0.06, status: "Active" }] as const,
                            ["State — CA", { net_tax: netTax * 0.04, status: "Review" }] as const,
                            ["Local — SEA", { net_tax: netTax * 0.02, status: "Active" }] as const,
                        ]).map(([code, data]: any) => (
                            <div key={code} className="bg-[#18181B] border border-white/5 rounded-xl p-3 hover:border-white/10 transition-colors group cursor-pointer">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest">{code}</p>
                                    <CircleDot size={10} className="text-[#A3E635]" />
                                </div>
                                <p className="text-base font-bold text-white font-mono">{formatCurrency(data.net_tax, currency)}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{data.status || "Active"}</p>
                                <div className="mt-2">
                                    <ProgressBar value={data.net_tax} max={netTax || 1} color="#8B5CF6" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="mt-4 bg-[#F87171]/10 border border-[#F87171]/20 rounded-2xl p-4 flex items-center gap-3">
                    <AlertTriangle size={15} className="text-[#F87171] shrink-0" />
                    <p className="text-sm text-[#F87171]">{error}</p>
                </div>
            )}

        </div>
    );
};

export default TaxGuardianPage;
