import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, Search, Mail, Phone, Download,
  TrendingUp, CreditCard, FileText, MoreHorizontal,
  Building2, ChevronRight, Receipt, Truck,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  total_spend: string;
  ytd_spend: string;
  expense_count: number;
  is_active?: boolean;
  last_expense_date?: string;
}

interface SupplierExpense {
  id: number;
  expense_number?: string;
  issue_date?: string;
  status?: string;
  total?: string;
  net_total?: string;
}

type DetailTab = "overview" | "expenses" | "credits" | "activity" | "notes";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SUPPLIERS: Supplier[] = [
  { id: 1, name: "Adobe Inc", email: "billing@adobe.com", phone: "+1 408-536-6000", address: "345 Park Ave, San Jose, CA", total_spend: "48000.00", ytd_spend: "22400.00", expense_count: 18, is_active: true },
  { id: 2, name: "AWS / Amazon", email: "aws-billing@amazon.com", phone: "", address: "410 Terry Ave N, Seattle, WA", total_spend: "124500.00", ytd_spend: "66200.00", expense_count: 52, is_active: true },
  { id: 3, name: "Stripe, Inc", email: "support@stripe.com", phone: "+1 888-963-4977", address: "354 Oyster Point Blvd, San Francisco, CA", total_spend: "8900.00", ytd_spend: "4100.00", expense_count: 9, is_active: true },
  { id: 4, name: "Office Depot", email: "ar@officedepot.com", phone: "+1 800-463-3768", address: "6600 N Military Trl, Boca Raton, FL", total_spend: "3200.00", ytd_spend: "1600.00", expense_count: 6, is_active: false },
];

