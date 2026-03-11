import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Search,
    Filter,
    Plus,
    MoreHorizontal,
    Calendar,
    ChevronDown,
    ListOrdered,
    ArrowUpRight,
    ArrowDownLeft,
    CheckCircle2,
    Paperclip,
    X,
    Check,
    Camera,
    Clock,
    AlertCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types
// ─────────────────────────────────────────────────────────────────────────────

type ExpenseStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

interface Expense {
    id: string | number;
    date: string;
    vendor: string;
    description: string;
    amount: number;
    currency: string;
    category: string;
    gl_account: string;
    status: ExpenseStatus;
    receipt: boolean;
    submitted_by: string;
    payment_method: string;
    memo?: string;
}

interface ExpenseStats {
    approved_30d: string;
    pending_total: string;
    missing_receipts: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//    Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_EXPENSES: Expense[] = [
    { id: "e001", date: "2025-04-24", vendor: "Amazon Web Services", description: "EC2 + S3 — April", amount: 3420.50, currency: "USD", category: "Software & Hosting", gl_account: "6010", status: "APPROVED", receipt: true, submitted_by: "You", payment_method: "Corporate Card" },
    { id: "e002", date: "2025-04-23", vendor: "Figma", description: "Team plan renewal", amount: 145.00, currency: "USD", category: "Design Tools", gl_account: "6010", status: "PENDING", receipt: false, submitted_by: "You", payment_method: "Corporate Card" },
    { id: "e003", date: "2025-04-20", vendor: "Uber", description: "Client meeting — downtown", amount: 38.50, currency: "USD", category: "Travel & Entertainment", gl_account: "6200", status: "PENDING", receipt: true, submitted_by: "You", payment_method: "Personal" },
    { id: "e004", date: "2025-04-18", vendor: "Delta Airlines", description: "SF → NYC — client onsite", amount: 842.00, currency: "USD", category: "Travel & Entertainment", gl_account: "6200", status: "APPROVED", receipt: true, submitted_by: "You", payment_method: "Corporate Card" },
    { id: "e005", date: "2025-04-15", vendor: "WeWork", description: "Spring coworking pass", amount: 490.00, currency: "USD", category: "Office & Facilities", gl_account: "6300", status: "APPROVED", receipt: true, submitted_by: "You", payment_method: "Bank Transfer" },
    { id: "e006", date: "2025-04-10", vendor: "Notion", description: "Workspace subscription", amount: 96.00, currency: "USD", category: "Software & Hosting", gl_account: "6010", status: "REJECTED", receipt: false, submitted_by: "You", payment_method: "Personal", memo: "Duplicate — already billed via team plan" },
    { id: "e007", date: "2025-04-05", vendor: "OpenAI", description: "API usage — March overage", amount: 220.00, currency: "USD", category: "Software & Hosting", gl_account: "6010", status: "DRAFT", receipt: false, submitted_by: "You", payment_method: "Corporate Card" },
    { id: "e008", date: "2025-03-31", vendor: "Starbucks", description: "Team coffee — sprint retro", amount: 67.25, currency: "USD", category: "Meals & Entertainment", gl_account: "6250", status: "APPROVED", receipt: true, submitted_by: "You", payment_method: "Personal" },
];

const MOCK_STATS: ExpenseStats = {
    approved_30d: "78,420.00",
    pending_total: "12,380.00",
    missing_receipts: "3,200.00",
};

const TOP_VENDORS = [
    { name: "Amazon Web Services", amount: "$24,180", pct: 31 },
    { name: "Deel (Payroll)", amount: "$18,500", pct: 24 },
    { name: "Travel & Hotels", amount: "$9,640", pct: 12 },
    { name: "Other (18 Vendors)", amount: "$26,100", pct: 33 },
];

const GL_ACCOUNTS = [
    { code: "6010", name: "Software & Hosting" },
    { code: "6100", name: "Marketing" },
    { code: "6200", name: "Travel & Entertainment" },
    { code: "6250", name: "Meals & Entertainment" },
    { code: "6300", name: "Office & Facilities" },
    { code: "6500", name: "Payroll" },
    { code: "6600", name: "Contractors" },
];

