import React, { useCallback, useEffect, useState } from "react";
import {
    Search,
    Filter,
    Zap,
    Paperclip,
    MoreHorizontal,
    ChevronRight,
    X,
    AlertCircle,
    CheckCircle2,
    ArrowRightLeft,
    ChevronDown,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types
// ─────────────────────────────────────────────────────────────────────────────

interface Transaction {
    id: number | string;
    vendor: string;
    amount: string;
    account: string;
    date: string;
    description?: string;
    ai_suggestion?: string;
    ai_category?: string;
    status?: string;
    logo?: string;
    badge?: string;
    tag?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//    Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TRANSACTIONS: Transaction[] = [
    {
        id: "TXN-08992",
        vendor: "Amazon Web Services",
        amount: "$3,420.50",
        account: "Operating *4432",
        date: "Oct 24",
        logo: "https://logo.clearbit.com/aws.amazon.com",
        tag: "Anomaly",
        badge: undefined,
        ai_suggestion: "Variance +314% vs avg. Mixed services detected.",
        ai_category: "6010 - Software & Hosting",
    },
    {
        id: "TXN-08991",
        vendor: "Stripe Payout",
        amount: "$12,450.00",
        account: "Operating *4432",
        date: "Oct 23",
        logo: "https://logo.clearbit.com/stripe.com",
        ai_suggestion: "Found 14 matching invoices for AR reconciliation.",
        ai_category: "4000 - Revenue",
    },
    {
        id: "TXN-08990",
        vendor: "Figma Inc.",
        amount: "$145.00",
        account: "Credit *9921",
        date: "Oct 22",
        logo: "https://logo.clearbit.com/figma.com",
        ai_suggestion: "Auto-categorized as 6010 - Software & Hosting.",
        ai_category: "6010 - Software",
    },
    {
        id: "TXN-08989",
        vendor: "Acme Corp",
        amount: "$8,000.00",
        account: "Accounts Receivable",
        date: "Oct 20",
        logo: "https://i.pravatar.cc/150?img=3",
        badge: "Overdue",
        ai_suggestion: "Payment is 14 days overdue. Draft reminder ready.",
        ai_category: "1100 - Accounts Receivable",
    },
];

const cn = (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(" ");

// ─────────────────────────────────────────────────────────────────────────────
//    Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

interface ListCardProps {
    txn: Transaction;
    active: boolean;
    onClick: () => void;
}

const ListCard: React.FC<ListCardProps> = ({ txn, active, onClick }) => {
    if (active) {
        return (
            <div
                onClick={onClick}
                className="relative rounded-xl p-[1px] bg-gradient-to-br from-[#8B5CF6] to-[#A3E635] shadow-[0_0_15px_rgba(139,92,246,0.15)] cursor-pointer"
            >
                <div className="bg-[#18181B] rounded-[11px] p-3 h-full w-full relative z-10 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                                {txn.logo ? (
                                    <img src={txn.logo} alt="" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <span className="text-black text-[10px] font-bold">{txn.vendor[0]}</span>
                                )}
                            </div>
                            <div>
                                <span className="text-white font-medium text-sm block leading-none">{txn.vendor}</span>
                                <span className="text-gray-400 text-[11px] font-medium">
                                    {txn.account} • {txn.date}
                                </span>
                            </div>
                        </div>
                        <span className="text-white font-semibold text-sm">{txn.amount}</span>
                    </div>

                    {txn.ai_suggestion && (
                        <div className="flex items-center gap-2 mt-1 bg-[#27272A] rounded-md p-2 border border-white/5">
                            <Zap size={12} className="text-[#A3E635] shrink-0" />
                            <p className="text-gray-300 text-xs truncate flex-1">{txn.ai_suggestion}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className="bg-transparent hover:bg-[#131316] border border-transparent hover:border-white/5 rounded-xl p-3 cursor-pointer transition-colors group"
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded bg-white/10 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                        {txn.logo ? (
                            <img src={txn.logo} alt="" className="max-w-full max-h-full object-cover" />
                        ) : (
                            <span className="text-white text-[10px] font-bold">{txn.vendor[0]}</span>
                        )}
                    </div>
                    <div>
                        <span className="text-gray-300 font-medium text-sm block leading-none group-hover:text-white transition-colors">
                            {txn.vendor}
                        </span>
                        <span className="text-gray-500 text-[11px] font-medium">
                            {txn.account} • {txn.date}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="text-gray-300 font-semibold text-sm">{txn.amount}</span>
                    {txn.badge && (
                        <span className="text-red-400 bg-red-400/10 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-400/20">
                            {txn.badge}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface SelectFieldProps {
    label: string;
    value: string;
    highlight?: boolean;
}

const SelectField: React.FC<SelectFieldProps> = ({ label, value, highlight }) => (
    <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider flex justify-between">
            <span>{label}</span>
            {highlight && <span className="text-[#8B5CF6] text-[10px]">AI Match</span>}
        </label>
        <div
            className={`flex items-center justify-between bg-[#18181B] border ${highlight ? "border-[#8B5CF6]/30 bg-[#8B5CF6]/5" : "border-white/10"
                } rounded-lg px-3 py-2.5 cursor-pointer hover:border-gray-500 transition-colors`}
        >
            <span className="text-white text-sm font-medium truncate pr-2">{value}</span>
            <ChevronDown size={14} className="text-gray-500 shrink-0" />
        </div>
    </div>
);

export default function LedgerTransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
    const [activeTab, setActiveTab] = useState<"action" | "reconciled">("action");
    const [search, setSearch] = useState("");
    const [selectedTxn, setSelectedTxn] = useState<Transaction>(MOCK_TRANSACTIONS[0]);
    const [loading, setLoading] = useState(false);

    const loadTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/transactions/ledger/");
            if (!res.ok) throw new Error("API fail");
            const data = await res.json();
            if (data?.results?.length) {
                setTransactions(data.results);
                setSelectedTxn(data.results[0]);
            }
        } catch {
            setTransactions(MOCK_TRANSACTIONS);
            setSelectedTxn(MOCK_TRANSACTIONS[0]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    const filtered = transactions.filter((t) => {
        if (search) {
            const q = search.toLowerCase();
            return t.vendor.toLowerCase().includes(q) || t.amount.toLowerCase().includes(q);
        }
        return true;
    });

    const activeTxn = selectedTxn || filtered[0];

    return (
        <div className="flex flex-1 w-full h-full relative bg-[#09090B]" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* LEFT: Action List */}
            <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col h-full border-r border-white/5 bg-[#09090B] z-10">
                <div className="p-4 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white tracking-tight">Inbox Triage</h2>
                        <button className="p-1.5 text-gray-400 hover:text-white bg-[#18181B] border border-white/5 rounded-md transition-colors">
                            <Filter size={16} />
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                            type="text"
                            placeholder="Search by vendor, amount, or ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-[#18181B] text-white text-sm placeholder:text-gray-500 border border-white/10 focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] rounded-lg py-2 pl-9 pr-3 outline-none transition-all shadow-sm"
                        />
                    </div>

                    <div className="flex items-center bg-[#131316] rounded-lg p-1 border border-white/5">
                        <button
                            onClick={() => setActiveTab("action")}
                            className={cn(
                                "flex-1 py-1 text-xs font-semibold rounded-md shadow-sm transition-all",
                                activeTab === "action"
                                    ? "bg-[#27272A] text-white border border-white/5"
                                    : "text-gray-400 hover:text-gray-200"
                            )}
                        >
                            Requires Action ({filtered.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("reconciled")}
                            className={cn(
                                "flex-1 py-1 text-xs font-semibold rounded-md transition-all",
                                activeTab === "reconciled"
                                    ? "bg-[#27272A] text-white border border-white/5"
                                    : "text-gray-400 hover:text-gray-200"
                            )}
                        >
                            Reconciled
                        </button>
                    </div>
                </div>

                <div
                    className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#09090B]"
                    style={{ scrollbarWidth: "none" }}
                >
                    {loading
                        ? <div className="p-4 text-center text-gray-600 text-sm">Loading transactions...</div>
                        : filtered.map((txn) => (
                            <ListCard
                                key={txn.id}
                                txn={txn}
                                active={activeTxn?.id === txn.id}
                                onClick={() => setSelectedTxn(txn)}
                            />
                        ))}
                </div>
            </div>

            {/* CENTER: Detail View */}
            <div className="hidden lg:flex flex-1 flex-col h-full relative overflow-y-auto bg-[#09090B]" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                {activeTxn ? (
                    <>
                        {/* Sticky Header */}
                        <div className="sticky top-0 z-20 bg-[#09090B]/95 backdrop-blur-sm border-b border-white/5 px-8 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-500 font-medium">Txn ID:</span>
                                <span className="font-mono text-gray-300">#{activeTxn.id}</span>
                                <span className="mx-2 text-white/10">|</span>
                                {activeTxn.tag && (
                                    <span className="text-[#A3E635] flex items-center gap-1 text-xs font-semibold bg-[#A3E635]/10 px-2 py-0.5 rounded border border-[#A3E635]/20">
                                        <Zap size={10} /> {activeTxn.tag === "Anomaly" ? "AI Needs Input" : activeTxn.tag}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button className="h-8 px-3 rounded-md bg-[#18181B] border border-white/10 flex items-center gap-2 text-sm text-gray-300 hover:text-white hover:bg-[#27272A] transition-all shadow-sm">
                                    <Paperclip size={14} /> View Receipt
                                </button>
                                <button className="h-8 w-8 rounded-md bg-[#18181B] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#27272A] transition-all">
                                    <MoreHorizontal size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-8 py-8 max-w-4xl" style={{ paddingRight: "440px" }}>
                            {/* Transaction Hero */}
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-white border border-white/10 flex items-center justify-center shadow-sm p-2">
                                        {activeTxn.logo ? (
                                            <img src={activeTxn.logo} alt={activeTxn.vendor} className="w-full h-full object-contain" />
                                        ) : (
                                            <span className="text-black font-bold text-xl">{activeTxn.vendor[0]}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{activeTxn.vendor}</h1>
                                        <p className="text-sm text-gray-500 flex items-center gap-2">
                                            <span>{activeTxn.date}, 2024</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-600" />
                                            <span>{activeTxn.account}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-white tracking-tight mb-1">{activeTxn.amount}</p>
                                    <p className="text-xs font-medium text-gray-500 bg-[#18181B] border border-white/5 inline-block px-2 py-1 rounded">
                                        USD
                                    </p>
                                </div>
                            </div>

                            {/* AI Ledger Extraction */}
                            <div className="bg-[#131316] border border-white/5 rounded-xl overflow-hidden shadow-sm mb-8">
                                <div className="p-4 border-b border-white/5 bg-[#18181B] flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-[#8B5CF6]" />
                                    <h3 className="text-white text-sm font-semibold">AI Ledger Extraction</h3>
                                </div>

                                <div className="p-5">
                                    {activeTxn.ai_suggestion && (
                                        <p className="text-sm text-gray-400 leading-relaxed mb-5">
                                            {activeTxn.ai_suggestion} Suggested category:{" "}
                                            <strong className="text-gray-200 font-medium">{activeTxn.ai_category}</strong>.
                                        </p>
                                    )}

                                    {/* Structured Table */}
                                    <div className="border border-white/10 rounded-lg overflow-hidden bg-[#09090B]">
                                        <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-white/10 text-xs font-semibold text-gray-500 bg-[#18181B]">
                                            <div className="col-span-5 uppercase tracking-wider">Line Item</div>
                                            <div className="col-span-4 uppercase tracking-wider">GL Account</div>
                                            <div className="col-span-3 text-right uppercase tracking-wider">Debit</div>
                                        </div>
                                        {activeTxn.id === "TXN-08992" ? (
                                            <>
                                                <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm text-gray-300 border-b border-white/5 items-center hover:bg-[#131316]">
                                                    <div className="col-span-5 font-medium truncate">EC2 Compute Base</div>
                                                    <div className="col-span-4">
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#27272A] text-gray-300 border border-white/10 px-2 py-1 rounded">
                                                            6010 - Software
                                                        </span>
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono">$2,100.00</div>
                                                </div>
                                                <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm text-gray-300 border-b border-white/5 items-center hover:bg-[#131316]">
                                                    <div className="col-span-5 font-medium truncate">S3 Standard Storage</div>
                                                    <div className="col-span-4">
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#27272A] text-gray-300 border border-white/10 px-2 py-1 rounded">
                                                            6010 - Software
                                                        </span>
                                                    </div>
                                                    <div className="col-span-3 text-right font-mono">$1,200.50</div>
                                                </div>
                                                <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm items-center bg-[#A3E635]/5 border-l-2 border-l-[#A3E635]">
                                                    <div className="col-span-5 font-medium text-[#A3E635]">Route53 New Domains</div>
                                                    <div className="col-span-4">
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-black bg-[#A3E635] px-2 py-0.5 rounded-sm">
                                                            Manual Input Required
                                                        </span>
                                                    </div>
                                                    <div className="col-span-3 text-right text-[#A3E635] font-semibold font-mono">$120.00</div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm text-gray-300 items-center hover:bg-[#131316]">
                                                <div className="col-span-5 font-medium truncate">{activeTxn.vendor}</div>
                                                <div className="col-span-4">
                                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-[#27272A] text-gray-300 border border-white/10 px-2 py-1 rounded">
                                                        {activeTxn.ai_category}
                                                    </span>
                                                </div>
                                                <div className="col-span-3 text-right font-mono">{activeTxn.amount}</div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-12 gap-4 px-4 py-3 text-sm items-center bg-[#18181B] border-t border-white/10">
                                            <div className="col-span-9 font-semibold text-gray-400 text-right">Total Outflow</div>
                                            <div className="col-span-3 text-right text-white font-bold font-mono">{activeTxn.amount}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                        Select a transaction to review
                    </div>
                )}
            </div>

            {/* RIGHT: Glass Overlay */}
            <div className="hidden xl:flex absolute right-0 top-0 bottom-0 w-[400px] bg-[#131316] border-l border-white/5 flex-col z-30 shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#18181B]">
                    <h2 className="text-sm font-semibold text-white tracking-wide">Categorize Variance</h2>
                    <div className="flex gap-2">
                        <button className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[#27272A] transition-colors">
                            <ArrowRightLeft size={14} />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[#27272A] transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: "none" }}>
                    {/* Unresolved Item Focus */}
                    <div className="bg-[#18181B] border border-[#A3E635]/30 rounded-xl p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#A3E635]" />
                        <div className="flex items-start gap-3 mb-3">
                            <AlertCircle size={16} className="text-[#A3E635] mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-white">
                                    {activeTxn?.vendor} ({activeTxn?.amount})
                                </p>
                                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                    Determine proper tax treatment for this transaction.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 mt-4 pl-7">
                            <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#27272A] border border-white/5 cursor-pointer bg-[#131316] transition-colors">
                                <input type="radio" name="treatment" className="w-4 h-4 accent-[#A3E635]" defaultChecked />
                                <span className="text-sm font-medium text-white">Expense (OPEX)</span>
                            </label>
                            <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#27272A] border border-white/5 cursor-pointer bg-[#131316] transition-colors">
                                <input type="radio" name="treatment" className="w-4 h-4 accent-[#A3E635]" />
                                <span className="text-sm font-medium text-white">Capitalize (CAPEX)</span>
                            </label>
                        </div>
                    </div>

                    <div className="h-px w-full bg-white/5" />

                    <div className="space-y-4">
                        <SelectField label="Chart of Accounts" value={activeTxn?.ai_category || "6010 - Software & Hosting"} highlight />
                        <div className="grid grid-cols-2 gap-4">
                            <SelectField label="Tax Rate" value="Out of Scope (0%)" />
                            <SelectField label="Location" value="HQ - Delaware" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <SelectField label="Department" value="Engineering" />
                            <SelectField label="Class" value="Operations" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                                Memo / Notes
                            </label>
                            <textarea
                                className="w-full bg-[#18181B] border border-white/10 rounded-lg p-3 text-sm text-gray-300 focus:border-[#8B5CF6] outline-none transition-all resize-none h-20 placeholder:text-gray-600"
                                placeholder="Add internal context..."
                                defaultValue="Standard OPEX per CFO guidelines."
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 bg-[#18181B] flex gap-3">
                    <button className="flex-1 py-2 text-sm font-semibold text-gray-300 bg-[#27272A] rounded-lg border border-white/5 hover:bg-[#3F3F46] hover:text-white transition-all">
                        Mark as Draft
                    </button>
                    <button className="flex-1 py-2 text-sm font-semibold text-black bg-[#A3E635] rounded-lg shadow-[0_0_15px_rgba(163,230,53,0.2)] hover:bg-[#bef264] transition-all flex items-center justify-center gap-2">
                        Save & Next <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
