import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Download,
  MoreHorizontal,
  Mail,
  Phone,
  Building2,
  ArrowUpRight,
  ChevronRight,
  Receipt,
  Users,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//    Types (mirrors the existing CustomersPage types)
// ─────────────────────────────────────────────────────────────────────────────

interface Customer {
  id: number;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  open_balance: string;
  ytd_revenue?: string;
  is_active: boolean;
  currency?: string;
  location?: string;
  last_invoice_date?: string;
}

interface CustomerStats {
  total_customers: number;
  total_ytd: string;
  total_open_balance: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//    Mock Data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CUSTOMERS: Customer[] = [
  { id: 1, name: "Acme Corp", company: "Acme Corp", email: "billing@acmecorp.com", open_balance: "24500.00", ytd_revenue: "145200.00", is_active: true, location: "New York, NY" },
  { id: 2, name: "Global Tech LLC", company: "Global Tech LLC", email: "ap@globaltech.com", open_balance: "8200.00", ytd_revenue: "84000.00", is_active: true, location: "San Francisco, CA" },
  { id: 3, name: "Apple Inc", company: "Apple Inc", email: "vendor@apple.com", open_balance: "0.00", ytd_revenue: "540000.00", is_active: true, location: "Cupertino, CA" },
  { id: 4, name: "Stripe", company: "Stripe, Inc", email: "accounting@stripe.com", open_balance: "0.00", ytd_revenue: "22400.00", is_active: true, location: "San Francisco, CA" },
];

const MOCK_INVOICES = [
  { id: 1, invoice_number: "INV-2025-042", amount: "$12,450.00", status: "SENT", due_date: "Apr 26" },
  { id: 2, invoice_number: "INV-2025-039", amount: "$4,200.00", status: "PAID", due_date: "Apr 10" },
  { id: 3, invoice_number: "INV-2025-033", amount: "$7,850.00", status: "PAID", due_date: "Mar 20" },
];

// ─────────────────────────────────────────────────────────────────────────────
//    Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtN = (n: string | number) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(v)) return String(n);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
};

const getInitials = (name: string) =>
  name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

const COLORS = [
  "from-[#8B5CF6] to-[#4F46E5]",
  "from-[#3B82F6] to-[#1D4ED8]",
  "from-[#A3E635] to-[#65A30D]",
  "from-[#F59E0B] to-[#D97706]",
];

