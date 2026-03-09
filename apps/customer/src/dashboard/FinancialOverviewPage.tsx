// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { buildApiUrl, getAccessToken } from "../api/client";
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, Sparkles, ChevronRight,
  MoreHorizontal, ArrowRightLeft, ArrowRight, MapPin, CheckCircle2,
  Zap, GitBranch, TrendingUp, TrendingDown, Receipt,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardMetrics {
  cash_on_hand?: number;
  expenses_month?: number;
  revenue_month?: number;
  burn_rate_pct?: number;
}

const fmt = (n?: number, compact = false) => {
  if (n == null) return "—";
  if (compact && Math.abs(n) >= 1_000)
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD",
      notation: "compact", maximumFractionDigits: 1
    }).format(n);
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0
  }).format(n);
};

// ─────────────────────────────────────────────────────────────────────────────
//    Chart data — 8 months actual + 4 projected
// ─────────────────────────────────────────────────────────────────────────────

const CHART_DATA = [
  { month: "Aug", actual: 88_000, projected: null },
  { month: "Sep", actual: 102_000, projected: null },
  { month: "Oct", actual: 95_000, projected: null },
  { month: "Nov", actual: 118_000, projected: null },
  { month: "Dec", actual: 132_000, projected: null },
  { month: "Jan", actual: 110_000, projected: null },
  { month: "Feb", actual: 124_000, projected: null },
  { month: "Today", actual: 124_010, projected: 124_010 }, // join point
  { month: "Apr", actual: null, projected: 138_000 },
  { month: "May", actual: null, projected: 155_000 },
  { month: "Jun", actual: null, projected: 172_000 },
];

