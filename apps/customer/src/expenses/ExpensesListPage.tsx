import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    MoreHorizontal,
    Download,
    ChevronDown,
    ArrowUpRight,
    ArrowDownLeft,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types
// ─────────────────────────────────────────────────────────────────────────────

interface Expense {
    id: number;
    description: string;
    supplier_name: string | null;
    category_name: string | null;
    date: string | null;
    amount: string;
    currency: string;
    status: string;
}

interface ExpenseStats {
    expenses_ytd: string;
    unpaid_total: string;
    paid_total: string;
    category_breakdown?: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
//    Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_EXPENSES: Expense[] = [
    { id: 1, description: "AWS Infrastructure", supplier_name: "Amazon Web Services", category_name: "Software", date: "2025-04-24", amount: "3420.50", currency: "USD", status: "PAID" },
    { id: 2, description: "Payroll Processing", supplier_name: "Deel", category_name: "Payroll", date: "2025-04-01", amount: "14500.00", currency: "USD", status: "PAID" },
    { id: 3, description: "SaaS Subscription", supplier_name: "Google Workspace", category_name: "Software", date: "2025-04-05", amount: "1120.00", currency: "USD", status: "PAID" },
    { id: 4, description: "Design Tools", supplier_name: "Figma Inc.", category_name: "Software", date: "2025-04-10", amount: "450.00", currency: "USD", status: "PAID" },
];

const MOCK_STATS: ExpenseStats = {
    expenses_ytd: "42460.00",
    unpaid_total: "8200.00",
    paid_total: "34260.00",
    category_breakdown: {
        "Software": 35,
        "Payroll": 42,
        "Marketing": 15,
        "Other": 8,
    },
};

const MOCK_VENDORS = [
    { name: "Amazon Web Services", amount: "$3,240.50", percent: "35%" },
    { name: "Deel Payroll", amount: "$14,500.00", percent: "42%" },
    { name: "Google Workspace", amount: "$1,120.00", percent: "15%" },
    { name: "Figma Inc.", amount: "$450.00", percent: "8%" },
];

// ─────────────────────────────────────────────────────────────────────────────
//    Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtN = (n: string | number) => {
    const v = typeof n === "string" ? parseFloat(n) : n;
    if (isNaN(v)) return String(n);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
};

