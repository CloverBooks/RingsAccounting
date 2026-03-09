// @ts-nocheck
import React, { useMemo, useState } from "react";
import {
    Search, Filter, Plus, MoreHorizontal, ChevronDown,
    ArrowUpRight, ArrowDownLeft, Calendar, CheckCircle2,
    X, CreditCard, Landmark, AlertCircle, Clock, Check,
    ChevronRight, Download, Upload, Copy, Trash2, Eye,
    Building2, ReceiptText, TrendingDown, TrendingUp,
    DollarSign, Zap,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

type BillStatus = "DRAFT" | "OPEN" | "PARTIAL" | "PAID" | "OVERDUE" | "VOID";

interface BillLine {
    description: string;
    account: string;
    amount: number;
}

interface Bill {
    id: number;
    bill_number: string;
    vendor_name: string;
    vendor_email?: string;
    status: BillStatus;
    issue_date: string;
    due_date: string;
    amount: number;
    amount_paid: number;
    currency: string;
    account: string;
    account_code: string;
    memo?: string;
    lines?: BillLine[];
    payment_method?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_BILLS: Bill[] = [
    { id: 1, bill_number: "BILL-2025-041", vendor_name: "Amazon Web Services", vendor_email: "aws-billing@amazon.com", status: "OPEN", issue_date: "2025-04-01", due_date: "2025-04-30", amount: 3420.50, amount_paid: 0, currency: "USD", account: "Software & Hosting", account_code: "6010", memo: "April cloud infrastructure" },
    { id: 2, bill_number: "BILL-2025-042", vendor_name: "Deel", vendor_email: "billing@deel.com", status: "OPEN", issue_date: "2025-04-01", due_date: "2025-04-25", amount: 18500.00, amount_paid: 0, currency: "USD", account: "Payroll & Benefits", account_code: "6100" },
    { id: 3, bill_number: "BILL-2025-040", vendor_name: "WeWork", vendor_email: "accounts@wework.com", status: "OVERDUE", issue_date: "2025-03-01", due_date: "2025-03-31", amount: 4200.00, amount_paid: 0, currency: "USD", account: "Office & Facilities", account_code: "6300", memo: "March coworking" },
    { id: 4, bill_number: "BILL-2025-039", vendor_name: "Figma", vendor_email: "billing@figma.com", status: "PAID", issue_date: "2025-03-15", due_date: "2025-04-14", amount: 575.00, amount_paid: 575, currency: "USD", account: "Software & Hosting", account_code: "6010" },
    { id: 5, bill_number: "BILL-2025-043", vendor_name: "Rippling", vendor_email: "billing@rippling.com", status: "OPEN", issue_date: "2025-04-03", due_date: "2025-05-03", amount: 1240.00, amount_paid: 0, currency: "USD", account: "Software & Hosting", account_code: "6010" },
    { id: 6, bill_number: "BILL-2025-038", vendor_name: "Slack Technologies", vendor_email: "billing@slack.com", status: "PAID", issue_date: "2025-03-01", due_date: "2025-03-31", amount: 312.50, amount_paid: 312.50, currency: "USD", account: "Software & Hosting", account_code: "6010" },
    { id: 7, bill_number: "BILL-2025-044", vendor_name: "Uber for Business", vendor_email: "business@uber.com", status: "PARTIAL", issue_date: "2025-04-10", due_date: "2025-05-10", amount: 980.00, amount_paid: 400, currency: "USD", account: "Travel & Ent.", account_code: "6400" },
    { id: 8, bill_number: "BILL-2025-037", vendor_name: "Google Cloud Platform", vendor_email: "cloud-billing@google.com", status: "OVERDUE", issue_date: "2025-03-01", due_date: "2025-03-28", amount: 5670.00, amount_paid: 0, currency: "USD", account: "Software & Hosting", account_code: "6010" },
    { id: 9, bill_number: "BILL-2025-045", vendor_name: "Notion Labs", vendor_email: "billing@notion.so", status: "DRAFT", issue_date: "2025-04-20", due_date: "2025-05-20", amount: 96.00, amount_paid: 0, currency: "USD", account: "Software & Hosting", account_code: "6010" },
    { id: 10, bill_number: "BILL-2025-046", vendor_name: "McAllister Law Group", vendor_email: "invoices@mcallister.com", status: "OPEN", issue_date: "2025-04-15", due_date: "2025-05-15", amount: 7500.00, amount_paid: 0, currency: "USD", account: "Legal & Professional", account_code: "6500" },
];

const STATUS_CFG: Record<BillStatus, { label: string; text: string; bg: string; border: string; dot: string }> = {
    DRAFT: { label: "Draft", text: "text-gray-400", bg: "bg-[#18181B]", border: "border-white/10", dot: "bg-gray-500" },
    OPEN: { label: "Open", text: "text-[#8B5CF6]", bg: "bg-[#8B5CF6]/10", border: "border-[#8B5CF6]/20", dot: "bg-[#8B5CF6]" },
    PARTIAL: { label: "Partial", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-400" },
    PAID: { label: "Paid", text: "text-[#A3E635]", bg: "bg-[#A3E635]/10", border: "border-[#A3E635]/20", dot: "bg-[#A3E635]" },
    OVERDUE: { label: "Overdue", text: "text-[#F87171]", bg: "bg-[#F87171]/10", border: "border-[#F87171]/20", dot: "bg-[#F87171]" },
    VOID: { label: "Void", text: "text-gray-500", bg: "bg-[#27272A]", border: "border-white/5", dot: "bg-gray-600" },
};

const PAYMENT_METHODS = ["Chase Operating *4432", "Wise EUR *9112", "Ramp Virtual *0044", "ACH Bank Transfer", "Check"];

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtUSD = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

const SparkBars: React.FC<{ color?: string }> = ({ color = "#A3E635" }) => {
    const h = useMemo(() => Array.from({ length: 12 }, () => Math.random() * 70 + 20), []);
    return (
        <div className="flex items-end gap-px h-6">
            {h.map((v, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${v}%`, backgroundColor: color, opacity: i > 8 ? 0.9 : 0.25 }} />
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Glass primitives (consistent with Overview dashboard)
// ─────────────────────────────────────────────────────────────────────────────

const GlassCard: React.FC<{ children: React.ReactNode; className?: string; accent?: "lime" | "purple" | "red" | "none" }> = ({ children, className = "", accent = "none" }) => {
    const shadow = {
        lime: "shadow-[0_0_0_1px_rgba(163,230,53,0.1),0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]",
        purple: "shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]",
        red: "shadow-[0_0_0_1px_rgba(248,113,113,0.12),0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]",
        none: "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_4px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]",
    }[accent];
    return (
        <div className={`relative rounded-[20px] overflow-hidden bg-[rgba(19,19,22,0.72)] backdrop-blur-[18px] border border-white/[0.06] transition-all duration-200 ${shadow} ${className}`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
            {children}
        </div>
    );
};

const MiniGlass: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
    <div className={`rounded-xl border border-white/[0.07] bg-[rgba(255,255,255,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}>{children}</div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Stat Card
// ─────────────────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ title: string; value: string; sub: string; trend?: string; trendUp?: boolean; sparkColor?: string; accent?: "lime" | "purple" | "red" | "none" }> = ({ title, value, sub, trend, trendUp, sparkColor = "#A3E635", accent = "none" }) => (
    <GlassCard accent={accent} className="p-5">
        <div className="flex items-start justify-between mb-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{title}</p>
            <MoreHorizontal size={13} className="text-gray-700" />
        </div>
        <p className="text-2xl font-light font-mono text-white tracking-tight mb-1">{value}</p>
        <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-600">{sub}</p>
            {trend && <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${trendUp ? "text-[#A3E635]" : "text-[#F87171]"}`}>{trendUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />} {trend}</span>}
        </div>
        <div className="mt-3"><SparkBars color={sparkColor} /></div>
    </GlassCard>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Vendor Aging
// ─────────────────────────────────────────────────────────────────────────────

const AGING = [
    { label: "Current", amount: 27260.50, pct: 58 },
    { label: "1–30 days", amount: 9390.00, pct: 20 },
    { label: "31–60 days", amount: 5670.00, pct: 12 },
    { label: "60+ days", amount: 4200.00, pct: 10 },
];

const AgingPanel: React.FC = () => (
    <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Vendor Aging Summary</p>
            <button className="flex items-center gap-0.5 text-[10px] text-[#8B5CF6] hover:text-[#a78bfa] font-semibold"><span>Report</span><ChevronRight size={11} /></button>
        </div>
        <div className="space-y-3">
            {AGING.map((a, i) => {
                const colors = ["#A3E635", "#f59e0b", "#F87171", "#ef4444"];
                return (
                    <div key={a.label}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-gray-400 font-medium">{a.label}</span>
                            <span className="text-[11px] font-mono font-bold text-white">{fmtUSD(a.amount)}</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${a.pct}%`, backgroundColor: colors[i], boxShadow: `0 0 8px ${colors[i]}55` }} />
                        </div>
                    </div>
                );
            })}
        </div>
        <div className="border-t border-white/[0.05] mt-4 pt-3 flex items-center justify-between">
            <span className="text-[10px] text-gray-600">Total Outstanding</span>
            <span className="text-sm font-mono font-bold text-white">{fmtUSD(46520.50)}</span>
        </div>
    </GlassCard>
);

// ─────────────────────────────────────────────────────────────────────────────
//  Pay Bill Drawer
// ─────────────────────────────────────────────────────────────────────────────

const PayBillDrawer: React.FC<{ bill: Bill | null; onClose: () => void; onPaid: (id: number) => void }> = ({ bill, onClose, onPaid }) => {
    const [method, setMethod] = useState(PAYMENT_METHODS[0]);
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [memo, setMemo] = useState("");
    const [done, setDone] = useState(false);

    if (!bill) return null;
    const balance = bill.amount - bill.amount_paid;

    const handlePay = () => {
        setDone(true);
        setTimeout(() => { onPaid(bill.id); onClose(); setDone(false); }, 1200);
    };

    return (
        <div className="fixed inset-0 z-50 flex" onClick={onClose}>
            <div className="flex-1 bg-black/50 backdrop-blur-sm" />
            <div className="w-[420px] h-full bg-[#0e0e11] border-l border-white/[0.07] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Pay Bill</p>
                        <h2 className="text-white font-semibold text-sm">{bill.vendor_name}</h2>
                        <p className="text-gray-600 text-[10px] font-mono">{bill.bill_number}</p>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-gray-500 hover:text-white transition-colors"><X size={13} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {/* Bill summary */}
                    <MiniGlass className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Bill Total</span>
                            <span className="text-sm font-mono font-bold text-white">{fmtUSD(bill.amount)}</span>
                        </div>
                        {bill.amount_paid > 0 && (
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Already Paid</span>
                                <span className="text-sm font-mono text-[#A3E635]">-{fmtUSD(bill.amount_paid)}</span>
                            </div>
                        )}
                        <div className="border-t border-white/[0.06] mt-2 pt-2 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Balance Due</span>
                            <span className="text-base font-mono font-bold text-white">{fmtUSD(balance)}</span>
                        </div>
                        <p className="text-[9px] text-gray-600 mt-1.5">Due: {fmtDate(bill.due_date)}</p>
                    </MiniGlass>

                    {/* Payment amount */}
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Payment Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder={balance.toFixed(2)}
                                className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl pl-7 pr-3 py-2.5 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-[#A3E635]/40 transition-colors"
                            />
                            <button onClick={() => setAmount(balance.toFixed(2))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-[#A3E635] font-semibold hover:text-[#bef264] px-1.5 py-0.5 rounded-md bg-[#A3E635]/10">Full</button>
                        </div>
                    </div>

                    {/* Payment date */}
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Payment Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#A3E635]/40 transition-colors" />
                    </div>

                    {/* Payment method */}
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                        <div className="space-y-1.5">
                            {PAYMENT_METHODS.map(m => (
                                <button key={m} onClick={() => setMethod(m)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${method === m ? "border-[#A3E635]/30 bg-[#A3E635]/8 text-white" : "border-white/[0.06] bg-white/[0.02] text-gray-400 hover:border-white/10"}`}>
                                    <Landmark size={13} className={method === m ? "text-[#A3E635]" : "text-gray-600"} />
                                    <span className="text-[12px]">{m}</span>
                                    {method === m && <Check size={11} className="ml-auto text-[#A3E635]" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Memo */}
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Memo (optional)</label>
                        <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="Payment reference..."
                            className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#A3E635]/40 transition-colors" />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-white/[0.06] space-y-2">
                    <button onClick={handlePay} disabled={done}
                        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 bg-[#A3E635] text-black hover:bg-[#bef264] disabled:opacity-70 shadow-[0_0_20px_rgba(163,230,53,0.25)]">
                        {done ? "✓ Payment Recorded" : `Pay ${amount ? fmtUSD(parseFloat(amount)) : fmtUSD(balance)}`}
                    </button>
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm text-gray-500 hover:text-white border border-white/[0.05] hover:border-white/10 transition-colors">Cancel</button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  New Bill Drawer
// ─────────────────────────────────────────────────────────────────────────────

const ACCOUNTS_LIST = ["Software & Hosting · 6010", "Payroll & Benefits · 6100", "Rent & Office · 6200", "Office & Facilities · 6300", "Travel & Entertainment · 6400", "Legal & Professional · 6500", "Marketing · 6600", "Insurance · 6700", "Other Expenses · 6900"];

const NewBillDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
    const [vendor, setVendor] = useState("");
    const [billNo, setBillNo] = useState(`BILL-2025-${String(MOCK_BILLS.length + 1).padStart(3, "0")}`);
    const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState("");
    const [account, setAccount] = useState(ACCOUNTS_LIST[0]);
    const [amount, setAmount] = useState("");
    const [memo, setMemo] = useState("");

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex" onClick={onClose}>
            <div className="flex-1 bg-black/50 backdrop-blur-sm" />
            <div className="w-[480px] h-full bg-[#0e0e11] border-l border-white/[0.07] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Accounts Payable</p>
                        <h2 className="text-white font-semibold text-sm">New Bill</h2>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-gray-500 hover:text-white"><X size={13} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {[
                        { label: "Vendor / Supplier", node: <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g. Amazon Web Services" className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#8B5CF6]/40 transition-colors" /> },
                        { label: "Bill Number", node: <input type="text" value={billNo} onChange={e => setBillNo(e.target.value)} className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-[#8B5CF6]/40 transition-colors" /> },
                    ].map(({ label, node }) => <div key={label}><label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>{node}</div>)}

                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Issue Date</label>
                            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#8B5CF6]/40" />
                        </div>
                        <div><label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Due Date</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#8B5CF6]/40" />
                        </div>
                    </div>

                    <div><label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">GL Account</label>
                        <select value={account} onChange={e => setAccount(e.target.value)} className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#8B5CF6]/40 transition-colors">
                            {ACCOUNTS_LIST.map(a => <option key={a} value={a} className="bg-[#18181B]">{a}</option>)}
                        </select>
                    </div>

                    <div><label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Total Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl pl-7 pr-3 py-2.5 text-white text-sm font-mono placeholder-gray-600 focus:outline-none focus:border-[#8B5CF6]/40 transition-colors" />
                        </div>
                    </div>

                    <div><label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Memo</label>
                        <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} placeholder="Notes about this bill..." className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#8B5CF6]/40 resize-none transition-colors" />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-white/[0.06] space-y-2">
                    <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold bg-[#8B5CF6] text-white hover:bg-[#7c3aed] transition-colors shadow-[0_0_16px_rgba(139,92,246,0.25)]">Save Bill</button>
                    <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm text-gray-500 hover:text-white border border-white/[0.05] hover:border-white/10 transition-colors">Save as Draft</button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function BillsPage() {
    const [bills, setBills] = useState<Bill[]>(MOCK_BILLS);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatus] = useState<BillStatus | "ALL">("ALL");
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [payBill, setPayBill] = useState<Bill | null>(null);
    const [newBillOpen, setNewBill] = useState(false);
    const [sortCol, setSortCol] = useState<"due_date" | "amount" | "vendor_name">("due_date");
    const [sortAsc, setSortAsc] = useState(true);

    const filtered = useMemo(() => {
        let rows = bills.filter(b => {
            const q = search.toLowerCase();
            return (!q || b.vendor_name.toLowerCase().includes(q) || b.bill_number.toLowerCase().includes(q) || b.account.toLowerCase().includes(q))
                && (statusFilter === "ALL" || b.status === statusFilter);
        });
        rows = [...rows].sort((a, b) => {
            let av: any = a[sortCol], bv: any = b[sortCol];
            if (typeof av === "string" && !isNaN(Date.parse(av))) { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
            return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });
        return rows;
    }, [bills, search, statusFilter, sortCol, sortAsc]);

    const stats = useMemo(() => ({
        open: bills.filter(b => b.status === "OPEN").reduce((s, b) => s + b.amount - b.amount_paid, 0),
        overdue: bills.filter(b => b.status === "OVERDUE").reduce((s, b) => s + b.amount, 0),
        paid30: bills.filter(b => b.status === "PAID").reduce((s, b) => s + b.amount, 0),
        partial: bills.filter(b => b.status === "PARTIAL").reduce((s, b) => s + (b.amount - b.amount_paid), 0),
    }), [bills]);

    const toggleSelect = (id: number) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(b => b.id)));
    const sort = (col: typeof sortCol) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };
    const handlePaid = (id: number) => setBills(bs => bs.map(b => b.id === id ? { ...b, status: "PAID", amount_paid: b.amount } : b));

    const STATUS_TABS: Array<{ key: BillStatus | "ALL"; label: string }> = [
        { key: "ALL", label: `All (${bills.length})` },
        { key: "OPEN", label: `Open (${bills.filter(b => b.status === "OPEN").length})` },
        { key: "OVERDUE", label: `Overdue (${bills.filter(b => b.status === "OVERDUE").length})` },
        { key: "PARTIAL", label: `Partial (${bills.filter(b => b.status === "PARTIAL").length})` },
        { key: "PAID", label: `Paid (${bills.filter(b => b.status === "PAID").length})` },
        { key: "DRAFT", label: `Draft (${bills.filter(b => b.status === "DRAFT").length})` },
    ];

    const TH: React.FC<{ children: React.ReactNode; sortKey?: typeof sortCol; className?: string }> = ({ children, sortKey, className = "" }) => (
        <th className={`px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-left whitespace-nowrap ${sortKey ? "cursor-pointer hover:text-gray-300 select-none" : ""} ${className}`}
            onClick={() => sortKey && sort(sortKey)}>
            {children} {sortKey === sortCol ? (sortAsc ? " ↑" : " ↓") : ""}
        </th>
    );

    return (
        <div className="flex-1 flex flex-col min-h-full px-5 py-6 bg-[#09090B] overflow-y-auto"
            style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>

            {/* Ambient glows */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-80px] right-[-60px] w-[400px] h-[400px] rounded-full bg-[#F87171]/4 blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[350px] h-[350px] rounded-full bg-[#8B5CF6]/4 blur-[100px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-start justify-between mb-6">
                <div>
                    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">Treasury & AP/AR</p>
                    <h1 className="text-3xl font-light tracking-[-0.03em] text-white">Bills <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F87171] to-[#8B5CF6]">(AP)</span></h1>
                    <p className="text-xs text-gray-500 mt-1">Track, manage and pay vendor bills</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="h-8 px-3 rounded-lg bg-white/[0.04] border border-white/[0.07] text-gray-400 hover:text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors"><Download size={12} /> Export</button>
                    <button className="h-8 px-3 rounded-lg bg-white/[0.04] border border-white/[0.07] text-gray-400 hover:text-white text-[11px] font-medium flex items-center gap-1.5 transition-colors"><Upload size={12} /> Import</button>
                    <button onClick={() => setNewBill(true)} className="h-8 px-4 rounded-lg bg-[#8B5CF6] text-white text-[11px] font-semibold flex items-center gap-1.5 hover:bg-[#7c3aed] transition-colors shadow-[0_0_14px_rgba(139,92,246,0.3)]"><Plus size={13} /> New Bill</button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="relative z-10 grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                <StatCard title="Open Bills" value={`$${(stats.open / 1000).toFixed(1)}k`} sub={`${bills.filter(b => b.status === "OPEN").length} bills outstanding`} trend="+12%" trendUp={false} sparkColor="#8B5CF6" accent="purple" />
                <StatCard title="Overdue" value={`$${(stats.overdue / 1000).toFixed(1)}k`} sub={`${bills.filter(b => b.status === "OVERDUE").length} bills past due`} trend="+3%" trendUp={false} sparkColor="#F87171" accent="red" />
                <StatCard title="Paid This Month" value={`$${(stats.paid30 / 1000).toFixed(1)}k`} sub={`${bills.filter(b => b.status === "PAID").length} bills settled`} trend="+24%" trendUp sparkColor="#A3E635" accent="lime" />
                <StatCard title="Partial Balance" value={`$${(stats.partial / 1000).toFixed(1)}k`} sub={`${bills.filter(b => b.status === "PARTIAL").length} partially paid`} trend="−5%" trendUp sparkColor="#f59e0b" />
            </div>

            {/* Main grid: table + aging */}
            <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">

                {/* Bills Table */}
                <GlassCard className="overflow-hidden flex flex-col">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.05] gap-3 flex-wrap">
                        <div className="relative flex-1 min-w-[180px]">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bills, vendors…"
                                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#8B5CF6]/30 transition-colors" />
                        </div>
                        {selected.size > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-400">{selected.size} selected</span>
                                <button className="h-8 px-3 rounded-lg bg-[#A3E635] text-black text-[11px] font-bold flex items-center gap-1.5"><Zap size={11} /> Pay Selected</button>
                            </div>
                        )}
                    </div>

                    {/* Status tabs */}
                    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-white/[0.05] overflow-x-auto">
                        {STATUS_TABS.map(t => (
                            <button key={t.key} onClick={() => setStatus(t.key)} className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${statusFilter === t.key ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300"}`}>{t.label}</button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full min-w-[680px]">
                            <thead>
                                <tr className="border-b border-white/[0.04]">
                                    <th className="px-4 py-3">
                                        <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll}
                                            className="w-3.5 h-3.5 rounded border-gray-600 bg-transparent accent-[#A3E635]" />
                                    </th>
                                    <TH sortKey="vendor_name">Vendor</TH>
                                    <TH>Bill #</TH>
                                    <TH>Account</TH>
                                    <TH sortKey="due_date">Due Date</TH>
                                    <TH sortKey="amount" className="text-right">Amount</TH>
                                    <TH className="text-right">Balance</TH>
                                    <TH>Status</TH>
                                    <TH></TH>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(bill => {
                                    const cfg = STATUS_CFG[bill.status];
                                    const balance = bill.amount - bill.amount_paid;
                                    const days = daysUntil(bill.due_date);
                                    const isSelected = selected.has(bill.id);
                                    return (
                                        <tr key={bill.id}
                                            className={`border-b border-white/[0.03] transition-colors group ${isSelected ? "bg-[#A3E635]/[0.04]" : "hover:bg-white/[0.02]"}`}>
                                            <td className="px-4 py-3">
                                                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(bill.id)}
                                                    className="w-3.5 h-3.5 rounded border-gray-600 bg-transparent accent-[#A3E635]" />
                                            </td>
                                            {/* Vendor */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-[10px] font-bold text-white shrink-0">{bill.vendor_name[0]}</div>
                                                    <div>
                                                        <p className="text-[12px] text-white font-medium">{bill.vendor_name}</p>
                                                        {bill.vendor_email && <p className="text-[9px] text-gray-600">{bill.vendor_email}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Bill # */}
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-[11px] text-gray-400">{bill.bill_number}</span>
                                            </td>
                                            {/* Account */}
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-[11px] text-gray-300">{bill.account}</p>
                                                    <p className="text-[9px] text-gray-600 font-mono">{bill.account_code}</p>
                                                </div>
                                            </td>
                                            {/* Due date */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <p className="text-[11px] text-gray-300">{fmtDate(bill.due_date)}</p>
                                                {bill.status !== "PAID" && bill.status !== "VOID" && (
                                                    <p className={`text-[9px] font-medium ${days < 0 ? "text-[#F87171]" : days <= 7 ? "text-amber-400" : "text-gray-600"}`}>
                                                        {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                                                    </p>
                                                )}
                                            </td>
                                            {/* Amount */}
                                            <td className="px-4 py-3 text-right">
                                                <span className="font-mono text-[12px] text-white font-semibold">{fmtUSD(bill.amount)}</span>
                                            </td>
                                            {/* Balance */}
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-mono text-[12px] font-semibold ${balance === 0 ? "text-[#A3E635]" : "text-[#F87171]"}`}>{balance === 0 ? "—" : fmtUSD(balance)}</span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${cfg.text} ${cfg.bg} ${cfg.border}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            {/* Actions */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {(bill.status === "OPEN" || bill.status === "OVERDUE" || bill.status === "PARTIAL") && (
                                                        <button onClick={() => setPayBill(bill)} className="h-7 px-2.5 rounded-lg bg-[#A3E635] text-black text-[10px] font-bold hover:bg-[#bef264] transition-colors">Pay</button>
                                                    )}
                                                    <button className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-gray-500 hover:text-white transition-colors"><Eye size={11} /></button>
                                                    <button className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-gray-500 hover:text-white transition-colors"><Copy size={11} /></button>
                                                    <button className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-gray-500 hover:text-[#F87171] transition-colors"><Trash2 size={11} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-600 text-sm">No bills match your filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-white/[0.05] flex items-center justify-between">
                        <p className="text-[10px] text-gray-600">{filtered.length} of {bills.length} bills</p>
                        <p className="text-[11px] text-gray-400">
                            Total shown: <span className="font-mono font-bold text-white">{fmtUSD(filtered.reduce((s, b) => s + b.amount, 0))}</span>
                        </p>
                    </div>
                </GlassCard>

                {/* Right panel: Aging + Quick Pay Upcoming */}
                <div className="flex flex-col gap-4">
                    <AgingPanel />

                    {/* Upcoming due */}
                    <GlassCard className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Due This Week</p>
                            <Clock size={12} className="text-gray-600" />
                        </div>
                        <div className="space-y-2">
                            {bills.filter(b => ["OPEN", "OVERDUE", "PARTIAL"].includes(b.status)).slice(0, 4).map(b => (
                                <MiniGlass key={b.id} className="p-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-white font-medium truncate">{b.vendor_name}</p>
                                        <p className={`text-[9px] ${daysUntil(b.due_date) < 0 ? "text-[#F87171]" : "text-gray-600"}`}>{daysUntil(b.due_date) < 0 ? `${Math.abs(daysUntil(b.due_date))}d overdue` : `${daysUntil(b.due_date)}d left`}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[12px] font-mono font-bold text-white">{fmtUSD(b.amount - b.amount_paid)}</p>
                                        <button onClick={() => setPayBill(b)} className="text-[9px] text-[#A3E635] font-semibold hover:text-[#bef264] transition-colors">Pay →</button>
                                    </div>
                                </MiniGlass>
                            ))}
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* Drawers */}
            <PayBillDrawer bill={payBill} onClose={() => setPayBill(null)} onPaid={handlePaid} />
            <NewBillDrawer open={newBillOpen} onClose={() => setNewBill(false)} />
        </div>
    );
}
