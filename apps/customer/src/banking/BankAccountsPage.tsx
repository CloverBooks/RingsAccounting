import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Plus,
    RefreshCw,
    Search,
    Filter,
    Download,
    ChevronDown,
    ChevronRight,
    X,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowDownLeft,
    ArrowUpRight,
    Zap,
    SplitSquareHorizontal,
    ArrowRightLeft,
    Edit3,
    MoreHorizontal,
    Trash2,
    Check,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types
// ─────────────────────────────────────────────────────────────────────────────

type TxStatus = "for_review" | "categorized" | "excluded";
type PanelTab = "categorize" | "split" | "match" | "add";

interface BankCard {
    id: string;
    name: string;
    mask: string;
    balance: string;
    currency: string;
    type: "checking" | "credit" | "savings";
    gradient: string;
    institution: string;
    forReview: number;
}

interface BankTransaction {
    id: string | number;
    date: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
    status: TxStatus;
    ai_category?: string;
    ai_account?: string;
    ai_confidence?: number;
    vendor?: string;
    memo?: string;
    matched_to?: string;
    split?: boolean;
}

interface SuggestedMatch {
    id: number;
    type: "invoice" | "bill";
    number: string;
    entity: string;
    amount: number;
    date: string;
    confidence: number;
}

interface GLAccount {
    code: string;
    name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//    Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CARDS: BankCard[] = [
    { id: "chase", name: "Chase Operating", mask: "*4432", balance: "114,360.00", currency: "USD", type: "checking", gradient: "from-[#1A56DB] to-[#1E40AF]", institution: "Chase", forReview: 8 },
    { id: "wise", name: "Wise EUR", mask: "*9112", balance: "€8,020.00", currency: "EUR", type: "checking", gradient: "from-[#3D3D3D] to-[#1A1A1A]", institution: "Wise", forReview: 2 },
    { id: "ramp", name: "Ramp Virtual", mask: "*9921", balance: "3,000.00", currency: "USD", type: "credit", gradient: "from-[#5B21B6] to-[#4C1D95]", institution: "Ramp", forReview: 4 },
];

const MOCK_TRANSACTIONS: BankTransaction[] = [
    { id: "t001", date: "Apr 24", description: "Amazon Web Services", amount: 3420.50, type: "debit", status: "for_review", ai_category: "Software & Hosting", ai_account: "6010", ai_confidence: 91, vendor: "Amazon Web Services" },
    { id: "t002", date: "Apr 23", description: "Stripe Payout - April Wk3", amount: 12450.00, type: "credit", status: "for_review", ai_category: "Revenue", ai_account: "4000", ai_confidence: 96, vendor: "Stripe" },
    { id: "t003", date: "Apr 22", description: "FIGMA INC.", amount: 145.00, type: "debit", status: "for_review", ai_category: "Design Tools", ai_account: "6010", ai_confidence: 88, vendor: "Figma" },
    { id: "t004", date: "Apr 20", description: "CBA Wire Transfer — Acme Corp", amount: 24500.00, type: "credit", status: "for_review", ai_category: "Accounts Receivable", ai_account: "1100", ai_confidence: 72, vendor: "Acme Corp" },
    { id: "t005", date: "Apr 18", description: "GOOGLE *WORKSPACE", amount: 1120.00, type: "debit", status: "categorized", ai_category: "Software & Hosting", ai_account: "6010", ai_confidence: 99, vendor: "Google Workspace", memo: "Monthly SaaS" },
    { id: "t006", date: "Apr 1", description: "Deel - Contractor Payroll", amount: 14500.00, type: "debit", status: "categorized", ai_category: "Payroll", ai_account: "6500", ai_confidence: 99, vendor: "Deel" },
    { id: "t007", date: "Mar 30", description: "Netflix - Card Test Charge", amount: 0.99, type: "debit", status: "excluded", vendor: "Netflix" },
];