// ─────────────────────────────────────────────────────────────────────────────
//    Custom Recharts Tooltip
// ─────────────────────────────────────────────────────────────────────────────

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18181B]/90 backdrop-blur-xl border border-white/15 rounded-2xl px-4 py-3 shadow-2xl pointer-events-none"
      style={{ fontFamily: "'Inter', sans-serif" }}>
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-2">{label}</p>
      {payload.map((p: any) => p.value != null && (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[11px] text-gray-400 capitalize">
            {p.dataKey === "actual" ? "Actual" : "AI Projected"}
          </span>
          <span className="text-[12px] font-mono font-bold text-white ml-1">
            {fmt(p.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Interactive Cashflow Chart
// ─────────────────────────────────────────────────────────────────────────────

const CashflowChart: React.FC = () => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={CHART_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
      <defs>
        <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#A3E635" stopOpacity={0.25} />
          <stop offset="95%" stopColor="#A3E635" stopOpacity={0.01} />
        </linearGradient>
        <linearGradient id="gradProj" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.22} />
          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.01} />
        </linearGradient>
      </defs>

      <CartesianGrid
        strokeDasharray="3 3"
        stroke="rgba(255,255,255,0.04)"
        vertical={false}
      />

      <XAxis
        dataKey="month"
        tick={{ fill: "#6b7280", fontSize: 10, fontFamily: "Inter" }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        tickFormatter={(v) => `$${v / 1000}k`}
        tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "Inter" }}
        axisLine={false}
        tickLine={false}
        width={38}
      />

      <Tooltip
        content={<CustomTooltip />}
        cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
      />

      <ReferenceLine
        x="Today"
        stroke="rgba(255,255,255,0.15)"
        strokeDasharray="4 3"
        label={{ value: "Today", position: "top", fill: "white", fontSize: 9, fontFamily: "Inter" }}
      />

      <Area
        type="monotone"
        dataKey="actual"
        stroke="#A3E635"
        strokeWidth={2.5}
        fill="url(#gradActual)"
        dot={{ fill: "#09090B", stroke: "#A3E635", strokeWidth: 2, r: 3 }}
        activeDot={{ fill: "#A3E635", stroke: "#09090B", strokeWidth: 2, r: 5 }}
        connectNulls={false}
      />
      <Area
        type="monotone"
        dataKey="projected"
        stroke="#8B5CF6"
        strokeWidth={2}
        strokeDasharray="5 4"
        fill="url(#gradProj)"
        dot={{ fill: "#09090B", stroke: "#8B5CF6", strokeWidth: 2, r: 3 }}
        activeDot={{ fill: "#8B5CF6", stroke: "#09090B", strokeWidth: 2, r: 5 }}
        connectNulls={false}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Glass card variants
// ─────────────────────────────────────────────────────────────────────────────

/** Heavy glass: frosted dark panel with border glow and inner highlight */
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  accent?: "lime" | "purple" | "none";
  onClick?: () => void;
}> = ({ children, className = "", accent = "none", onClick }) => {
  const glowMap = {
    lime: "shadow-[0_0_0_1px_rgba(163,230,53,0.12),0_8px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]",
    purple: "shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_8px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]",
    none: "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]",
  };
  const hoverMap = {
    lime: "hover:shadow-[0_0_0_1px_rgba(163,230,53,0.25),0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]",
    purple: "hover:shadow-[0_0_0_1px_rgba(139,92,246,0.3),0_8px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]",
    none: "hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]",
  };
  return (
    <div
      onClick={onClick}
      className={[
        "relative rounded-[24px] overflow-hidden transition-all duration-300",
        "bg-[rgba(19,19,22,0.72)] backdrop-blur-[18px]",
        "border border-white/[0.06]",
        glowMap[accent],
        hoverMap[accent],
        onClick ? "cursor-pointer" : "",
        className,
      ].join(" ")}
    >
      {/* Inner top sheen */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      {/* Inner bottom subtle shadow line */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/4 to-transparent pointer-events-none" />
      {children}
    </div>
  );
};

/** Lighter mini glass: for sub-cards inside a GlassCard */
const MiniGlass: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={[
    "rounded-xl border border-white/[0.07] backdrop-blur-sm",
    "bg-[rgba(255,255,255,0.03)]",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    className,
  ].join(" ")}>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Small sub-components
// ─────────────────────────────────────────────────────────────────────────────

const SparkBars: React.FC<{ color?: string }> = ({ color = "#A3E635" }) => {
  const bars = useMemo(() =>
    Array.from({ length: 14 }, () => Math.floor(Math.random() * 70) + 20), []);
  return (
    <div className="flex items-end gap-[2px] h-7 mt-2">
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all"
          style={{ height: `${h}%`, backgroundColor: color, opacity: i > 9 ? 0.95 : 0.25 }} />
      ))}
    </div>
  );
};

const QuickAction: React.FC<{ icon: React.ReactNode; label: string; onClick?: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-2 group">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200
            bg-[rgba(255,255,255,0.04)] border border-white/[0.07] backdrop-blur-sm
            shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
            text-gray-400
            group-hover:bg-[rgba(163,230,53,0.1)] group-hover:border-[#A3E635]/30 group-hover:text-[#A3E635]
            group-hover:shadow-[0_0_16px_rgba(163,230,53,0.15),inset_0_1px_0_rgba(163,230,53,0.1)]">
      {icon}
    </div>
    <span className="text-[10px] font-medium text-gray-600 group-hover:text-gray-300 transition-colors">{label}</span>
  </button>
);

const TxnRow: React.FC<{ t: { id: number; vendor: string; category: string; amount: number; date: string; icon: string } }> = ({ t }) => (
  <div className="flex items-center justify-between py-2 hover:bg-white/[0.03] -mx-3 px-3 rounded-xl transition-colors group cursor-pointer">
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-[10px] font-bold text-gray-300 shrink-0">
        {t.icon}
      </div>
      <div>
        <p className="text-gray-300 text-[11px] font-medium leading-none">{t.vendor}</p>
        <p className="text-gray-600 text-[9px] mt-0.5">{t.category} · {t.date}</p>
      </div>
    </div>
    <span className={`text-[11px] font-mono font-semibold ${t.amount > 0 ? "text-[#A3E635]" : "text-gray-300"}`}>
      {t.amount > 0 ? "+" : ""}{fmt(t.amount)}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Static mock data (unchanged from before for non-chart data)
// ─────────────────────────────────────────────────────────────────────────────

const RECENT_TXN = [
  { id: 1, vendor: "Amazon Web Services", category: "Software", amount: -3420.50, date: "Apr 24", icon: "A" },
  { id: 2, vendor: "Stripe Payout", category: "Revenue", amount: 12800.00, date: "Apr 23", icon: "S" },
  { id: 3, vendor: "Deel Payroll", category: "Payroll", amount: -18500.00, date: "Apr 22", icon: "D" },
  { id: 4, vendor: "Acme Corp — Invoice", category: "AR", amount: 24500.00, date: "Apr 19", icon: "Ac" },
  { id: 5, vendor: "Figma", category: "Design", amount: -145.00, date: "Apr 18", icon: "F" },
];

const AI_ACTIONS = [
  { text: "Categorised 12 bank transactions", surface: "Bank", ok: true, time: "2 min ago" },
  { text: "Flagged $96 Notion duplicate", surface: "Exp", ok: false, time: "14 min" },
  { text: "Invoice reminder sent — Acme", surface: "AR", ok: true, time: "1 hr" },
];

// ─────────────────────────────────────────────────────────────────────────────
//    Main page
// ─────────────────────────────────────────────────────────────────────────────

function FinancialOverviewPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({});
  const [refreshing, setRefreshing] = useState(false);

  const userName = auth.user?.name || auth.user?.email || "Account";
  const firstName = userName.split(" ")[0] || userName.split("@")[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const doLoad = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(buildApiUrl("/api/dashboard/"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      setMetrics(data?.metrics || {});
    } catch {
      setMetrics({ cash_on_hand: 124_010.29, revenue_month: 58_000, expenses_month: 42_460, burn_rate_pct: 65 });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { doLoad(); }, []);

  const cash = metrics.cash_on_hand ?? 124_010.29;
  const rev = metrics.revenue_month ?? 58_000;
  const exp = metrics.expenses_month ?? 42_460;
  const burnPct = metrics.burn_rate_pct ?? 65;
  const net = rev - exp;

  return (
    <div
      className="flex-1 flex flex-col min-h-full px-5 py-6 bg-[#09090B] overflow-y-auto"
      style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
    >
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-120px] right-[-80px] w-[560px] h-[560px] rounded-full bg-[#8B5CF6]/6 blur-[120px]" />
        <div className="absolute top-[80px] left-[-60px] w-[420px] h-[420px] rounded-full bg-[#A3E635]/4 blur-[100px]" />
        <div className="absolute bottom-20 right-1/3 w-[380px] h-[380px] rounded-full bg-[#8B5CF6]/4 blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Financial OS · Workspace</p>
          <h1 className="text-3xl font-light tracking-[-0.03em] text-white">
            Good morning,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A3E635] to-[#8B5CF6]">{firstName}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={doLoad}
            className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm flex items-center justify-center text-gray-500 hover:text-white hover:border-white/15 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#A3E635]/20 bg-[#A3E635]/8 backdrop-blur-sm shadow-[0_0_12px_rgba(163,230,53,0.1)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635] animate-pulse" />
            <span className="text-[10px] font-semibold text-[#A3E635]">Live · Synced</span>
          </div>
        </div>
      </div>

      {/* ── Bento Grid ── */}
      <div className="relative z-10 grid grid-cols-12 gap-4">

        {/* ━━━━ CARD 1: Consolidated Cash (tall, 4 cols, 2 rows) ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-4 row-span-2 p-6 flex flex-col" accent="lime">
          {/* Glow orbs behind the card content */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#A3E635]/6 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-[#8B5CF6]/7 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Consolidated Cash</p>
            <button className="w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-gray-600 hover:text-white transition-colors">
              <MoreHorizontal size={12} />
            </button>
          </div>

          <div className="relative z-10">
            <div className="text-[42px] font-light tracking-[-0.04em] text-white font-mono leading-none mt-2">
              {fmt(cash)}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1.5">
              <TrendingUp size={10} className="text-[#A3E635]" />
              <span className="text-[#A3E635] font-semibold">+8.4%</span> vs last month
            </p>
          </div>

          {/* Quick actions */}
          <div className="relative z-10 grid grid-cols-4 gap-2 my-5">
            <QuickAction icon={<ArrowRightLeft size={15} />} label="Transfer" onClick={() => navigate("/bank-accounts")} />
            <QuickAction icon={<ArrowUpRight size={15} />} label="Send" onClick={() => navigate("/invoices")} />
            <QuickAction icon={<ArrowDownLeft size={15} />} label="Receive" onClick={() => navigate("/invoices")} />
            <QuickAction icon={<Receipt size={15} />} label="Expense" onClick={() => navigate("/expense-list")} />
          </div>

          {/* Mini metrics */}
          <div className="relative z-10 grid grid-cols-2 gap-2 mb-4">
            <MiniGlass className="p-3">
              <p className="text-[9px] text-gray-600 uppercase font-semibold tracking-wider mb-1">Revenue MTD</p>
              <p className="text-base font-mono font-bold text-[#A3E635]">{fmt(rev, true)}</p>
              <SparkBars color="#A3E635" />
            </MiniGlass>
            <MiniGlass className="p-3">
              <p className="text-[9px] text-gray-600 uppercase font-semibold tracking-wider mb-1">Expenses MTD</p>
              <p className="text-base font-mono font-bold text-[#F87171]">{fmt(exp, true)}</p>
              <SparkBars color="#F87171" />
            </MiniGlass>
          </div>

          {/* Burn rate */}
          <MiniGlass className="relative z-10 p-3.5 mb-5">
            <div className="flex justify-between items-end mb-2">
              <p className="text-[10px] text-gray-400 font-semibold">Net Burn Rate</p>
              <p className="text-[10px] font-mono text-white font-bold">{burnPct}%</p>
            </div>
            <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, burnPct)}%`,
                  background: "linear-gradient(90deg, #A3E635, #bef264)",
                  boxShadow: "0 0 10px rgba(163,230,53,0.4)",
                }}
              />
            </div>
            <p className="text-[9px] text-gray-600 mt-1.5">{fmt(exp, true)} of $65k monthly threshold</p>
          </MiniGlass>

          {/* Bank accounts */}
          <div className="relative z-10 border-t border-white/[0.05] pt-4 space-y-2.5 mt-auto">
            {[
              { name: "Chase Operating", mask: "*4432", amount: "$114,360" },
              { name: "Wise EUR", mask: "*9112", amount: "€8,020" },
              { name: "Ramp Virtual", mask: "*0044", amount: "$1,630" },
            ].map(acc => (
              <div key={acc.name} className="flex items-center justify-between py-1.5 hover:bg-white/[0.03] -mx-2 px-2 rounded-lg cursor-pointer transition-colors group">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#A3E635]/50" />
                  </div>
                  <div>
                    <p className="text-[11px] text-white font-medium leading-none">{acc.name}</p>
                    <p className="text-[9px] text-gray-600 font-mono mt-0.5">{acc.mask}</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-semibold text-white">{acc.amount}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* ━━━━ CARD 2: Interactive Cashflow Chart ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-8 p-6 min-h-[310px]">
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-[#8B5CF6]/5 blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Cashflow Projection</p>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <div className="w-3 h-[2px] bg-[#A3E635] rounded" /> Actual
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <div className="w-3 h-[2px] border-t-2 border-dashed border-[#8B5CF6]" /> AI Projected
                </span>
              </div>
            </div>
            <MiniGlass className="px-3 py-2 text-right">
              <p className="text-[9px] text-gray-600 uppercase tracking-wider">Net this month</p>
              <p className={`text-base font-mono font-bold ${net >= 0 ? "text-[#A3E635]" : "text-[#F87171]"}`}>
                {net >= 0 ? "+" : ""}{fmt(net, true)}
              </p>
            </MiniGlass>
          </div>
          <div className="relative z-10 h-52">
            <CashflowChart />
          </div>
        </GlassCard>

        {/* ━━━━ CARD 3: Recent Transactions ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-4 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Recent Transactions</p>
            <button onClick={() => navigate("/bank-accounts")} className="flex items-center gap-0.5 text-[10px] text-[#8B5CF6] hover:text-[#a78bfa] font-semibold transition-colors">
              All <ChevronRight size={11} />
            </button>
          </div>
          <div className="space-y-0.5">
            {RECENT_TXN.map(t => <TxnRow key={t.id} t={t} />)}
          </div>
        </GlassCard>

        {/* ━━━━ CARD 4: Rings AI ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-4 p-5" accent="purple">
          <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-[#8B5CF6]/8 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#A3E635] flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.4)]">
                <Sparkles size={11} className="text-black" />
              </div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Rings AI</p>
            </div>
            <button onClick={() => navigate("/ai-companion")} className="flex items-center gap-0.5 text-[10px] text-[#8B5CF6] hover:text-[#a78bfa] font-semibold transition-colors">
              Chat <ChevronRight size={11} />
            </button>
          </div>
          <div className="relative z-10 space-y-1.5 mb-4">
            {AI_ACTIONS.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5 py-2 hover:bg-white/[0.03] -mx-2 px-2 rounded-xl transition-colors cursor-pointer group">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.ok ? "bg-[#A3E635] shadow-[0_0_6px_rgba(163,230,53,0.6)]" : "bg-[#F87171] shadow-[0_0_6px_rgba(248,113,113,0.6)]"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-300 font-medium truncate">{a.text}</p>
                  <p className="text-[9px] text-gray-600">{a.surface} · {a.time}</p>
                </div>
                <ChevronRight size={10} className="text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" />
              </div>
            ))}
          </div>
          <div className="relative z-10 flex flex-wrap gap-1.5">
            {["Summarise books", "Check AR", "Flag anomalies"].map(p => (
              <button key={p} onClick={() => navigate("/ai-companion")} className="text-[9px] font-medium text-gray-500 bg-white/[0.03] border border-white/[0.07] hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] px-2.5 py-1.5 rounded-full transition-all">
                {p}
              </button>
            ))}
          </div>
        </GlassCard>

        {/* ━━━━ CARD 5: Treasury & Yield ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-4 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Treasury & Yield</p>
            <ArrowUpRight size={13} className="text-gray-600" />
          </div>
          <div className="space-y-1.5">
            {[
              { name: "Mercury Treasury", amount: "$45,200", label: "4.8% APY", active: true },
              { name: "Stripe Balance", amount: "$4,221", label: "Transit", active: false },
              { name: "PayPal Reserve", amount: "$2,300", label: "Pending", active: false },
            ].map(a => (
              <MiniGlass key={a.name} className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors ${a.active ? "border-white/[0.1]" : ""}`}>
                <div>
                  <p className="text-[11px] text-white font-medium">{a.name}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">{a.label}</p>
                </div>
                <span className="text-[11px] font-mono font-bold text-white">{a.amount}</span>
              </MiniGlass>
            ))}
          </div>
        </GlassCard>

        {/* ━━━━ CARD 6: AR / AP Snapshot ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-4 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">AR / AP Snapshot</p>
            <button onClick={() => navigate("/invoices")} className="flex items-center gap-0.5 text-[10px] text-[#8B5CF6] hover:text-[#a78bfa] font-semibold transition-colors">
              All <ChevronRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: "Open AR", value: "$42,300", color: "#A3E635", Icon: TrendingUp },
              { label: "Overdue AR", value: "$14,250", color: "#F87171", Icon: TrendingDown },
              { label: "Open AP", value: "$9,800", color: "#f59e0b", Icon: TrendingDown },
              { label: "Net", value: `+${fmt(net, true)}`, color: net >= 0 ? "#A3E635" : "#F87171", Icon: TrendingUp },
            ].map(s => (
              <MiniGlass key={s.label} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] text-gray-600 uppercase tracking-wider">{s.label}</p>
                  <s.Icon size={11} style={{ color: s.color }} />
                </div>
                <p className="text-sm font-mono font-bold" style={{ color: s.color }}>{s.value}</p>
              </MiniGlass>
            ))}
          </div>
          <button onClick={() => navigate("/invoices")} className="w-full py-2 rounded-xl border border-white/[0.07] text-[11px] text-gray-400 hover:text-white hover:border-white/15 transition-colors font-medium bg-white/[0.02]">
            View Invoice Ledger →
          </button>
        </GlassCard>

        {/* ━━━━ CARD 7: Tax Nexus ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-4 p-5" accent="lime"
          onClick={() => navigate("/companion/tax")}>
          <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-[#A3E635]/6 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#A3E635]/10 border border-[#A3E635]/20 flex items-center justify-center shadow-[0_0_10px_rgba(163,230,53,0.15)]">
              <MapPin size={13} className="text-[#A3E635]" />
            </div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Tax Nexus</p>
          </div>
          <p className="relative z-10 text-gray-200 text-sm mb-1 font-medium">3 active jurisdictions</p>
          <p className="relative z-10 text-gray-500 text-[11px] mb-4 leading-relaxed">DE, CA, NY — All filings drafted. Next deadline: May 15.</p>
          <div className="relative z-10 flex items-center gap-1.5 text-xs text-[#A3E635] font-semibold">
            <CheckCircle2 size={13} /> Verify Filings
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform ml-0.5" />
          </div>
        </GlassCard>

        {/* ━━━━ CARD 8: Automation ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-4 p-5" accent="purple">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center">
                <GitBranch size={11} className="text-[#8B5CF6]" />
              </div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Automation</p>
            </div>
            <button onClick={() => navigate("/workflows")} className="flex items-center gap-0.5 text-[10px] text-[#8B5CF6] hover:text-[#a78bfa] font-semibold transition-colors">
              All <ChevronRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Active Rules", value: "7", color: "#A3E635" },
              { label: "AI-Generated", value: "6", color: "#8B5CF6" },
              { label: "Total Hits", value: "80", color: "white" },
            ].map(s => (
              <MiniGlass key={s.label} className="p-2.5 text-center">
                <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[8px] text-gray-600 uppercase tracking-wider mt-0.5">{s.label}</p>
              </MiniGlass>
            ))}
          </div>
          <button onClick={() => navigate("/workflows")} className="w-full py-2 rounded-xl border border-white/[0.07] text-[11px] text-gray-400 hover:text-white hover:border-white/15 transition-colors font-medium bg-white/[0.02] flex items-center justify-center gap-1.5">
            <Zap size={11} /> Manage Workflows & Rules
          </button>
        </GlassCard>

        {/* ━━━━ CARD 9: Top Spend Categories ━━━━ */}
        <GlassCard className="col-span-12 xl:col-span-4 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Top Spend Categories</p>
            <button onClick={() => navigate("/expense-list")} className="flex items-center gap-0.5 text-[10px] text-[#8B5CF6] hover:text-[#a78bfa] font-semibold transition-colors">
              All <ChevronRight size={11} />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { label: "Software & Hosting", pct: 44, amount: "$18,540", color: "#8B5CF6" },
              { label: "Payroll", pct: 38, amount: "$18,500", color: "#A3E635" },
              { label: "Travel", pct: 10, amount: "$4,220", color: "#f59e0b" },
              { label: "Other", pct: 8, amount: "$1,200", color: "#52525B" },
            ].map(s => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400 font-medium">{s.label}</span>
                  <span className="text-[10px] font-mono font-semibold text-white">{s.amount}</span>
                </div>
                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${s.pct}%`,
                      backgroundColor: s.color,
                      boxShadow: `0 0 8px ${s.color}55`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

      </div>
    </div>
  );
}

export const FinancialOverviewRoute: React.FC = () => <FinancialOverviewPage />;
export default FinancialOverviewPage;
