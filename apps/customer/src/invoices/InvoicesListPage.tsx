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
    X,
    Check,
    Trash2,
    Send,
    FileText,
    Percent,
    Tag,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types
// ─────────────────────────────────────────────────────────────────────────────

type InvoiceStatus = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "VOID";

interface Invoice {
    id: number;
    invoice_number: string;
    customer_name: string | null;
    customer_email?: string | null;
    status: InvoiceStatus;
    issue_date: string | null;
    due_date: string | null;
    net_total: string;
    tax_total: string;
    grand_total: string;
    amount_paid: string;
    currency: string;
    memo?: string | null;
    logo?: string;
}

interface InvoiceStats {
    paid_30d: string;
    open_balance_total: string;
    overdue_total: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//    Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_INVOICES: Invoice[] = [
    {
        id: 1,
        invoice_number: "INV-2025-042",
        customer_name: "Acme Corp",
        customer_email: "billing@acmecorp.com",
        status: "SENT",
        issue_date: "2025-04-12T00:00:00Z",
        due_date: "2025-04-26T00:00:00Z",
        net_total: "11318.18",
        tax_total: "1131.82",
        grand_total: "12450.00",
        amount_paid: "0.00",
        currency: "USD",
        logo: "https://logo.clearbit.com/amazon.com",
        memo: "Q2 Enterprise Services",
    },
    {
        id: 2,
        invoice_number: "INV-2025-043",
        customer_name: "Global Tech LLC",
        status: "SENT",
        issue_date: "2025-04-15T00:00:00Z",
        due_date: "2025-04-30T00:00:00Z",
        net_total: "7454.55",
        tax_total: "745.45",
        grand_total: "8200.00",
        amount_paid: "0.00",
        currency: "USD",
        logo: "https://logo.clearbit.com/mi.com",
    },
    {
        id: 3,
        invoice_number: "INV-2025-041",
        customer_name: "Apple, Inc",
        status: "PAID",
        issue_date: "2025-04-01T00:00:00Z",
        due_date: "2025-04-15T00:00:00Z",
        net_total: "40909.09",
        tax_total: "4090.91",
        grand_total: "45000.00",
        amount_paid: "45000.00",
        currency: "USD",
        logo: "https://logo.clearbit.com/apple.com",
    },
    {
        id: 4,
        invoice_number: "INV-2025-044",
        customer_name: "Stripe",
        status: "DRAFT",
        issue_date: "2025-04-20T00:00:00Z",
        due_date: "2025-05-20T00:00:00Z",
        net_total: "1090.91",
        tax_total: "109.09",
        grand_total: "1200.00",
        amount_paid: "0.00",
        currency: "USD",
        logo: "https://logo.clearbit.com/stripe.com",
    },
];

const MOCK_STATS: InvoiceStats = {
    paid_30d: "124,500.00",
    open_balance_total: "42,300.00",
    overdue_total: "14,250.00",
};

// ─────────────────────────────────────────────────────────────────────────────
//    Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { text: string; bg: string; border: string; label: string }> = {
    DRAFT: { text: "text-gray-400", bg: "bg-[#18181B]", border: "border-white/10", label: "Draft" },
    SENT: { text: "text-[#8B5CF6]", bg: "bg-[#8B5CF6]/10", border: "border-[#8B5CF6]/20", label: "Open" },
    PARTIAL: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Partial" },
    PAID: { text: "text-[#A3E635]", bg: "bg-[#A3E635]/10", border: "border-[#A3E635]/20", label: "Paid" },
    VOID: { text: "text-[#F87171]", bg: "bg-[#F87171]/10", border: "border-[#F87171]/20", label: "Void" },
};

const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const fmtN = (n: string | number) => {
    const v = typeof n === "string" ? parseFloat(n) : n;
    if (isNaN(v)) return String(n);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
};