// ─────────────────────────────────────────────────────────────────────────────
//    Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface CustomerCardProps {
  customer: Customer;
  active: boolean;
  idx: number;
  onClick: () => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer, active, idx, onClick }) => {
  const hasBalance = parseFloat(customer.open_balance) > 0;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${active
          ? "bg-[#18181B] border-white/10 shadow-sm"
          : "border-transparent hover:bg-[#131316] hover:border-white/5"
        }`}
    >
      <div className={`w-9 h-9 rounded-xl flex-shrink-0 bg-gradient-to-br ${COLORS[idx % COLORS.length]} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
        {getInitials(customer.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium leading-none mb-1 truncate">{customer.name}</p>
        <p className="text-gray-500 text-[11px] truncate">{customer.company || customer.email}</p>
      </div>
      {hasBalance ? (
        <span className="text-[#F87171] text-xs font-mono font-semibold shrink-0">{fmtN(customer.open_balance)}</span>
      ) : (
        <span className="text-[#A3E635] text-xs font-semibold shrink-0">Paid</span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//    Main Component
// ─────────────────────────────────────────────────────────────────────────────

const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers/list/");
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      const list = data.customers || MOCK_CUSTOMERS;
      setCustomers(list);
      setStats(data.stats || null);
      if (list.length && !selectedId) setSelectedId(list[0].id);
    } catch {
      setCustomers(MOCK_CUSTOMERS);
      setSelectedId(MOCK_CUSTOMERS[0].id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load invoices for selected customer
  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/invoices/list/?customer=${selectedId}`)
      .then(r => r.json())
      .then(data => setCustomerInvoices(data.invoices || MOCK_INVOICES))
      .catch(() => setCustomerInvoices(MOCK_INVOICES));
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  const selected = useMemo(() => customers.find(c => c.id === selectedId) ?? customers[0] ?? null, [customers, selectedId]);

  const totalOpen = useMemo(() =>
    customers.reduce((s, c) => s + (parseFloat(c.open_balance) || 0), 0),
    [customers]);

  const totalYTD = useMemo(() =>
    customers.reduce((s, c) => s + (parseFloat(c.ytd_revenue ?? "0") || 0), 0),
    [customers]);

  return (
    <div
      className="flex flex-1 h-full bg-[#09090B] overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* LEFT: Customer List Panel */}
      <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col h-full border-r border-white/5 bg-[#09090B]">
        <div className="p-4 border-b border-white/5 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white tracking-tight">Customers</h2>
            <div className="flex gap-1.5">
              <button className="w-8 h-8 rounded-md bg-[#18181B] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all">
                <Download size={14} />
              </button>
              <a
                href="/customers/new/"
                className="w-8 h-8 rounded-md bg-[#A3E635] flex items-center justify-center text-black hover:bg-[#bef264] transition-all shadow-sm"
              >
                <Plus size={14} />
              </a>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#18181B] text-white text-xs placeholder:text-gray-500 border border-white/10 focus:border-[#8B5CF6] rounded-lg py-2 pl-8 pr-3 outline-none"
            />
          </div>

          {/* Mini stat pills */}
          <div className="flex gap-2">
            <div className="flex-1 bg-[#18181B] border border-white/5 rounded-lg px-2.5 py-2 text-center">
              <p className="text-xs font-bold text-white">{customers.length}</p>
              <p className="text-[9px] text-gray-500 uppercase">Total</p>
            </div>
            <div className="flex-1 bg-[#F87171]/10 border border-[#F87171]/20 rounded-lg px-2.5 py-2 text-center">
              <p className="text-xs font-bold text-[#F87171]">{fmtN(totalOpen)}</p>
              <p className="text-[9px] text-gray-500 uppercase">Open AR</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <p className="text-gray-600 text-sm text-center py-4">Loading...</p>
          ) : filtered.map((c, i) => (
            <CustomerCard
              key={c.id}
              customer={c}
              active={selected?.id === c.id}
              idx={i}
              onClick={() => setSelectedId(c.id)}
            />
          ))}
        </div>
      </div>

      {/* RIGHT: Customer Detail Panel */}
      <div className="hidden lg:flex flex-1 flex-col h-full overflow-y-auto bg-[#09090B]" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
        {selected ? (
          <div className="flex flex-col h-full">
            {/* Hero Header */}
            <div className="px-8 pt-8 pb-6 border-b border-white/5 bg-[#131316] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${COLORS[customers.indexOf(selected) % COLORS.length]} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                  {getInitials(selected.name)}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight mb-1">{selected.name}</h1>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-gray-400 text-xs flex items-center gap-1"><Building2 size={10} /> {selected.company || selected.name}</span>
                    {selected.location && <span className="text-gray-500 text-xs">• {selected.location}</span>}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${selected.is_active ? "text-[#A3E635] bg-[#A3E635]/10 border border-[#A3E635]/20" : "text-gray-400 bg-[#18181B] border border-white/10"}`}>
                      {selected.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/invoices/new/?customer=${selected.id}`}
                  className="flex items-center gap-2 bg-[#A3E635] text-black rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#bef264] transition-all shadow-sm"
                >
                  <Plus size={14} /> New Invoice
                </a>
                <button className="w-9 h-9 rounded-lg bg-[#18181B] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white">
                  <MoreHorizontal size={14} />
                </button>
              </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-3 gap-4 px-8 py-6">
              {[
                { label: "Annual Revenue", value: fmtN(selected.ytd_revenue || "0"), color: "text-[#A3E635]" },
                { label: "Outstanding AR", value: fmtN(selected.open_balance), color: parseFloat(selected.open_balance) > 0 ? "text-[#F87171]" : "text-[#A3E635]" },
                { label: "Invoices (YTD)", value: customerInvoices.length.toString(), color: "text-[#8B5CF6]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#131316] border border-white/5 rounded-2xl p-5">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">{label}</p>
                  <p className={`text-2xl font-bold tracking-tight font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Two Column Section */}
            <div className="grid grid-cols-2 gap-6 px-8 pb-8">
              {/* Invoices Panel */}
              <div className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-white/5">
                  <h3 className="text-white text-sm font-semibold uppercase tracking-wider">Invoices</h3>
                  <a href="/invoices" className="text-[#8B5CF6] text-xs flex items-center gap-1 hover:gap-2 transition-all">
                    View All <ChevronRight size={12} />
                  </a>
                </div>
                <div className="divide-y divide-white/5">
                  {customerInvoices.slice(0, 4).map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-3.5 hover:bg-[#18181B] transition-colors group cursor-pointer">
                      <div>
                        <p className="text-white text-sm font-medium mb-0.5">{inv.invoice_number}</p>
                        <p className="text-gray-500 text-xs">Due {inv.due_date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-mono font-semibold">{inv.amount}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${inv.status === "PAID"
                            ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20"
                            : "text-[#8B5CF6] bg-[#8B5CF6]/10 border-[#8B5CF6]/20"
                          }`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {customerInvoices.length === 0 && (
                    <div className="p-5 text-center text-gray-600 text-sm">No invoices yet.</div>
                  )}
                </div>
              </div>

              {/* Contacts & AR Distribution */}
              <div className="flex flex-col gap-4">
                {/* Contact */}
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
                  <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Contact</h3>
                  <div className="space-y-3">
                    {selected.email && (
                      <div className="flex items-center gap-3 text-sm text-gray-300 hover:text-white cursor-pointer">
                        <Mail size={14} className="text-gray-500" />
                        <span>{selected.email}</span>
                      </div>
                    )}
                    {selected.phone && (
                      <div className="flex items-center gap-3 text-sm text-gray-300 hover:text-white cursor-pointer">
                        <Phone size={14} className="text-gray-500" />
                        <span>{selected.phone}</span>
                      </div>
                    )}
                    {!selected.email && !selected.phone && (
                      <p className="text-gray-600 text-sm">No contact info.</p>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {selected.email && (
                      <a
                        href={`mailto:${selected.email}`}
                        className="flex items-center gap-1.5 text-xs bg-[#18181B] border border-white/10 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-[#27272A] hover:text-white transition-colors"
                      >
                        <Mail size={12} /> Email
                      </a>
                    )}
                    <a
                      href={`/customers/${selected.id}/`}
                      className="flex items-center gap-1.5 text-xs bg-[#18181B] border border-white/10 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-[#27272A] hover:text-white transition-colors"
                    >
                      <Receipt size={12} /> Full Profile
                    </a>
                  </div>
                </div>

                {/* AR Distribution */}
                <div className="bg-[#131316] border border-white/5 rounded-2xl p-5 flex-1">
                  <h3 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">AR Distribution</h3>
                  {totalOpen > 0 ? (
                    <div className="space-y-3">
                      {customers.filter(c => parseFloat(c.open_balance) > 0).slice(0, 4).map((c) => {
                        const pct = Math.round((parseFloat(c.open_balance) / totalOpen) * 100);
                        return (
                          <div key={c.id} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-300 truncate max-w-[120px]">{c.name}</span>
                              <span className="text-gray-400 font-mono">{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-[#27272A] rounded-full">
                              <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-4 text-center">
                      <Users size={24} className="text-[#A3E635] mb-2" />
                      <p className="text-sm text-gray-400 font-medium">All Receivables Collected!</p>
                      <p className="text-xs text-gray-600 mt-1">No open AR balances</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            Select a customer to view details.
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomersPage;