// ─────────────────────────────────────────────────────────────────────────────
//    Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const VendorRow: React.FC<{ name: string; amount: string; percent: string }> = ({ name, amount, percent }) => (
    <div className="flex items-center justify-between group p-2 hover:bg-[#18181B] -mx-2 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-white/5">
        <div>
            <span className="text-white text-sm font-medium block leading-tight">{name}</span>
            <span className="text-gray-500 text-xs font-mono">{percent} of total</span>
        </div>
        <span className="text-white font-semibold text-sm">{amount}</span>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ExpensesListPage({ defaultCurrency = "USD" }: { defaultCurrency?: string }) {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [stats, setStats] = useState<ExpenseStats | null>(null);
    const [reportTab, setReportTab] = useState<"pl" | "balance" | "trial">("pl");
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/expenses/list/");
            if (!res.ok) throw new Error("fail");
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setExpenses(data.expenses || MOCK_EXPENSES);
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

    return (
        <div
            className="flex-1 flex flex-col min-h-full px-6 py-6 bg-[#09090B] overflow-y-auto"
            style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Analytics & Reports</h1>
                    <p className="text-sm text-gray-500 mt-1">Real-time breakdown of GL accounts</p>
                </div>

                <div className="flex items-center gap-3 self-start md:self-auto">
                    <div className="hidden md:flex items-center bg-[#18181B] border border-white/10 rounded-lg p-1">
                        {(["pl", "balance", "trial"] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setReportTab(t)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors uppercase ${reportTab === t
                                        ? "bg-[#27272A] text-white font-semibold shadow-sm"
                                        : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                {t === "pl" ? "P&L" : t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>
                    <button className="flex items-center gap-2 bg-white text-black rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-gray-200 transition-colors shadow-sm">
                        <Download size={14} /> Export
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
                {/* Left/Main Charts */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* OPEX Donut Chart */}
                        <div className="bg-[#131316] border border-white/5 rounded-2xl p-6 relative overflow-hidden shadow-sm">
                            <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">OPEX Breakdown</h3>
                            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[200px]">
                                <div className="relative w-44 h-44 flex items-center justify-center">
                                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(163,230,53,0.1)]">
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="#27272A" strokeWidth="10" />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="#8B5CF6" strokeWidth="10" strokeDasharray="60 251.2" strokeLinecap="round" className="origin-center" style={{ transform: "rotate(150deg)", transformOrigin: "50px 50px" }} />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="#A3E635" strokeWidth="10" strokeDasharray="140 251.2" strokeLinecap="round" style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px" }} />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-xl font-bold text-white tracking-tight">{fmtN(displayStats.expenses_ytd)}</span>
                                        <span className="text-[10px] text-gray-500 uppercase">YTD Total</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 mt-4">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                        <div className="w-2 h-2 rounded-full bg-[#A3E635]" /> Software (35%)
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                        <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" /> Payroll (42%)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Card Utilization */}
                        <div className="bg-[#131316] border border-white/5 rounded-2xl p-6 flex flex-col">
                            <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">Card Utilization</h3>
                            <div className="space-y-4 flex-1 flex flex-col justify-center">
                                <div className="bg-[#18181B] border border-white/5 rounded-xl p-4 flex justify-between items-center">
                                    <div>
                                        <p className="text-white font-medium text-sm">Chase Corp *4432</p>
                                        <p className="text-gray-500 text-xs mt-1">$12k / $50k Limit</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[#A3E635] font-semibold text-sm">24%</p>
                                        <div className="w-16 h-1.5 bg-[#27272A] rounded-full mt-1.5">
                                            <div className="w-[24%] h-full bg-[#A3E635] rounded-full" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-[#18181B] border border-white/5 rounded-xl p-4 flex justify-between items-center">
                                    <div>
                                        <p className="text-white font-medium text-sm">Ramp Virtual *9921</p>
                                        <p className="text-gray-500 text-xs mt-1">$3k / $10k Limit</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[#8B5CF6] font-semibold text-sm">30%</p>
                                        <div className="w-16 h-1.5 bg-[#27272A] rounded-full mt-1.5">
                                            <div className="w-[30%] h-full bg-[#8B5CF6] rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* YoY Expense Trend Chart */}
                    <div className="bg-[#131316] border border-white/5 rounded-2xl p-6 flex-1 relative min-h-[260px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-white text-sm font-semibold uppercase tracking-wider">YoY Expense Trend</h3>
                            <button className="w-7 h-7 rounded-md bg-[#18181B] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white">
                                <MoreHorizontal size={14} />
                            </button>
                        </div>

                        <div className="flex-1 relative mt-4 bg-[#18181B] rounded-xl border border-white/5 p-4 min-h-[160px]">
                            <div className="absolute inset-x-4 top-4 bottom-8 border-b border-l border-white/10" />
                            <div className="absolute inset-x-8 top-8 bottom-8 flex items-end justify-between gap-2">
                                {[40, 60, 45, 80, 55, 90, 70, 65, 50, 85, 40, 60].map((h, i) => (
                                    <div key={i} className="w-full flex justify-center gap-0.5 items-end h-full">
                                        <div className="w-1/2 bg-gray-700 rounded-sm" style={{ height: `${h * 0.7}%` }} />
                                        <div className="w-1/2 bg-[#A3E635] rounded-sm" style={{ height: `${h}%` }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                <div className="w-2 h-2 bg-gray-700 rounded-sm" /> Prior Year
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                <div className="w-2 h-2 bg-[#A3E635] rounded-sm" /> Current Year
                            </div>
                        </div>
                    </div>

                    {/* Expense Ledger Table */}
                    <div className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-white/5">
                            <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Recent Expenses</h3>
                            <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                                <Download size={12} /> Export
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-white/5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-[#09090B]/50">
                                        <th className="py-3 px-4">Vendor</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4 text-right">Amount</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-600 text-sm">Loading...</td>
                                        </tr>
                                    ) : expenses.map((exp) => (
                                        <tr key={exp.id} className="border-b border-white/5 hover:bg-[#18181B] transition-colors cursor-pointer">
                                            <td className="py-3 px-4">
                                                <p className="text-white text-sm font-medium">{exp.supplier_name || exp.description}</p>
                                                <p className="text-gray-500 text-xs">{exp.description}</p>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="text-xs bg-[#18181B] border border-white/10 text-gray-300 px-2 py-1 rounded font-medium">
                                                    {exp.category_name || "Uncategorized"}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-gray-400 text-sm">
                                                {exp.date ? new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                                            </td>
                                            <td className="py-3 px-4 text-white font-mono text-sm font-semibold text-right">
                                                {fmtN(exp.amount)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`text-xs px-2.5 py-1 rounded-md font-semibold border inline-block ${exp.status === "PAID"
                                                        ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20"
                                                        : "text-gray-400 bg-[#18181B] border-white/10"
                                                    }`}>
                                                    {exp.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    {/* Summary Stats */}
                    <div className="bg-[#131316] border border-white/5 rounded-2xl p-6">
                        <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Period Summary</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Expenses YTD</span>
                                <span className="text-white font-mono font-semibold text-sm">{fmtN(displayStats.expenses_ytd)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#A3E635] text-sm flex items-center gap-1.5"><ArrowDownLeft size={12} /> Paid</span>
                                <span className="text-[#A3E635] font-mono font-semibold text-sm">{fmtN(displayStats.paid_total)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[#F87171] text-sm flex items-center gap-1.5"><ArrowUpRight size={12} /> Unpaid</span>
                                <span className="text-[#F87171] font-mono font-semibold text-sm">{fmtN(displayStats.unpaid_total)}</span>
                            </div>
                        </div>
                        <div className="mt-4 h-2 bg-[#27272A] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#A3E635] rounded-full"
                                style={{
                                    width: `${Math.round((parseFloat(displayStats.paid_total) / parseFloat(displayStats.expenses_ytd)) * 100)}%`
                                }}
                            />
                        </div>
                        <p className="text-gray-600 text-[10px] mt-2 text-center">
                            {Math.round((parseFloat(displayStats.paid_total) / parseFloat(displayStats.expenses_ytd)) * 100)}% of YTD expenses paid
                        </p>
                    </div>

                    {/* Top Vendors */}
                    <div className="bg-[#131316] border border-white/5 rounded-2xl p-6 flex-1">
                        <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-6">Top Vendors</h3>
                        <div className="space-y-1">
                            {MOCK_VENDORS.map((v) => (
                                <VendorRow key={v.name} name={v.name} amount={v.amount} percent={v.percent} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