// ─────────────────────────────────────────────────────────────────────────────
//    Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface MetricCardProps {
    title: string;
    amount: string;
    trend: string;
    positive?: boolean;
    alert?: boolean;
    violet?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, amount, trend, positive, alert, violet }) => {
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

interface UnpaidRowProps {
    name: string;
    amount: string;
    status: string;
    isAlert?: boolean;
    isGray?: boolean;
}

const UnpaidRow: React.FC<UnpaidRowProps> = ({ name, amount, status, isAlert, isGray }) => (
    <div className="flex items-center justify-between text-sm group hover:bg-[#18181B] -mx-2 px-2 py-1.5 rounded-lg transition-colors border border-transparent hover:border-white/5 cursor-pointer">
        <div className="flex flex-col gap-0.5">
            <span className={`font-medium ${isGray ? "text-gray-400" : "text-white"}`}>{name}</span>
            <span className={`text-[10px] ${isAlert ? "text-[#F87171]" : "text-gray-500"}`}>{status}</span>
        </div>
        <span className="text-white font-mono font-semibold">{amount}</span>
    </div>
);

interface ForecastBarProps {
    overdueH: string;
    openH: string;
    paidH: string;
    label: string;
    isActive?: boolean;
}

const ForecastBar: React.FC<ForecastBarProps> = ({ overdueH, openH, paidH, label, isActive }) => (
    <div className="relative flex flex-col gap-1 w-[8%] h-full justify-end cursor-pointer group hover:scale-105 transition-transform">
        {overdueH !== "0%" && <div className="w-full bg-[#F87171]/80 border border-white/5 rounded-md" style={{ height: overdueH }} />}
        {openH !== "0%" && <div className="w-full bg-[#8B5CF6]/80 rounded-md" style={{ height: openH }} />}
        {paidH !== "0%" && (
            <div
                className={`w-full rounded-md ${isActive ? "bg-[#A3E635] shadow-[0_0_15px_rgba(163,230,53,0.3)]" : "bg-[#A3E635]/30 border border-white/10"}`}
                style={{ height: paidH }}
            />
        )}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//    Invoice Drawer
// ─────────────────────────────────────────────────────────────────────────────

interface LineItem { id: number; description: string; qty: number; rate: number; }

const TERMS_OPTS = ["Net 15", "Net 30", "Net 45", "Net 60", "Due on Receipt", "Custom"];
const CURRENCY_OPTS = ["USD", "EUR", "GBP", "CAD"];
const TAX_PRESETS = [{ label: "None", rate: 0 }, { label: "Sales Tax 8%", rate: 8 }, { label: "GST 10%", rate: 10 }, { label: "VAT 20%", rate: 20 }];

interface InvoiceDrawerProps { onClose: () => void; onSave: (inv: Invoice) => void; existing?: Invoice | null; }

const InvoiceDrawer: React.FC<InvoiceDrawerProps> = ({ onClose, onSave, existing }) => {
    const nextNum = `INV-2025-${String(Math.floor(Math.random() * 900) + 100)}`;
    const [customer, setCustomer] = useState(existing?.customer_name ?? "");
    const [email, setEmail] = useState(existing?.customer_email ?? "");
    const [invoiceNo, setInvoiceNo] = useState(existing?.invoice_number ?? nextNum);
    const [issueDate, setIssueDate] = useState(existing?.issue_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState(existing?.due_date?.slice(0, 10) ?? "");
    const [terms, setTerms] = useState("Net 30");
    const [currency, setCurrency] = useState(existing?.currency ?? "USD");
    const [taxRate, setTaxRate] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [memo, setMemo] = useState(existing?.memo ?? "");
    const [notes, setNotes] = useState("");
    const [lines, setLines] = useState<LineItem[]>(
        existing ? [{ id: 1, description: existing.memo ?? "Service", qty: 1, rate: parseFloat(existing.net_total) }]
            : [{ id: 1, description: "", qty: 1, rate: 0 }]
    );

    const addLine = () => setLines(l => [...l, { id: Date.now(), description: "", qty: 1, rate: 0 }]);
    const removeLine = (id: number) => setLines(l => l.filter(x => x.id !== id));
    const updateLine = (id: number, field: keyof LineItem, value: string | number) =>
        setLines(l => l.map(x => x.id === id ? { ...x, [field]: field === "description" ? value : Number(value) } : x));

    const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const discountAmt = subtotal * (discount / 100);
    const taxAmt = (subtotal - discountAmt) * (taxRate / 100);
    const total = subtotal - discountAmt + taxAmt;

    const applyTerms = (t: string) => {
        setTerms(t);
        if (issueDate) {
            const days = t === "Net 15" ? 15 : t === "Net 30" ? 30 : t === "Net 45" ? 45 : t === "Net 60" ? 60 : t === "Due on Receipt" ? 0 : null;
            if (days !== null) {
                const d = new Date(issueDate);
                d.setDate(d.getDate() + days);
                setDueDate(d.toISOString().slice(0, 10));
            }
        }
    };

    const handleSave = (status: InvoiceStatus) => {
        if (!customer.trim()) return;
        onSave({
            id: existing?.id ?? Date.now(),
            invoice_number: invoiceNo,
            customer_name: customer,
            customer_email: email,
            status,
            issue_date: issueDate,
            due_date: dueDate,
            net_total: String(subtotal - discountAmt),
            tax_total: String(taxAmt),
            grand_total: String(total),
            amount_paid: "0.00",
            currency,
            memo,
        });
        onClose();
    };

    const fmtLine = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#0e0e11] border-l border-white/[0.07] w-full sm:w-[520px] h-full flex flex-col shadow-2xl" style={{ fontFamily: "'Inter', sans-serif" }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-[#131316] shrink-0">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Invoices (AR)</p>
                        <h2 className="text-white font-semibold text-sm">{existing ? "Edit Invoice" : "New Invoice"}</h2>
                        <p className="text-gray-600 text-[10px] font-mono mt-0.5">{invoiceNo}</p>
                    </div>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-gray-500 hover:text-white transition-colors"><X size={13} /></button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5" style={{ scrollbarWidth: "none" }}>

                    {/* Customer + Invoice meta */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Customer / Bill To</label>
                            <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Acme Corp" className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#A3E635]/40 outline-none placeholder:text-gray-600" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Email</label>
                            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="billing@acme.com" className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#A3E635]/40 outline-none placeholder:text-gray-600" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Invoice #</label>
                            <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:border-[#A3E635]/40 outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Issue Date</label>
                            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#A3E635]/40 outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Due Date</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#A3E635]/40 outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Terms</label>
                            <div className="relative">
                                <select value={terms} onChange={e => applyTerms(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#A3E635]/40 outline-none appearance-none cursor-pointer">
                                    {TERMS_OPTS.map(t => <option key={t} className="bg-[#18181B]">{t}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Currency</label>
                            <div className="relative">
                                <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#A3E635]/40 outline-none appearance-none cursor-pointer">
                                    {CURRENCY_OPTS.map(c => <option key={c} className="bg-[#18181B]">{c}</option>)}
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Line items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Line Items</label>
                            <button onClick={addLine} className="text-[10px] text-[#A3E635] font-semibold hover:text-[#bef264] flex items-center gap-0.5"><Plus size={11} /> Add Line</button>
                        </div>
                        <div className="space-y-2">
                            <div className="grid grid-cols-[1fr_60px_80px_20px] gap-2 text-[9px] text-gray-600 uppercase tracking-widest px-1">
                                <span>Description</span><span className="text-center">Qty</span><span className="text-right">Rate</span><span />
                            </div>
                            {lines.map(line => (
                                <div key={line.id} className="grid grid-cols-[1fr_60px_80px_20px] gap-2 items-center">
                                    <input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)} placeholder="Description of service..." className="bg-[#18181B] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:border-[#A3E635]/40 outline-none placeholder:text-gray-700" />
                                    <input type="number" value={line.qty} onChange={e => updateLine(line.id, "qty", e.target.value)} className="bg-[#18181B] border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center font-mono focus:border-[#A3E635]/40 outline-none" />
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">$</span>
                                        <input type="number" value={line.rate} onChange={e => updateLine(line.id, "rate", e.target.value)} className="w-full bg-[#18181B] border border-white/10 rounded-lg pl-5 pr-2 py-2 text-xs text-white font-mono text-right focus:border-[#A3E635]/40 outline-none" />
                                    </div>
                                    <button onClick={() => removeLine(line.id)} disabled={lines.length === 1} className="text-gray-700 hover:text-[#F87171] disabled:opacity-30 transition-colors"><Trash2 size={12} /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tax + Discount */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold flex items-center gap-1"><Percent size={9} /> Tax Rate</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {TAX_PRESETS.map(p => (
                                    <button key={p.label} onClick={() => setTaxRate(p.rate)} className={`text-[10px] py-1.5 rounded-lg border transition-all ${taxRate === p.rate ? "border-[#A3E635]/30 bg-[#A3E635]/8 text-[#A3E635] font-semibold" : "border-white/[0.06] text-gray-500 hover:text-gray-300"}`}>{p.label}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold flex items-center gap-1"><Tag size={9} /> Discount %</label>
                            <div className="relative">
                                <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} placeholder="0" className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:border-[#A3E635]/40 outline-none placeholder:text-gray-600" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">%</span>
                            </div>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="bg-[#18181B] border border-white/[0.07] rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-[11px] text-gray-400"><span>Subtotal</span><span className="font-mono">{fmtLine(subtotal)}</span></div>
                        {discount > 0 && <div className="flex justify-between text-[11px] text-amber-400"><span>Discount ({discount}%)</span><span className="font-mono">-{fmtLine(discountAmt)}</span></div>}
                        {taxRate > 0 && <div className="flex justify-between text-[11px] text-gray-400"><span>Tax ({taxRate}%)</span><span className="font-mono">{fmtLine(taxAmt)}</span></div>}
                        <div className="flex justify-between text-sm font-bold text-white border-t border-white/[0.07] pt-2 mt-2"><span>Total</span><span className="font-mono text-[#A3E635]">{fmtLine(total)}</span></div>
                    </div>

                    {/* Memo + Notes */}
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Memo (internal)</label>
                        <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="For internal reference only..." className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#A3E635]/40 outline-none placeholder:text-gray-600" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-semibold">Notes for Customer</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Payment instructions, thank-you note, etc." className="w-full bg-[#18181B] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#A3E635]/40 outline-none resize-none placeholder:text-gray-600" />
                    </div>
                </div>

                {/* Footer actions */}
                <div className="px-6 py-4 border-t border-white/[0.06] bg-[#131316] shrink-0 space-y-2">
                    <button onClick={() => handleSave("SENT")} className="w-full py-3 rounded-xl bg-[#A3E635] text-black text-sm font-bold hover:bg-[#bef264] transition-colors shadow-[0_0_16px_rgba(163,230,53,0.2)] flex items-center justify-center gap-2">
                        <Send size={14} /> Send Invoice
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleSave("DRAFT")} className="py-2.5 rounded-xl border border-white/[0.07] text-gray-300 text-sm font-medium hover:bg-[#18181B] transition-colors flex items-center justify-center gap-1.5"><FileText size={13} /> Save Draft</button>
                        <button onClick={onClose} className="py-2.5 rounded-xl border border-white/[0.05] text-gray-500 text-sm hover:text-white hover:border-white/10 transition-colors">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoicesListPage({ defaultCurrency = "USD" }: { defaultCurrency?: string }) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stats, setStats] = useState<InvoiceStats | null>(null);
    const [activeTab, setActiveTab] = useState<"all" | "drafts" | "recurring">("all");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Invoice | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/invoices/list/`);
            if (!res.ok) throw new Error("fail");
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setInvoices(data.invoices || MOCK_INVOICES);
            setStats(data.stats || null);
        } catch {
            setInvoices(MOCK_INVOICES);
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const displayStats = stats || MOCK_STATS;

    const filteredInvoices = useMemo(() => {
        let list = invoices;
        if (activeTab === "drafts") list = list.filter(i => i.status === "DRAFT");
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(i =>
                i.customer_name?.toLowerCase().includes(q) ||
                i.invoice_number?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [invoices, activeTab, search]);

    const handleSaveInvoice = (inv: Invoice) => {
        setInvoices(prev => {
            const idx = prev.findIndex(x => x.id === inv.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = inv; return n; }
            return [inv, ...prev];
        });
    };

    return (
        <div
            className="flex-1 flex flex-col min-h-full px-6 py-6 bg-[#09090B] overflow-y-auto"
            style={{ fontFamily: "'Inter', sans-serif", scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        >
            {/* Top Navigation Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2 bg-[#18181B] border border-white/5 rounded-lg p-1">
                    {(["all", "drafts", "recurring"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors capitalize ${activeTab === tab
                                ? "bg-[#27272A] text-white shadow-sm"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            {tab === "all" ? "All Invoices" : tab === "drafts" ? "Drafts" : "Recurring"}
                        </button>
                    ))}
                    <button className="px-4 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white transition-colors">
                        Estimates
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
                        <input
                            type="text"
                            placeholder="Search invoice or client..."
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
                        <Plus size={14} /> Create Invoice
                    </button>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <MetricCard title="Paid (Last 30 Days)" amount={displayStats.paid_30d} trend="+12.4%" positive />
                <MetricCard title="Open Invoices" amount={displayStats.open_balance_total} trend="+4.2%" violet />
                <MetricCard title="Overdue" amount={displayStats.overdue_total} trend="-2.1%" alert />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Expected Cash Inflows */}
                <div className="xl:col-span-2 bg-[#131316] border border-white/5 rounded-2xl p-6 relative">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Expected Cash Inflows</h3>
                        <button className="flex items-center gap-2 bg-[#18181B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:bg-[#27272A]">
                            <Calendar size={12} /> By Month <ChevronDown size={12} className="ml-1" />
                        </button>
                    </div>

                    <div className="h-48 relative flex items-end justify-between px-2 pb-6 border-b border-white/5">
                        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] text-gray-500 font-mono">
                            <span>$60k</span><span>$40k</span><span>$20k</span><span>$0</span>
                        </div>
                        <div className="w-full pl-10 flex justify-between items-end h-full">
                            <ForecastBar overdueH="0%" openH="20%" paidH="45%" label="Jan" />
                            <ForecastBar overdueH="0%" openH="15%" paidH="55%" label="Feb" />
                            <ForecastBar overdueH="0%" openH="25%" paidH="40%" label="Mar" />
                            {/* Active month – Apr */}
                            <div className="flex flex-col gap-1 w-[8%] h-full justify-end relative group cursor-pointer">
                                <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-[#27272A] border border-white/10 rounded-lg p-3 shadow-xl z-20 w-44 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <p className="text-white text-xs font-semibold mb-2">April, 2025</p>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px]"><span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#F87171] rounded-sm" /> Overdue</span><span className="font-mono text-white">$4,250</span></div>
                                        <div className="flex justify-between text-[10px]"><span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#8B5CF6] rounded-sm" /> Open</span><span className="font-mono text-white">$18,400</span></div>
                                        <div className="flex justify-between text-[10px]"><span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-[#A3E635] rounded-sm" /> Paid</span><span className="font-mono text-white">$32,100</span></div>
                                    </div>
                                </div>
                                <div className="w-full bg-[#F87171] rounded-md shadow-[0_0_10px_rgba(248,113,113,0.2)]" style={{ height: "10%" }} />
                                <div className="w-full bg-[#8B5CF6] rounded-md shadow-[0_0_10px_rgba(139,92,246,0.2)]" style={{ height: "30%" }} />
                                <div className="w-full bg-[#A3E635] rounded-md shadow-[0_0_15px_rgba(163,230,53,0.3)]" style={{ height: "40%" }} />
                            </div>
                            <ForecastBar overdueH="0%" openH="50%" paidH="10%" label="May" />
                            <ForecastBar overdueH="0%" openH="35%" paidH="0%" label="Jun" />
                            <ForecastBar overdueH="0%" openH="25%" paidH="0%" label="Jul" />
                            <ForecastBar overdueH="0%" openH="40%" paidH="0%" label="Aug" />
                        </div>
                    </div>
                    <div className="pl-10 flex justify-between text-[10px] text-gray-500 font-medium mt-3 uppercase tracking-wider">
                        <span>Jan</span><span>Feb</span><span>Mar</span>
                        <span className="text-white font-bold bg-[#27272A] px-2 py-0.5 rounded">Apr</span>
                        <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
                    </div>
                </div>

                {/* Top Unpaid Balances */}
                <div className="xl:col-span-1 bg-[#131316] border border-white/5 rounded-2xl p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Top Unpaid</h3>
                        <button className="flex items-center gap-1 bg-[#18181B] border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 hover:bg-[#27272A]">
                            Customers <ChevronDown size={12} className="ml-1" />
                        </button>
                    </div>
                    <div className="flex items-end gap-2 mb-4">
                        <span className="text-3xl font-bold text-white tracking-tight font-mono">$56,550</span>
                        <span className="text-xs text-gray-500 pb-1 uppercase">Total Open</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden gap-1 mb-6 bg-[#18181B] border border-white/5 p-0.5">
                        <div className="bg-[#8B5CF6] w-[45%] rounded-full shadow-[0_0_8px_rgba(139,92,246,0.4)]" />
                        <div className="bg-[#8B5CF6]/60 w-[25%] rounded-full" />
                        <div className="bg-[#8B5CF6]/40 w-[15%] rounded-full" />
                        <div className="bg-[#27272A] w-[15%] rounded-full" />
                    </div>
                    <div className="space-y-4 flex-1">
                        <UnpaidRow name="Acme Corp" amount="$24,500.00" status="2 Overdue" isAlert />
                        <UnpaidRow name="Global Tech LLC" amount="$14,200.00" status="Due in 5 days" />
                        <UnpaidRow name="Global Tech LLC" amount="$8,500.00" status="Due next month" />
                        <UnpaidRow name="Other (12 Customers)" amount="$9,350.00" status="Various terms" isGray />
                    </div>
                    <button className="w-full mt-4 py-2 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 hover:bg-[#18181B] transition-colors">
                        Send Reminders
                    </button>
                </div>
            </div>

            {/* Invoice Ledger Table */}
            <div className="bg-[#131316] border border-white/5 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm">
                <div className="flex justify-between items-center p-4 border-b border-white/5">
                    <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Invoice Ledger</h3>
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
                                <th className="py-3 px-4">Invoice No.</th>
                                <th className="py-3 px-4">Customer</th>
                                <th className="py-3 px-4">Issue Date</th>
                                <th className="py-3 px-4">Due Date</th>
                                <th className="py-3 px-4 text-right">Amount</th>
                                <th className="py-3 px-4 text-center">Status</th>
                                <th className="py-3 px-4 w-10" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-gray-600 text-sm">
                                        Loading invoices...
                                    </td>
                                </tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-gray-600 text-sm">
                                        No invoices found.
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((inv) => {
                                    const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.DRAFT;
                                    return (
                                        <tr
                                            key={inv.id}
                                            className="border-b border-white/5 hover:bg-[#18181B] transition-colors group cursor-pointer"
                                        >
                                            <td className="py-3 px-4">
                                                <input type="checkbox" className="accent-[#A3E635] bg-[#18181B] border-white/10 rounded" />
                                            </td>
                                            <td className="py-3 px-4 text-white font-medium text-sm font-mono">
                                                {inv.invoice_number}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-6 h-6 rounded-md bg-white border border-white/10 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                                                        {inv.logo ? (
                                                            <img src={inv.logo} className="max-w-full max-h-full object-contain" alt={inv.customer_name || ""} />
                                                        ) : (
                                                            <span className="text-black text-[10px] font-bold">{(inv.customer_name || "?")[0]}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-gray-300 text-sm font-medium truncate max-w-[150px]">
                                                        {inv.customer_name || "Unknown"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-gray-400 text-sm">{formatDate(inv.issue_date)}</td>
                                            <td className="py-3 px-4 text-gray-400 text-sm">{formatDate(inv.due_date)}</td>
                                            <td className="py-3 px-4 text-white font-mono text-sm font-semibold text-right">
                                                {fmtN(inv.grand_total)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`text-xs px-2.5 py-1 rounded-md font-semibold border inline-block w-20 text-center ${cfg.text} ${cfg.bg} ${cfg.border}`}>
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {inv.status !== "PAID" && inv.status !== "DRAFT" && (
                                                        <a
                                                            href={`/invoices/${inv.id}/receive-payment/`}
                                                            className="text-[#A3E635] bg-[#A3E635]/10 border border-[#A3E635]/20 text-[10px] font-bold px-2 py-1 rounded hover:bg-[#A3E635]/20 transition-colors"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            Receive
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setEditTarget(inv); setDrawerOpen(true); }}
                                                        className="text-gray-400 hover:text-white transition-colors"
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

            {/* Invoice Drawer */}
            {drawerOpen && (
                <InvoiceDrawer
                    onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
                    onSave={handleSaveInvoice}
                    existing={editTarget}
                />
            )}
        </div>
    );
}