const MOCK_EXPENSES: SupplierExpense[] = [
  { id: 1, expense_number: "EXP-2025-041", issue_date: "2025-03-01", status: "PAID", total: "4200.00" },
  { id: 2, expense_number: "EXP-2025-028", issue_date: "2025-02-15", status: "PAID", total: "3600.00" },
  { id: 3, expense_number: "EXP-2025-011", issue_date: "2025-01-22", status: "PAID", total: "7400.00" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtN = (n: string | number, currency = "USD") => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return String(n);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
};

const getInitials = (name: string) =>
  name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

const COLORS = [
  "from-[#8B5CF6] to-[#4F46E5]",
  "from-[#3B82F6] to-[#1D4ED8]",
  "from-[#F59E0B] to-[#D97706]",
  "from-[#EF4444] to-[#DC2626]",
];

// ─── SupplierCard ─────────────────────────────────────────────────────────────

const SupplierCard: React.FC<{
  supplier: Supplier; active: boolean; idx: number; onClick: () => void;
}> = ({ supplier, active, idx, onClick }) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${active ? "bg-[#18181B] border-white/10 shadow-sm" : "border-transparent hover:bg-[#131316] hover:border-white/5"
      }`}
  >
    <div className={`w-9 h-9 rounded-xl flex-shrink-0 bg-gradient-to-br ${COLORS[idx % COLORS.length]} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
      {getInitials(supplier.name)}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-sm font-medium leading-none mb-1 truncate">{supplier.name}</p>
      <p className="text-gray-500 text-[11px] truncate">{supplier.email || supplier.address}</p>
    </div>
    <div className="text-right shrink-0">
      <p className="text-[#A3E635] text-xs font-mono font-semibold">{fmtN(supplier.ytd_spend)}</p>
      <p className="text-gray-600 text-[10px]">{supplier.expense_count} exp</p>
    </div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [supplierExpenses, setSupplierExpenses] = useState<SupplierExpense[]>([]);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<Array<{ id: number; text: string; ts: string }>>([]);

  useEffect(() => {
    fetch("/api/suppliers/list/")
      .then(r => r.json())
      .then(d => {
        const list = d.suppliers || MOCK_SUPPLIERS;
        setSuppliers(list);
        if (list.length) setSelectedId(list[0].id);
      })
      .catch(() => {
        setSuppliers(MOCK_SUPPLIERS);
        setSelectedId(MOCK_SUPPLIERS[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/expenses/list/?supplier=${selectedId}`)
      .then(r => r.json())
      .then(d => setSupplierExpenses(d.expenses || MOCK_EXPENSES))
      .catch(() => setSupplierExpenses(MOCK_EXPENSES));
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return suppliers.filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [suppliers, search]);

  const selected = useMemo(() => suppliers.find(s => s.id === selectedId) ?? null, [suppliers, selectedId]);
  const totalYTD = useMemo(() => suppliers.reduce((s, v) => s + (parseFloat(v.ytd_spend) || 0), 0), [suppliers]);

  const TABS: { id: DetailTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "expenses", label: "Expenses" },
    { id: "credits", label: "Credits" },
    { id: "activity", label: "Activity" },
    { id: "notes", label: "Notes" },
  ];

  return (
    <div className="flex flex-1 h-full bg-[#09090B] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* LEFT: List */}
      <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col h-full border-r border-white/5 bg-[#09090B]">
        <div className="p-4 border-b border-white/5 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white tracking-tight">Suppliers</h2>
            <div className="flex gap-1.5">
              <button className="w-8 h-8 rounded-md bg-[#18181B] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all">
                <Download size={14} />
              </button>
              <a href="/suppliers/new/" className="w-8 h-8 rounded-md bg-[#A3E635] flex items-center justify-center text-black hover:bg-[#bef264] transition-all shadow-sm">
                <Plus size={14} />
              </a>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#18181B] text-white text-xs placeholder:text-gray-500 border border-white/10 focus:border-[#8B5CF6] rounded-lg py-2 pl-8 pr-3 outline-none"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 bg-[#18181B] border border-white/5 rounded-lg px-2.5 py-2 text-center">
              <p className="text-xs font-bold text-white">{suppliers.filter(s => s.is_active !== false).length}</p>
              <p className="text-[9px] text-gray-500 uppercase">Active</p>
            </div>
            <div className="flex-1 bg-[#A3E635]/10 border border-[#A3E635]/20 rounded-lg px-2.5 py-2 text-center">
              <p className="text-xs font-bold text-[#A3E635]">{fmtN(totalYTD)}</p>
              <p className="text-[9px] text-gray-500 uppercase">YTD Spend</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <p className="text-gray-600 text-sm text-center py-4">Loading...</p>
          ) : filtered.map((s, i) => (
            <SupplierCard key={s.id} supplier={s} active={selected?.id === s.id} idx={i} onClick={() => { setSelectedId(s.id); setActiveTab("overview"); }} />
          ))}
        </div>
      </div>

      {/* RIGHT: Detail */}
      <div className="hidden lg:flex flex-1 flex-col h-full overflow-y-auto bg-[#09090B]" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
        {selected ? (
          <div className="flex flex-col h-full">
            {/* Hero */}
            <div className="px-8 pt-8 pb-6 border-b border-white/5 bg-[#131316] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${COLORS[suppliers.indexOf(selected) % COLORS.length]} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                  {getInitials(selected.name)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{selected.name}</h1>
                  <div className="flex gap-2 flex-wrap">
                    {selected.email && <span className="text-gray-400 text-xs flex items-center gap-1"><Mail size={10} /> {selected.email}</span>}
                    {selected.phone && <span className="text-gray-500 text-xs">• {selected.phone}</span>}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${selected.is_active !== false ? "text-[#A3E635] bg-[#A3E635]/10 border border-[#A3E635]/20" : "text-gray-400 bg-[#18181B] border border-white/10"}`}>
                      {selected.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/expenses/new/?supplier=${selected.id}`} className="flex items-center gap-2 bg-[#A3E635] text-black rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#bef264] transition-all shadow-sm">
                  <Plus size={14} /> New Expense
                </a>
                <button className="w-9 h-9 rounded-lg bg-[#18181B] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white">
                  <MoreHorizontal size={14} />
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 px-8 py-6">
              {[
                { label: "Total Spend", value: fmtN(selected.total_spend), color: "text-white" },
                { label: "YTD Spend", value: fmtN(selected.ytd_spend), color: "text-[#A3E635]" },
                { label: "Expense Count", value: String(selected.expense_count), color: "text-[#8B5CF6]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#131316] border border-white/5 rounded-2xl p-5">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">{label}</p>
                  <p className={`text-2xl font-bold tracking-tight font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="px-8 pb-8">
              <div className="flex gap-1 mb-5 bg-[#131316] border border-white/5 rounded-xl p-1">
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${activeTab === t.id ? "bg-[#27272A] text-white shadow-sm" : "text-gray-500 hover:text-gray-300"}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Overview */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Contact Details</h3>
                    <div className="space-y-3">
                      {selected.email && <div className="flex items-center gap-3 text-sm text-gray-300"><Mail size={14} className="text-gray-500" /> {selected.email}</div>}
                      {selected.phone && <div className="flex items-center gap-3 text-sm text-gray-300"><Phone size={14} className="text-gray-500" /> {selected.phone}</div>}
                      {selected.address && <div className="flex items-center gap-3 text-sm text-gray-300"><Building2 size={14} className="text-gray-500" /> {selected.address}</div>}
                    </div>
                  </div>
                  <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Spend Trend</h3>
                    <div className="space-y-2">
                      {suppliers.filter(s => parseFloat(s.ytd_spend) > 0).slice(0, 5).map(s => {
                        const pct = Math.round((parseFloat(s.ytd_spend) / (totalYTD || 1)) * 100);
                        return (
                          <div key={s.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-300 truncate max-w-[160px]">{s.name}</span>
                              <span className="text-gray-400 font-mono">{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-[#27272A] rounded-full"><div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Expenses */}
              {activeTab === "expenses" && (
                <div className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="flex justify-between items-center p-4 border-b border-white/5">
                    <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Expenses</h3>
                    <a href={`/expenses/new/?supplier=${selected.id}`} className="text-[#8B5CF6] text-xs flex items-center gap-1 hover:gap-2 transition-all">View All <ChevronRight size={12} /></a>
                  </div>
                  <div className="divide-y divide-white/5">
                    {supplierExpenses.length === 0 ? (
                      <div className="p-8 text-center">
                        <FileText size={24} className="text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No expenses yet</p>
                      </div>
                    ) : supplierExpenses.slice(0, 6).map(exp => (
                      <div key={exp.id} className="flex items-center justify-between p-3.5 hover:bg-[#18181B] transition-colors cursor-pointer">
                        <div>
                          <p className="text-white text-sm font-medium mb-0.5">{exp.expense_number || `EXP-${exp.id}`}</p>
                          <p className="text-gray-500 text-xs">{exp.issue_date ? new Date(exp.issue_date).toLocaleDateString() : "—"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-mono font-semibold">{fmtN(exp.total || exp.net_total || "0")}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${exp.status === "PAID" ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20" : "text-[#8B5CF6] bg-[#8B5CF6]/10 border-[#8B5CF6]/20"}`}>
                            {exp.status || "DRAFT"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Credits */}
              {activeTab === "credits" && (
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Credits & Prepayments</h3>
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#A3E635] text-black text-[11px] font-semibold hover:bg-[#bef264] transition-colors"><Plus size={12} /> Issue Debit Memo</button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#18181B] text-gray-300 text-[11px] font-medium hover:bg-[#27272A] transition-colors"><CreditCard size={12} /> Prepayment</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[{ l: "Open A/P", v: "$0.00" }, { l: "Open Credits", v: "$0.00" }, { l: "Prepayments", v: "$0.00" }].map(c => (
                      <div key={c.l} className="bg-[#18181B] border border-white/5 rounded-xl p-3">
                        <p className="text-[10px] text-gray-500 mb-1">{c.l}</p>
                        <p className="text-sm font-semibold text-white">{c.v}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-gray-600 text-xs text-center mt-6">No debit memos or prepayments recorded yet.</p>
                </div>
              )}

              {/* Activity */}
              {activeTab === "activity" && (
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
                  <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Activity Timeline</h3>
                  {supplierExpenses.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-4">No activity yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {supplierExpenses.slice(0, 6).map(exp => (
                        <div key={exp.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#27272A] flex items-center justify-center text-gray-400 shrink-0">
                            <FileText size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white">Expense {exp.status === "PAID" ? "paid" : "created"}</p>
                            <p className="text-[11px] text-gray-500">{exp.expense_number || `EXP-${exp.id}`} · {fmtN(exp.total || "0")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {activeTab === "notes" && (
                <div className="space-y-4">
                  <div className="bg-[#131316] border border-white/5 rounded-2xl p-4">
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note about this supplier..."
                      className="w-full h-20 bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 resize-none focus:border-[#8B5CF6] outline-none" />
                    <div className="flex justify-end mt-2">
                      <button onClick={() => { if (!noteText.trim()) return; setNotes([{ id: Date.now(), text: noteText, ts: new Date().toISOString() }, ...notes]); setNoteText(""); }}
                        disabled={!noteText.trim()}
                        className="px-3 py-1.5 rounded-lg bg-[#A3E635] text-black text-[11px] font-semibold disabled:opacity-40 transition-all">
                        Add Note
                      </button>
                    </div>
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-gray-600 text-xs text-center py-4">No notes yet. Add one above.</p>
                  ) : notes.map(n => (
                    <div key={n.id} className="bg-[#131316] border border-white/5 rounded-xl p-4">
                      <p className="text-white text-xs">{n.text}</p>
                      <p className="text-gray-600 text-[10px] mt-1">{new Date(n.ts).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            <div className="text-center">
              <Truck size={32} className="text-gray-700 mx-auto mb-3" />
              <p>Select a supplier to view details.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuppliersPage;