const MOCK_GL_ACCOUNTS: GLAccount[] = [
    { code: "1100", name: "Accounts Receivable" },
    { code: "4000", name: "Revenue" },
    { code: "4100", name: "Service Revenue" },
    { code: "6010", name: "Software & Hosting" },
    { code: "6100", name: "Marketing" },
    { code: "6200", name: "Travel & Entertainment" },
    { code: "6500", name: "Payroll" },
    { code: "6600", name: "Contractors" },
    { code: "7000", name: "Interest Income" },
];

const MOCK_MATCHES: SuggestedMatch[] = [
    { id: 1, type: "invoice", number: "INV-2025-042", entity: "Acme Corp", amount: 24500.00, date: "Apr 12", confidence: 94 },
    { id: 2, type: "invoice", number: "INV-2025-039", entity: "Acme Corp", amount: 12450.00, date: "Mar 20", confidence: 41 },
];

// ─────────────────────────────────────────────────────────────────────────────
//    Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtAmt = (n: number, type: "credit" | "debit" = "debit") =>
    `${type === "credit" ? "+" : "-"}$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const cn = (...classes: (string | false | undefined | null)[]) => classes.filter(Boolean).join(" ");

// ─────────────────────────────────────────────────────────────────────────────
//    Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface BankCardPillProps { card: BankCard; active: boolean; onClick: () => void; }
const BankCardPill: React.FC<BankCardPillProps> = ({ card, active, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex-shrink-0 flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all border cursor-pointer min-w-[200px]",
            active
                ? `bg-gradient-to-br ${card.gradient} border-white/20 shadow-lg scale-[1.02]`
                : "bg-[#131316] border-white/5 hover:border-white/10 hover:bg-[#18181B]"
        )}
    >
        <div className={cn("rounded-xl w-10 h-10 flex items-center justify-center text-xs font-bold shrink-0 border", active ? "bg-white/20 border-white/20 text-white" : "bg-[#27272A] border-white/5 text-gray-400")}>
            {card.mask}
        </div>
        <div className="min-w-0">
            <p className={cn("text-sm font-semibold leading-none mb-1 truncate", active ? "text-white" : "text-gray-300")}>{card.name}</p>
            <p className={cn("text-[11px] font-mono font-semibold", active ? "text-white/80" : "text-gray-400")}>{card.currency !== "USD" ? card.balance : `$${card.balance}`}</p>
        </div>
        {card.forReview > 0 && (
            <span className={cn("ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0", active ? "bg-white/20 text-white" : "bg-[#F87171]/20 text-[#F87171]")}>
                {card.forReview}
            </span>
        )}
    </button>
);

interface TxRowProps {
    tx: BankTransaction;
    selected: boolean;
    checked: boolean;
    onSelect: () => void;
    onCheck: () => void;
}
const TxRow: React.FC<TxRowProps> = ({ tx, selected, checked, onSelect, onCheck }) => {
    const isDebit = tx.type === "debit";
    return (
        <tr
            onClick={onSelect}
            className={cn(
                "border-b border-white/5 transition-colors cursor-pointer group",
                selected ? "bg-[#8B5CF6]/5 border-l-2 border-l-[#8B5CF6]" : "hover:bg-[#131316]"
            )}
        >
            <td className="py-3 pl-4 pr-2 w-8" onClick={e => { e.stopPropagation(); onCheck(); }}>
                <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors", checked ? "bg-[#A3E635] border-[#A3E635]" : "border-white/20 group-hover:border-white/40")}>
                    {checked && <Check size={10} className="text-black" />}
                </div>
            </td>
            <td className="py-3 px-3 text-gray-500 text-xs font-mono w-20 whitespace-nowrap">{tx.date}</td>
            <td className="py-3 px-3">
                <div className="flex items-center gap-2.5">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", isDebit ? "bg-[#F87171]/10 text-[#F87171]" : "bg-[#A3E635]/10 text-[#A3E635]")}>
                        {isDebit ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
                    </div>
                    <div>
                        <p className={cn("text-sm font-medium leading-none mb-0.5", selected ? "text-white" : "text-gray-200 group-hover:text-white")}>{tx.description}</p>
                        {tx.memo && <p className="text-[10px] text-gray-500">{tx.memo}</p>}
                    </div>
                </div>
            </td>
            <td className="py-3 px-3">
                {tx.status === "for_review" ? (
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs bg-[#18181B] border border-white/10 text-gray-300 px-2 py-0.5 rounded font-medium truncate max-w-[130px]">
                            {tx.ai_account} · {tx.ai_category}
                        </span>
                        <span className="text-[9px] text-[#A3E635] font-bold">{tx.ai_confidence}%</span>
                    </div>
                ) : tx.status === "categorized" ? (
                    <span className="text-xs bg-[#A3E635]/10 border border-[#A3E635]/20 text-[#A3E635] px-2 py-0.5 rounded font-medium truncate max-w-[150px] block">
                        {tx.ai_account} · {tx.ai_category}
                    </span>
                ) : (
                    <span className="text-xs text-gray-600 italic">Excluded</span>
                )}
            </td>
            <td className={cn("py-3 px-3 text-right font-mono text-sm font-bold whitespace-nowrap", isDebit ? "text-white" : "text-[#A3E635]")}>
                {fmtAmt(tx.amount, tx.type)}
            </td>
            <td className="py-3 px-4 text-right w-16">
                <span onClick={e => { e.stopPropagation(); }} className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-gray-500 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"><MoreHorizontal size={13} /></button>
                </span>
            </td>
        </tr>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Right Panel Tabs
// ─────────────────────────────────────────────────────────────────────────────

interface CategorizePanelProps { tx: BankTransaction; onConfirm: (updatedTx: Partial<BankTransaction>) => void; }
const CategorizePanel: React.FC<CategorizePanelProps> = ({ tx, onConfirm }) => {
    const [account, setAccount] = useState(tx.ai_account || "");
    const [vendor, setVendor] = useState(tx.vendor || tx.description);
    const [taxRate, setTaxRate] = useState("None");
    const [dept, setDept] = useState("Engineering");
    const [memo, setMemo] = useState(tx.memo || "");

    const selectedGL = MOCK_GL_ACCOUNTS.find(g => g.code === account);

    return (
        <div className="flex flex-col gap-5 px-5 py-5 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {tx.ai_confidence && (
                <div className="flex items-center gap-2.5 bg-[#A3E635]/5 border border-[#A3E635]/20 rounded-xl p-3">
                    <Zap size={14} className="text-[#A3E635] shrink-0" />
                    <div>
                        <p className="text-[#A3E635] text-xs font-semibold">AI Suggestion · {tx.ai_confidence}% confidence</p>
                        <p className="text-gray-400 text-[11px] mt-0.5">Matched to {tx.ai_account} based on past entries</p>
                    </div>
                </div>
            )}
            <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Vendor / Payee</label>
                <input
                    value={vendor}
                    onChange={e => setVendor(e.target.value)}
                    className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none"
                    placeholder="Vendor name..."
                />
            </div>
            <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Chart of Accounts {selectedGL && <span className="text-[#8B5CF6] ml-1 normal-case">AI Match</span>}
                </label>
                <div className="relative">
                    <select
                        value={account}
                        onChange={e => setAccount(e.target.value)}
                        className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer"
                    >
                        <option value="">Select account...</option>
                        {MOCK_GL_ACCOUNTS.map(g => (
                            <option key={g.code} value={g.code}>{g.code} — {g.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tax Rate</label>
                    <div className="relative">
                        <select value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer">
                            <option>None</option>
                            <option>GST (5%)</option>
                            <option>HST (13%)</option>
                            <option>Out of Scope</option>
                        </select>
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Department</label>
                    <div className="relative">
                        <select value={dept} onChange={e => setDept(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer">
                            <option>Engineering</option>
                            <option>Marketing</option>
                            <option>Operations</option>
                            <option>Finance</option>
                        </select>
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Memo</label>
                <textarea
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    rows={3}
                    className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none resize-none placeholder:text-gray-600"
                    placeholder="Add internal note..."
                />
            </div>
        </div>
    );
};

interface SplitLine { id: number; account: string; amount: string; memo: string; }
interface SplitPanelProps { tx: BankTransaction; }
const SplitPanel: React.FC<SplitPanelProps> = ({ tx }) => {
    const [lines, setLines] = useState<SplitLine[]>([
        { id: 1, account: tx.ai_account || "", amount: (tx.amount / 2).toFixed(2), memo: "" },
        { id: 2, account: "", amount: (tx.amount / 2).toFixed(2), memo: "" },
    ]);

    const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const diff = Math.abs(total - tx.amount);
    const balanced = diff < 0.01;

    const addLine = () => setLines(l => [...l, { id: Date.now(), account: "", amount: "0.00", memo: "" }]);
    const removeLine = (id: number) => setLines(l => l.filter(x => x.id !== id));
    const updateLine = (id: number, field: keyof SplitLine, value: string) =>
        setLines(l => l.map(x => x.id === id ? { ...x, [field]: value } : x));

    return (
        <div className="flex flex-col gap-4 px-5 py-5 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="bg-[#18181B] border border-white/5 rounded-xl p-3">
                <p className="text-gray-400 text-xs">Original transaction</p>
                <p className="text-white font-semibold font-mono text-base mt-0.5">{fmtAmt(tx.amount, tx.type)}</p>
                <p className="text-gray-500 text-xs mt-1">{tx.description}</p>
            </div>
            <div className="space-y-3">
                {lines.map((line, i) => (
                    <div key={line.id} className="bg-[#18181B] border border-white/5 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">Split {i + 1}</span>
                            {lines.length > 2 && (
                                <button onClick={() => removeLine(line.id)} className="text-gray-600 hover:text-[#F87171] transition-colors">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <select
                                value={line.account}
                                onChange={e => updateLine(line.id, "account", e.target.value)}
                                className="w-full bg-[#131316] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer"
                            >
                                <option value="">Select GL Account...</option>
                                {MOCK_GL_ACCOUNTS.map(g => (
                                    <option key={g.code} value={g.code}>{g.code} — {g.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={line.amount}
                                onChange={e => updateLine(line.id, "amount", e.target.value)}
                                className="w-24 bg-[#131316] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none font-mono"
                            />
                            <input
                                value={line.memo}
                                onChange={e => updateLine(line.id, "memo", e.target.value)}
                                placeholder="Memo..."
                                className="flex-1 bg-[#131316] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600"
                            />
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={addLine} className="w-full py-2 border border-dashed border-white/10 rounded-xl text-xs text-gray-400 hover:border-[#8B5CF6]/40 hover:text-[#8B5CF6] transition-colors flex items-center justify-center gap-2">
                <Plus size={13} /> Add Split Line
            </button>
            <div className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium border", balanced ? "bg-[#A3E635]/5 border-[#A3E635]/20 text-[#A3E635]" : "bg-[#F87171]/5 border-[#F87171]/20 text-[#F87171]")}>
                <span>{balanced ? "✓ Balanced" : `Off by $${diff.toFixed(2)}`}</span>
                <span className="font-mono">${total.toFixed(2)} / ${tx.amount.toFixed(2)}</span>
            </div>
        </div>
    );
};

interface MatchPanelProps { tx: BankTransaction; }
const MatchPanel: React.FC<MatchPanelProps> = ({ tx }) => {
    const [searchQ, setSearchQ] = useState("");
    const [matched, setMatched] = useState<number | null>(null);

    return (
        <div className="flex flex-col gap-4 px-5 py-5 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="bg-[#18181B] border border-white/5 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-1">Matching</p>
                <p className="text-white font-semibold text-sm">{tx.description}</p>
                <p className="text-[#A3E635] font-mono font-semibold text-sm mt-0.5">{fmtAmt(tx.amount, tx.type)}</p>
            </div>
            <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search invoices, bills..."
                    className="w-full bg-[#18181B] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600"
                />
            </div>
            <div>
                <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider mb-2">AI Suggested Matches</p>
                <div className="space-y-2">
                    {MOCK_MATCHES.filter(m => !searchQ || m.entity.toLowerCase().includes(searchQ.toLowerCase()) || m.number.toLowerCase().includes(searchQ.toLowerCase())).map(m => (
                        <button
                            key={m.id}
                            onClick={() => setMatched(matched === m.id ? null : m.id)}
                            className={cn(
                                "w-full text-left p-3 rounded-xl border transition-all",
                                matched === m.id
                                    ? "bg-[#A3E635]/5 border-[#A3E635]/30 shadow-sm"
                                    : "bg-[#18181B] border-white/5 hover:border-white/15"
                            )}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <p className="text-white text-xs font-semibold">{m.number}</p>
                                    <p className="text-gray-400 text-[11px]">{m.entity} · {m.date}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-white font-mono text-xs font-semibold">${m.amount.toLocaleString()}</p>
                                    <p className={cn("text-[10px] font-bold", m.confidence > 80 ? "text-[#A3E635]" : "text-amber-400")}>{m.confidence}% match</p>
                                </div>
                            </div>
                            <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full", m.confidence > 80 ? "bg-[#A3E635]" : "bg-amber-400")} style={{ width: `${m.confidence}%` }} />
                            </div>
                            {matched === m.id && (
                                <div className="mt-2 flex items-center gap-1.5 text-[#A3E635] text-[11px] font-semibold">
                                    <CheckCircle2 size={12} /> Selected
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

interface AddManualPanelProps { onAdd: (tx: Partial<BankTransaction>) => void; }
const AddManualPanel: React.FC<AddManualPanelProps> = ({ onAdd }) => {
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [desc, setDesc] = useState("");
    const [amount, setAmount] = useState("");
    const [type, setType] = useState<"debit" | "credit">("debit");
    const [account, setAccount] = useState("");
    const [memo, setMemo] = useState("");

    return (
        <div className="flex flex-col gap-4 px-5 py-5 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                    <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Transaction description..." className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-600" />
                </div>
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none" />
                </div>
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Type</label>
                    <div className="flex bg-[#18181B] border border-white/10 rounded-lg p-0.5">
                        {(["debit", "credit"] as const).map(t => (
                            <button key={t} onClick={() => setType(t)} className={cn("flex-1 py-1.5 text-xs font-semibold rounded-md transition-all capitalize", type === t ? "bg-[#27272A] text-white shadow-sm" : "text-gray-400 hover:text-gray-200")}>
                                {t === "debit" ? "Expense" : "Income"}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Amount</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#18181B] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none font-mono placeholder:text-gray-600" />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                    <div className="relative">
                        <select className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer">
                            <option>Bank Transfer</option>
                            <option>Cash</option>
                            <option>Credit Card</option>
                            <option>Cheque</option>
                        </select>
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                </div>
            </div>
            <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">GL Account</label>
                <div className="relative">
                    <select value={account} onChange={e => setAccount(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#8B5CF6] outline-none appearance-none cursor-pointer">
                        <option value="">Select account...</option>
                        {MOCK_GL_ACCOUNTS.map(g => <option key={g.code} value={g.code}>{g.code} — {g.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
            </div>
            <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Memo</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="Internal note..." className="w-full bg-[#18181B] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#8B5CF6] outline-none resize-none placeholder:text-gray-600" />
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function BankAccountsPage() {
    const navigate = useNavigate();
    const [cards] = useState<BankCard[]>(MOCK_CARDS);
    const [activeCard, setActiveCard] = useState<BankCard>(MOCK_CARDS[0]);
    const [transactions, setTransactions] = useState<BankTransaction[]>(MOCK_TRANSACTIONS);
    const [tab, setTab] = useState<TxStatus>("for_review");
    const [search, setSearch] = useState("");
    const [checked, setChecked] = useState<Set<string | number>>(new Set());
    const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);
    const [panelTab, setPanelTab] = useState<PanelTab>("categorize");
    const [addPanelOpen, setAddPanelOpen] = useState(false);

    const tabCounts = {
        for_review: transactions.filter(t => t.status === "for_review").length,
        categorized: transactions.filter(t => t.status === "categorized").length,
        excluded: transactions.filter(t => t.status === "excluded").length,
    };

    const visibleTxns = transactions.filter(tx => {
        if (tx.status !== tab) return false;
        if (search) {
            const q = search.toLowerCase();
            return tx.description.toLowerCase().includes(q) || (tx.vendor ?? "").toLowerCase().includes(q);
        }
        return true;
    });

    const handleConfirm = (txId: string | number) => {
        setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: "categorized" as TxStatus } : t));
        const idx = visibleTxns.findIndex(t => t.id === txId);
        const next = visibleTxns[idx + 1] || visibleTxns[idx - 1] || null;
        setSelectedTx(next);
    };

    const handleExclude = (txId: string | number) => {
        setTransactions(prev => prev.map(t => t.id === txId ? { ...t, status: "excluded" as TxStatus } : t));
        setSelectedTx(null);
    };

    const toggleCheck = (id: string | number) => {
        setChecked(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const handleAddTx = (tx: Partial<BankTransaction>) => {
        const newTx: BankTransaction = {
            id: `manual-${Date.now()}`,
            date: "Today",
            description: tx.description || "Manual Entry",
            amount: tx.amount || 0,
            type: tx.type || "debit",
            status: "categorized",
            ai_category: "Manual",
            memo: tx.memo,
        };
        setTransactions(prev => [newTx, ...prev]);
        setAddPanelOpen(false);
        setSelectedTx(null);
    };

    const panelOpen = selectedTx !== null || addPanelOpen;

    const PANEL_TABS = [
        { id: "categorize" as PanelTab, label: "Categorize", icon: <Zap size={13} /> },
        { id: "split" as PanelTab, label: "Split", icon: <SplitSquareHorizontal size={13} /> },
        { id: "match" as PanelTab, label: "Match", icon: <ArrowRightLeft size={13} /> },
    ];

    return (
        <div className="flex flex-col flex-1 h-full bg-[#09090B] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ─── Header: Bank Card Selector ─── */}
            <div className="px-6 pt-5 pb-4 border-b border-white/5 flex flex-col gap-4">
                <div className="flex items-start gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                    {cards.map(card => (
                        <BankCardPill key={card.id} card={card} active={activeCard.id === card.id} onClick={() => { setActiveCard(card); setSelectedTx(null); }} />
                    ))}
                    {/* Add Account */}
                    <button
                        onClick={() => navigate("/banking/setup")}
                        className="flex-shrink-0 min-w-[140px] h-[68px] rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#A3E635]/40 hover:bg-[#A3E635]/5 transition-all group"
                    >
                        <Plus size={16} className="text-gray-500 group-hover:text-[#A3E635] transition-colors" />
                        <span className="text-[10px] text-gray-500 group-hover:text-[#A3E635] font-medium transition-colors">Connect Bank</span>
                    </button>
                </div>

                {/* Action Strip */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[280px]">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={`Search in ${activeCard.name}...`}
                            className="w-full bg-[#18181B] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:border-[#8B5CF6] outline-none placeholder:text-gray-500"
                        />
                    </div>
                    <button className="h-8 flex items-center gap-1.5 px-3 bg-[#18181B] border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-[#27272A] transition-colors">
                        <Filter size={12} /> Filter
                    </button>
                    <button className="h-8 flex items-center gap-1.5 px-3 bg-[#18181B] border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-[#27272A] transition-colors">
                        <RefreshCw size={12} /> Sync
                    </button>
                    <button className="h-8 flex items-center gap-1.5 px-3 bg-[#18181B] border border-white/10 rounded-lg text-xs text-gray-300 hover:bg-[#27272A] transition-colors">
                        <Download size={12} /> Export
                    </button>
                    <button
                        onClick={() => { setSelectedTx(null); setAddPanelOpen(true); setPanelTab("categorize"); }}
                        className="h-8 flex items-center gap-1.5 px-3 bg-[#A3E635] rounded-lg text-xs text-black font-semibold hover:bg-[#bef264] transition-colors ml-auto shadow-sm"
                    >
                        <Plus size={12} /> Add Transaction
                    </button>
                </div>
            </div>

            {/* ─── Body ─── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ─── Center: Transaction List ─── */}
                <div className={cn("flex flex-col flex-1 overflow-hidden transition-all duration-300", panelOpen ? "border-r border-white/5" : "")}>

                    {/* Tab Bar */}
                    <div className="flex items-center gap-0 px-4 pt-3 border-b border-white/5 bg-[#09090B]">
                        {(["for_review", "categorized", "excluded"] as TxStatus[]).map(t => {
                            const labels: Record<TxStatus, string> = { for_review: "For Review", categorized: "Categorized", excluded: "Excluded" };
                            const cnt = tabCounts[t];
                            const isActive = tab === t;
                            return (
                                <button
                                    key={t}
                                    onClick={() => { setTab(t); setSelectedTx(null); }}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all",
                                        isActive ? "border-[#A3E635] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
                                    )}
                                >
                                    {labels[t]}
                                    {cnt > 0 && (
                                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md", isActive && t === "for_review" ? "bg-[#A3E635] text-black" : "bg-[#27272A] text-gray-400")}>
                                            {cnt}
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                        {/* Batch actions */}
                        {checked.size > 0 && (
                            <div className="ml-auto flex items-center gap-2 pb-1">
                                <span className="text-xs text-gray-400">{checked.size} selected</span>
                                <button
                                    onClick={() => { setTransactions(p => p.map(t => checked.has(t.id) ? { ...t, status: "categorized" } : t)); setChecked(new Set()); }}
                                    className="h-7 flex items-center gap-1.5 px-3 bg-[#A3E635] rounded-lg text-[11px] text-black font-semibold hover:bg-[#bef264] transition-colors"
                                >
                                    <Check size={11} /> Confirm All
                                </button>
                                <button
                                    onClick={() => { setTransactions(p => p.map(t => checked.has(t.id) ? { ...t, status: "excluded" } : t)); setChecked(new Set()); }}
                                    className="h-7 flex items-center gap-1.5 px-3 bg-[#18181B] border border-white/10 rounded-lg text-[11px] text-gray-300 hover:bg-[#27272A] transition-colors"
                                >
                                    Exclude
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Transaction Table */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                        {visibleTxns.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-center">
                                <CheckCircle2 size={28} className="text-[#A3E635] mb-2" />
                                <p className="text-white text-sm font-medium">All caught up!</p>
                                <p className="text-gray-500 text-xs mt-1">No {tab.replace("_", " ")} transactions.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-[#09090B] sticky top-0 z-10">
                                        <th className="py-2.5 pl-4 pr-2 w-8" />
                                        <th className="py-2.5 px-3 w-20">Date</th>
                                        <th className="py-2.5 px-3">Description</th>
                                        <th className="py-2.5 px-3">Category / Account</th>
                                        <th className="py-2.5 px-3 text-right">Amount</th>
                                        <th className="py-2.5 px-4 w-16" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleTxns.map(tx => (
                                        <TxRow
                                            key={tx.id}
                                            tx={tx}
                                            selected={selectedTx?.id === tx.id}
                                            checked={checked.has(tx.id)}
                                            onSelect={() => {
                                                setSelectedTx(selectedTx?.id === tx.id ? null : tx);
                                                setAddPanelOpen(false);
                                                setPanelTab("categorize");
                                            }}
                                            onCheck={() => toggleCheck(tx.id)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ─── Right: Action Panel ─── */}
                {panelOpen && (
                    <div className="w-[360px] flex-shrink-0 flex flex-col h-full bg-[#131316] border-l border-white/5 overflow-hidden">
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-[#18181B] shrink-0">
                            <div>
                                <p className="text-white text-sm font-semibold">
                                    {addPanelOpen ? "Add Transaction" : selectedTx?.description.slice(0, 22)}
                                </p>
                                {selectedTx && !addPanelOpen && (
                                    <p className={cn("text-xs font-mono font-bold mt-0.5", selectedTx.type === "credit" ? "text-[#A3E635]" : "text-white")}>
                                        {fmtAmt(selectedTx.amount, selectedTx.type)}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => { setSelectedTx(null); setAddPanelOpen(false); }}
                                className="w-7 h-7 rounded-md bg-[#27272A] flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#3F3F46] transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Panel Tabs */}
                        {!addPanelOpen && (
                            <div className="flex border-b border-white/5 bg-[#131316] shrink-0">
                                {PANEL_TABS.map(pt => (
                                    <button
                                        key={pt.id}
                                        onClick={() => setPanelTab(pt.id)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-all",
                                            panelTab === pt.id ? "border-[#8B5CF6] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
                                        )}
                                    >
                                        {pt.icon} {pt.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Panel Content */}
                        <div className="flex-1 overflow-hidden flex flex-col">
                            {addPanelOpen
                                ? <AddManualPanel onAdd={handleAddTx} />
                                : selectedTx && panelTab === "categorize"
                                    ? <CategorizePanel tx={selectedTx} onConfirm={() => handleConfirm(selectedTx.id)} />
                                    : selectedTx && panelTab === "split"
                                        ? <SplitPanel tx={selectedTx} />
                                        : selectedTx && panelTab === "match"
                                            ? <MatchPanel tx={selectedTx} />
                                            : null}
                        </div>

                        {/* Panel Footer */}
                        <div className="px-5 py-4 border-t border-white/5 bg-[#18181B] shrink-0 flex gap-3">
                            {addPanelOpen ? (
                                <button onClick={() => handleAddTx({})} className="flex-1 py-2 rounded-lg bg-[#A3E635] text-black text-sm font-bold hover:bg-[#bef264] transition-colors shadow-sm flex items-center justify-center gap-2">
                                    <Plus size={14} /> Add to Ledger
                                </button>
                            ) : selectedTx ? (
                                <>
                                    {panelTab === "match" ? (
                                        <button onClick={() => handleConfirm(selectedTx.id)} className="flex-1 py-2 rounded-lg bg-[#A3E635] text-black text-sm font-bold hover:bg-[#bef264] transition-colors shadow-sm flex items-center justify-center gap-2">
                                            <Check size={14} /> Confirm Match
                                        </button>
                                    ) : (
                                        <button onClick={() => handleConfirm(selectedTx.id)} className="flex-1 py-2 rounded-lg bg-[#A3E635] text-black text-sm font-bold hover:bg-[#bef264] transition-colors shadow-sm flex items-center justify-center gap-2">
                                            {panelTab === "split" ? <><SplitSquareHorizontal size={14} /> Save Split</> : <><Check size={14} /> Confirm & Next <ChevronRight size={14} /></>}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleExclude(selectedTx.id)}
                                        className="py-2 px-3 rounded-lg bg-[#27272A] border border-white/5 text-gray-400 text-sm hover:bg-[#F87171]/10 hover:text-[#F87171] hover:border-[#F87171]/20 transition-all"
                                        title="Exclude transaction"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