const PAYMENT_METHODS = ["Corporate Card", "Personal", "Bank Transfer", "Cash", "Cheque"];

// ─────────────────────────────────────────────────────────────────────────────
//    Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ExpenseStatus, { text: string; bg: string; border: string; label: string }> = {
    DRAFT: { text: "text-gray-400", bg: "bg-[#18181B]", border: "border-white/10", label: "Draft" },
    PENDING: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Pending" },
    APPROVED: { text: "text-[#A3E635]", bg: "bg-[#A3E635]/10", border: "border-[#A3E635]/20", label: "Approved" },
    REJECTED: { text: "text-[#F87171]", bg: "bg-[#F87171]/10", border: "border-[#F87171]/20", label: "Rejected" },
};

const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtN = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ─────────────────────────────────────────────────────────────────────────────
//    MetricCard (mirrors InvoicesListPage)
// ─────────────────────────────────────────────────────────────────────────────

interface MetricCardProps {
    title: string;
    amount: string;
    trend: string;
    positive?: boolean;
    alert?: boolean;
    violet?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, amount, trend, positive, alert }) => {
    const bars = useMemo(() => Array.from({ length: 12 }, () => Math.random() * 100 + 20), []);
    const sparkColor = positive ? "bg-[#A3E635]" : alert ? "bg-[#F87171]" : "bg-[#8B5CF6]";
    const trendColor = positive ? "text-[#A3E635]" : alert ? "text-[#F87171]" : "text-[#8B5CF6]";
    return (
        <div className="bg-[#131316] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-semibold text-gray-300">{title}</span>
                <button className="text-gray-500 hover:text-white"><MoreHorizontal size={14} /></button>
            </div>
            <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-white tracking-tight font-mono">${amount}</span>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex items-end gap-0.5 h-6">
                        {bars.map((h, i) => (
                            <div key={i} className={`w-1 rounded-sm ${sparkColor}`} style={{ height: `${Math.min(100, h)}%`, opacity: i > 8 ? 1 : 0.35 }} />
                        ))}
                    </div>
                    <span className={`text-[10px] font-semibold flex items-center gap-1 ${trendColor}`}>
                        {positive ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                        {trend} <span className="text-gray-500 font-medium">vs last mo</span>
                    </span>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    SpendBar (mirrors ForecastBar in invoices)
// ─────────────────────────────────────────────────────────────────────────────

interface SpendBarProps {
    approvedH: string;
    pendingH: string;
    rejectedH: string;
    label: string;
    isActive?: boolean;
}

const SpendBar: React.FC<SpendBarProps> = ({ approvedH, pendingH, rejectedH, label, isActive }) => (
    <div className="relative flex flex-col gap-1 w-[8%] h-full justify-end cursor-pointer group hover:scale-105 transition-transform">
        {rejectedH !== "0%" && <div className="w-full bg-[#F87171]/80 border border-white/5 rounded-md" style={{ height: rejectedH }} />}
        {pendingH !== "0%" && <div className="w-full bg-amber-400/80 rounded-md" style={{ height: pendingH }} />}
        {approvedH !== "0%" && (
            <div
                className={`w-full rounded-md ${isActive ? "bg-[#A3E635] shadow-[0_0_15px_rgba(163,230,53,0.3)]" : "bg-[#A3E635]/30 border border-white/10"}`}
                style={{ height: approvedH }}
            />
        )}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Top Vendor Row (mirrors UnpaidRow in invoices)
// ─────────────────────────────────────────────────────────────────────────────

interface VendorRowProps { name: string; amount: string; pct: number; isGray?: boolean; }

const VendorRow: React.FC<VendorRowProps> = ({ name, amount, pct, isGray }) => (
    <div className="group hover:bg-[#18181B] -mx-2 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-white/5 cursor-pointer">
        <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-medium ${isGray ? "text-gray-400" : "text-white"}`}>{name}</span>
            <span className="text-white font-mono font-semibold text-sm">{amount}</span>
        </div>
        <div className="h-1 bg-[#27272A] rounded-full overflow-hidden">
            <div className="h-full bg-[#8B5CF6]/70 rounded-full" style={{ width: `${pct}%` }} />
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Record Expense Drawer
// ─────────────────────────────────────────────────────────────────────────────

interface DrawerProps { onClose: () => void; onSave: (e: Expense) => void; existing?: Expense | null; }

const ExpenseDrawer: React.FC<DrawerProps> = ({ onClose, onSave, existing }) => {
    const [vendor, setVendor] = useState(existing?.vendor ?? "");
    const [desc, setDesc] = useState(existing?.description ?? "");
    const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
    const [date, setDate] = useState(existing?.date ?? new Date().toISOString().split("T")[0]);
    const [category, setCategory] = useState(existing?.category ?? "Software & Hosting");
    const [glAccount, setGLAccount] = useState(existing?.gl_account ?? "6010");
    const [method, setMethod] = useState(existing?.payment_method ?? "Corporate Card");
    const [memo, setMemo] = useState(existing?.memo ?? "");
    const [hasReceipt, setHasReceipt] = useState(existing?.receipt ?? false);

    const handleSave = (status: ExpenseStatus = "PENDING") => {
        if (!vendor.trim() || !amount.trim()) return;
        onSave({
            id: existing?.id ?? `e-${Date.now()}`,
            date,
            vendor,
            description: desc || vendor,
            amount: parseFloat(amount) || 0,
            currency: "USD",
            category,
            gl_account: glAccount,
            status,
            receipt: hasReceipt,
            submitted_by: "You",
            payment_method: method,
            memo,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#131316] border-l border-white/10 w-full sm:w-[400px] h-full flex flex-col shadow-2xl overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#18181B] shrink-0">
                    <div>
                        <p className="text-white font-semibold text-sm">{existing ? "Edit Expense" : "Record Expense"}</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">Fill in the details below</p>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-md bg-[#27272A] flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                        <X size={14} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ scrollbarWidth: "none" }}>
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Vendor / Merchant</label>
                        <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Amazon, Figma, Uber..." className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What was this for?" className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#18181B] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none font-mono placeholder:text-gray-600" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                        <div className="relative">
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer">
                                {["Software & Hosting", "Design Tools", "Travel & Entertainment", "Meals & Entertainment", "Office & Facilities", "Marketing", "Payroll", "Contractors"].map(c => <option key={c}>{c}</option>)}
                            </select>
                            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">GL Account</label>
                        <div className="relative">
                            <select value={glAccount} onChange={e => setGLAccount(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer">
                                {GL_ACCOUNTS.map(g => <option key={g.code} value={g.code}>{g.code} — {g.name}</option>)}
                            </select>
                            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                        <div className="relative">
                            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer">
                                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                            </select>
                            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Memo (optional)</label>
                        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="Internal note..." className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none resize-none placeholder:text-gray-600" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Receipt</label>
                        <button onClick={() => setHasReceipt(v => !v)} className={`w-full py-4 border-2 border-dashed rounded-xl flex flex-col items-center gap-2 transition-all ${hasReceipt ? "border-[#A3E635]/40 bg-[#A3E635]/5" : "border-white/10 hover:border-white/20"}`}>
                            {hasReceipt
                                ? <><CheckCircle2 size={18} className="text-[#A3E635]" /><span className="text-[#A3E635] text-xs font-semibold">Receipt attached</span></>
                                : <><Camera size={18} className="text-gray-500" /><span className="text-gray-400 text-xs">Upload receipt or snap photo</span></>}
                        </button>
                    </div>
                </div>
                <div className="px-5 py-4 border-t border-white/5 bg-[#18181B] shrink-0 flex gap-2">
                    <button onClick={() => handleSave("DRAFT")} className="flex-1 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-medium hover:bg-[#27272A] transition-colors">
                        Save Draft
                    </button>
                    <button onClick={() => handleSave("PENDING")} className="flex-1 py-2 rounded-lg bg-[#A3E635] text-black text-sm font-bold hover:bg-[#bef264] transition-colors shadow-sm flex items-center justify-center gap-2">
                        <Check size={14} /> Submit
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ExpenseListPage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [stats, setStats] = useState<ExpenseStats | null>(null);
    const [activeTab, setActiveTab] = useState<"all" | "pending" | "recurring">("all");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Expense | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/expenses/list/");
            if (!res.ok) throw new Error("fail");
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setExpenses(data.expenses?.length ? data.expenses : MOCK_EXPENSES);
            setStats(data.stats || null);
        } catch {
            setExpenses(MOCK_EXPENSES);
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const displayStats = stats || MOCK_STATS;

    const filteredExpenses = useMemo(() => {
        let list = expenses;
        if (activeTab === "pending") list = list.filter(e => e.status === "PENDING");
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(e => e.vendor.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
        }
        return list;
    }, [expenses, activeTab, search]);

    const handleSave = (e: Expense) => {
        setExpenses(prev => {
            const idx = prev.findIndex(x => x.id === e.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = e; return n; }
            return [e, ...prev];
        });
    };

    const handleApprove = (id: string | number) =>
        setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: "APPROVED" as ExpenseStatus } : e));

    return (
        <div
            className="flex-1 flex flex-col min-h-full px-6 py-6 bg-[#09090B] overflow-y-auto"
            style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        >
            {/* ── Top Navigation Row (mirrors invoices) ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2 bg-[#18181B] border border-white/5 rounded-lg p-1">
                    {(["all", "pending", "recurring"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize ${activeTab === tab ? "bg-[#27272A] text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                        >
                            {tab === "all" ? "All Expenses" : tab === "pending" ? "Needs Approval" : "Recurring"}
                        </button>
                    ))}
                    <button className="px-4 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white transition-colors">
                        Reimbursable
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
                        <input
                            type="text"
                            placeholder="Search expense or vendor..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-[#18181B] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:border-[#8B5CF6] outline-none"
                        />
                    </div>
                    <button className="flex items-center gap-2 bg-[#18181B] border border-white/10 rounded-lg px-4 py-1.5 text-sm text-gray-300 hover:bg-[#27272A] hover:text-white transition-colors">
                        <Filter size={14} /> Filter
                    </button>
                    <button
                        onClick={() => { setEditTarget(null); setDrawerOpen(true); }}
                        className="flex items-center gap-2 bg-[#A3E635] text-black rounded-lg px-4 py-1.5 text-sm font-semibold hover:bg-[#bef264] transition-colors shadow-sm shadow-[#A3E635]/20"
                    >
                        <Plus size={14} /> Record Expense
                    </button>
                </div>
            </div>

            {/* ── Metric Cards (identical structure to invoices) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <MetricCard title="Approved (Last 30 Days)" amount={displayStats.approved_30d} trend="+8.3%" positive />
                <MetricCard title="Pending Approval" amount={displayStats.pending_total} trend="+2.1%" violet />
                <MetricCard title="Missing Receipts" amount={displayStats.missing_receipts} trend="-1.4%" alert />
            </div>

            {/* ── Charts Row (mirrors invoices 2/3 + 1/3 grid) ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Monthly Spend Trend */}
                <div className="xl:col-span-2 bg-[#131316] border border-white/5 rounded-2xl p-6 relative">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Monthly Spend Trend</h3>
                        <button className="flex items-center gap-2 bg-[#18181B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:bg-[#27272A]">
                            <Calendar size={12} /> By Month <ChevronDown size={12} className="ml-1" />
                        </button>
                    </div>

                    <div className="h-48 relative flex items-end justify-between px-2 pb-6 border-b border-white/5">
                        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-gray-500 font-mono">
                            <span>$60k</span><span>$40k</span><span>$20k</span><span>$0</span>
                        </div>
                        <div className="w-full pl-10 flex justify-between items-end h-full">
                            <SpendBar rejectedH="0%" pendingH="15%" approvedH="50%" label="Jan" />
                            <SpendBar rejectedH="0%" pendingH="10%" approvedH="60%" label="Feb" />
                            <SpendBar rejectedH="0%" pendingH="20%" approvedH="45%" label="Mar" />
                            {/* Active month – Apr */}
                            <div className="flex flex-col gap-1 w-[8%] h-full justify-end relative group cursor-pointer">
                                <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-[#27272A] border border-white/10 rounded-lg p-3 shadow-xl z-20 w-44 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <p className="text-white text-xs font-semibold mb-2">April, 2025</p>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px]"><span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#F87171] rounded-sm" /> Rejected</span><span className="font-mono text-white">$96</span></div>
                                        <div className="flex justify-between text-[10px]"><span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-amber-400 rounded-sm" /> Pending</span><span className="font-mono text-white">$183</span></div>
                                        <div className="flex justify-between text-[10px]"><span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#A3E635] rounded-sm" /> Approved</span><span className="font-mono text-white">$4,820</span></div>
                                    </div>
                                </div>
                                <div className="w-full bg-[#F87171] rounded-md" style={{ height: "3%" }} />
                                <div className="w-full bg-amber-400 rounded-md" style={{ height: "8%" }} />
                                <div className="w-full bg-[#A3E635] rounded-md shadow-[0_0_15px_rgba(163,230,53,0.3)]" style={{ height: "38%" }} />
                            </div>
                            <SpendBar rejectedH="0%" pendingH="30%" approvedH="12%" label="May" />
                            <SpendBar rejectedH="0%" pendingH="20%" approvedH="0%" label="Jun" />
                            <SpendBar rejectedH="0%" pendingH="15%" approvedH="0%" label="Jul" />
                            <SpendBar rejectedH="0%" pendingH="25%" approvedH="0%" label="Aug" />
                        </div>
                    </div>
                    <div className="pl-10 flex justify-between text-[10px] text-gray-500 font-medium mt-3 uppercase tracking-wider">
                        <span>Jan</span><span>Feb</span><span>Mar</span>
                        <span className="text-white font-bold bg-[#27272A] px-2 py-0.5 rounded">Apr</span>
                        <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-4 pl-10">
                        <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><div className="w-2 h-2 bg-[#A3E635] rounded-sm" /> Approved</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><div className="w-2 h-2 bg-amber-400 rounded-sm" /> Pending</span>
                        <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><div className="w-2 h-2 bg-[#F87171] rounded-sm" /> Rejected</span>
                    </div>
                </div>

                {/* Top Vendors by Spend (mirrors Top Unpaid) */}
                <div className="xl:col-span-1 bg-[#131316] border border-white/5 rounded-2xl p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Top Vendors</h3>
                        <button className="flex items-center gap-1 bg-[#18181B] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 hover:bg-[#27272A]">
                            By Spend <ChevronDown size={12} className="ml-1" />
                        </button>
                    </div>
                    <div className="flex items-end gap-2 mb-4">
                        <span className="text-3xl font-bold text-white tracking-tight font-mono">$78,300</span>
                        <span className="text-xs text-gray-500 pb-1 uppercase">Total Spend</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden gap-1 mb-6 bg-[#18181B] border border-white/5 p-0.5">
                        <div className="bg-[#8B5CF6] w-[31%] rounded-full shadow-[0_0_8px_rgba(139,92,246,0.4)]" />
                        <div className="bg-[#8B5CF6]/60 w-[24%] rounded-full" />
                        <div className="bg-[#8B5CF6]/40 w-[12%] rounded-full" />
                        <div className="bg-[#27272A] w-[33%] rounded-full" />
                    </div>
                    <div className="space-y-3 flex-1">
                        {TOP_VENDORS.map((v, i) => (
                            <VendorRow key={i} name={v.name} amount={v.amount} pct={v.pct} isGray={i === TOP_VENDORS.length - 1} />
                        ))}
                    </div>
                    <button className="w-full mt-4 py-2 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 hover:bg-[#18181B] transition-colors">
                        View Vendor Report
                    </button>
                </div>
            </div>

            {/* ── Expense Ledger Table (mirrors Invoice Ledger) ── */}
            <div className="bg-[#131316] border border-white/5 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm">
                <div className="flex justify-between items-center p-4 border-b border-white/5">
                    <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Expense Ledger</h3>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 bg-[#18181B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:bg-[#27272A]">
                            <ListOrdered size={14} /> Sort by <ChevronDown size={12} />
                        </button>
                        <button className="w-7 h-7 flex items-center justify-center bg-[#18181B] border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-[#27272A]">
                            <MoreHorizontal size={14} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-[#09090B]/50">
                                <th className="py-3 px-4 w-8">
                                    <input type="checkbox" className="accent-[#A3E635] bg-[#18181B] border-white/10 rounded" />
                                </th>
                                <th className="py-3 px-4">Vendor</th>
                                <th className="py-3 px-4">Category</th>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Method</th>
                                <th className="py-3 px-4 text-center w-20">Receipt</th>
                                <th className="py-3 px-4 text-right">Amount</th>
                                <th className="py-3 px-4 text-center">Status</th>
                                <th className="py-3 px-4 w-10" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="py-8 text-center text-gray-600 text-sm">Loading expenses...</td></tr>
                            ) : filteredExpenses.length === 0 ? (
                                <tr><td colSpan={9} className="py-8 text-center text-gray-600 text-sm">No expenses found.</td></tr>
                            ) : (
                                filteredExpenses.map(exp => {
                                    const cfg = STATUS_CONFIG[exp.status] || STATUS_CONFIG.DRAFT;
                                    return (
                                        <tr key={exp.id} className="border-b border-white/5 hover:bg-[#18181B] transition-colors group cursor-pointer">
                                            <td className="py-3 px-4">
                                                <input type="checkbox" className="accent-[#A3E635] bg-[#18181B] border-white/10 rounded" />
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-6 h-6 rounded-md bg-white border border-white/10 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                                                        <span className="text-black text-[10px] font-bold">{exp.vendor[0]}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-300 text-sm font-medium">{exp.vendor}</p>
                                                        <p className="text-gray-500 text-[11px]">{exp.description}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-xs bg-[#18181B] border border-white/10 text-gray-300 px-2 py-0.5 rounded font-medium">{exp.category}</span>
                                            </td>
                                            <td className="py-3 px-4 text-gray-400 text-sm">{formatDate(exp.date)}</td>
                                            <td className="py-3 px-4 text-gray-400 text-sm">{exp.payment_method}</td>
                                            <td className="py-3 px-4 text-center">
                                                {exp.receipt
                                                    ? <Paperclip size={14} className="text-[#A3E635] mx-auto" />
                                                    : <span className="text-[10px] text-[#F87171] font-semibold">Missing</span>}
                                            </td>
                                            <td className="py-3 px-4 text-white font-mono text-sm font-semibold text-right">{fmtN(exp.amount)}</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`text-xs px-2.5 py-1 rounded-md font-semibold border inline-block w-20 text-center ${cfg.text} ${cfg.bg} ${cfg.border}`}>
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {exp.status === "PENDING" && (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleApprove(exp.id); }}
                                                            className="text-[#A3E635] bg-[#A3E635]/10 border border-[#A3E635]/20 text-[10px] font-bold px-2 py-1 rounded hover:bg-[#A3E635]/20 transition-colors"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setEditTarget(exp); setDrawerOpen(true); }}
                                                        className="text-gray-400 hover:text-white"
                                                    >
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Record Expense Drawer ── */}
            {drawerOpen && (
                <ExpenseDrawer
                    onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
                    onSave={handleSave}
                    existing={editTarget}
                />
            )}
        </div>
    );
}
