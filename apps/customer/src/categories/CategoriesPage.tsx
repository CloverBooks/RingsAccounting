import React, { useMemo, useState, useEffect } from "react";

// Types
interface Category {
  id: number;
  name: string;
  code: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  isArchived: boolean;
  accountLabel?: string;
  accountId?: number;
  transactionCount: number;
  currentMonthTotal: number;
  ytdTotal: number;
  lastUsedAt?: string;
}

interface Stats {
  activeCount: number;
  incomeCategories: number;
  expenseCategories: number;
  uncategorizedCount: number;
  uncategorizedYtd: number;
}

const typeLabel: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
};

const typePillClasses: Record<string, string> = {
  INCOME: "bg-emerald-50 text-emerald-700 border-emerald-100",
  EXPENSE: "bg-rose-50 text-rose-700 border-rose-100",
};

const formatCurrency = (amount: number, currency = "CAD"): string => {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date?: string | null): string => {
  if (!date) return "â€”";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "â€”";
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats>({
    activeCount: 0,
    incomeCategories: 0,
    expenseCategories: 0,
    uncategorizedCount: 0,
    uncategorizedYtd: 0,
  });
  const [currency, setCurrency] = useState("CAD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "INCOME" | "EXPENSE">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter.toLowerCase());
      if (statusFilter === "archived") params.set("archived", "true");
      if (search) params.set("q", search);

      const response = await fetch(`/api/categories/list/?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch categories");

      const json = await response.json();

      // Map API response
      const mapped: Category[] = (json.categories || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        code: cat.code || `CAT-${cat.id}`,
        type: cat.type,
        description: cat.description || "",
        isArchived: cat.is_archived,
        accountLabel: cat.account_label || undefined,
        accountId: cat.account_id || undefined,
        transactionCount: cat.transaction_count || 0,
        currentMonthTotal: parseFloat(cat.current_month_total) || 0,
        ytdTotal: parseFloat(cat.ytd_total) || 0,
        lastUsedAt: cat.last_used_at || undefined,
      }));

      setCategories(mapped);
      setStats({
        activeCount: json.stats?.active_count || 0,
        incomeCategories: json.stats?.income_categories || 0,
        expenseCategories: json.stats?.expense_categories || 0,
        uncategorizedCount: json.stats?.uncategorized_count || 0,
        uncategorizedYtd: parseFloat(json.stats?.uncategorized_ytd) || 0,
      });
      setCurrency(json.currency || "CAD");

      if (mapped.length > 0 && !selectedId) {
        setSelectedId(mapped[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const filteredCategories = useMemo(() => {
    if (statusFilter === "all") return categories;
    if (statusFilter === "archived") return categories.filter((c) => c.isArchived);
    return categories.filter((c) => !c.isArchived);
  }, [categories, statusFilter]);

  const selectedCategory = useMemo(
    () => filteredCategories.find((c) => c.id === selectedId) ?? filteredCategories[0] ?? null,
    [filteredCategories, selectedId]
  );

  if (loading && categories.length === 0) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A3E635] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center max-w-md">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => { setError(null); fetchData(); }} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs text-white hover:bg-red-500">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Ledger</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Categories</h1>
            <p className="mt-1 text-sm text-gray-500">Organize money flow. Categories drive your P&L, dashboards, and tax engine.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-white/10 bg-[#18181B] px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-[#27272A] transition-colors">
              Bulk actions
            </button>
            <a href="/categories/new/" className="rounded-xl bg-[#A3E635] px-4 py-2 text-xs font-semibold text-black hover:bg-[#bef264] transition-colors shadow-sm">
              + New category
            </a>
          </div>
        </header>

        {/* KPI Cards */}
        <section className="grid gap-4 md:grid-cols-4">
          <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Active</p>
            <p className="text-2xl font-bold text-white font-mono">{stats.activeCount}</p>
            <p className="text-[11px] text-gray-600 mt-1">Across all types</p>
          </div>
          <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Income vs Expense</p>
            <div className="flex gap-3 text-sm font-semibold mb-2">
              <span className="text-[#A3E635]">{stats.incomeCategories} income</span>
              <span className="text-red-400">{stats.expenseCategories} expense</span>
            </div>
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[#27272A]">
              <div className="h-full bg-[#A3E635]" style={{ width: `${(stats.incomeCategories / Math.max(stats.incomeCategories + stats.expenseCategories, 1)) * 100}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${(stats.expenseCategories / Math.max(stats.incomeCategories + stats.expenseCategories, 1)) * 100}%` }} />
            </div>
          </div>
          <div className="bg-[#131316] border border-white/5 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Total</p>
            <p className="text-2xl font-bold text-white font-mono">{categories.length}</p>
            <p className="text-[11px] text-gray-600 mt-1">Active + archived</p>
          </div>
          <div className="bg-[#131316] border border-[#F59E0B]/20 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-3">Uncategorized</p>
            <p className="text-sm font-bold text-amber-400">{stats.uncategorizedCount} transactions</p>
            <p className="text-[11px] text-amber-600 mt-1">{stats.uncategorizedYtd > 0 ? `${formatCurrency(stats.uncategorizedYtd, currency)} YTD uncat.` : "Fully categorized âœ“"}</p>
            <a href="/banking/" className="mt-2 inline-flex text-[11px] font-bold text-amber-500 hover:underline">Review â†’</a>
          </div>
        </section>

        {/* Main Content */}
        <section className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-white/5">
            <div className="relative flex-1 min-w-[160px]">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, code, descriptionâ€¦"
                className="w-full bg-[#09090B] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 focus:border-[#8B5CF6] outline-none" />
            </div>
            <div className="flex items-center gap-1 bg-[#09090B] rounded-lg p-1">
              {(["all", "INCOME", "EXPENSE"] as const).map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${typeFilter === t ? "bg-[#27272A] text-white" : "text-gray-500 hover:text-gray-300"}`}>
                  {t === "all" ? "All types" : typeLabel[t]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-[#09090B] rounded-lg p-1">
              {(["active", "archived", "all"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${statusFilter === s ? "bg-[#27272A] text-white" : "text-gray-500 hover:text-gray-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Two-column grid */}
          <div className="grid gap-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
            {/* Table */}
            <div className="border-r border-white/5">
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Category list</p>
                <p className="text-[10px] text-gray-600">{filteredCategories.length} shown</p>
              </div>
              <div className="max-h-[500px] overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#131316] border-b border-white/5 text-[10px] uppercase tracking-wider font-bold text-gray-600">
                    <tr>
                      <th className="px-5 py-2.5">Name</th>
                      <th className="px-5 py-2.5">Type</th>
                      <th className="px-5 py-2.5">Code</th>
                      <th className="px-5 py-2.5 text-right">Month</th>
                      <th className="px-5 py-2.5 text-right">YTD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map(cat => {
                      const isSel = selectedCategory?.id === cat.id;
                      return (
                        <tr key={cat.id} onClick={() => setSelectedId(cat.id)} className={`cursor-pointer border-b border-white/5 transition last:border-b-0 ${isSel ? "bg-[#1C1C20]" : "hover:bg-[#18181B]"}`}>
                          <td className="px-5 py-3">
                            <p className="text-[13px] font-semibold text-white">{cat.name}</p>
                            <p className="text-[11px] text-gray-600 truncate">{cat.description || "No description"}</p>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cat.type === "INCOME" ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20" : "text-red-400 bg-red-500/10 border-red-500/20"}`}>
                              {typeLabel[cat.type] || cat.type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[12px] font-mono text-gray-400">{cat.code}</td>
                          <td className="px-5 py-3 text-right text-[12px] font-semibold text-white font-mono">{formatCurrency(cat.currentMonthTotal, currency)}</td>
                          <td className="px-5 py-3 text-right text-[12px] text-gray-400 font-mono">{formatCurrency(cat.ytdTotal, currency)}</td>
                        </tr>
                      );
                    })}
                    {filteredCategories.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-12 text-center text-xs text-gray-600">No categories match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detail Panel */}
            <div className="p-5 space-y-4">
              <div className="bg-[#09090B] border border-white/5 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Health Check</p>
                <p className="text-xs text-gray-400">{stats.uncategorizedCount === 0 ? "All transactions categorized â€” great shape." : `${stats.uncategorizedCount} uncategorized transactions need attention.`}</p>
              </div>

              {selectedCategory ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-white">{selectedCategory.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{selectedCategory.description || "No description provided yet."}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${selectedCategory.type === "INCOME" ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20" : "text-red-400 bg-red-500/10 border-red-500/20"}`}>
                        {typeLabel[selectedCategory.type]}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${selectedCategory.isArchived ? "text-gray-400 bg-[#18181B] border-white/5" : "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20"}`}>
                        {selectedCategory.isArchived ? "Archived" : "Active"}
                      </span>
                    </div>
                  </div>
                  <div className="bg-[#09090B] rounded-2xl border border-white/5 p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-600">Code</p>
                      <p className="mt-1 text-sm font-bold text-white font-mono">{selectedCategory.code}</p>
                      <p className="text-[10px] font-bold uppercase text-gray-600 mt-3">Ledger Account</p>
                      <p className="mt-1 text-xs text-gray-300">{selectedCategory.accountLabel || "Not mapped"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-gray-600">This month</p>
                      <p className="mt-1 text-sm font-bold text-[#A3E635] font-mono">{formatCurrency(selectedCategory.currentMonthTotal, currency)}</p>
                      <p className="text-[10px] font-bold uppercase text-gray-600 mt-3">YTD</p>
                      <p className="mt-1 text-xs text-gray-300 font-mono">{formatCurrency(selectedCategory.ytdTotal, currency)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#09090B] border border-white/5 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase text-gray-600">Usage</p>
                      <p className="mt-1 text-sm font-bold text-white">{selectedCategory.transactionCount} txns</p>
                      <p className="text-[10px] text-gray-600 mt-1">Last: {formatDate(selectedCategory.lastUsedAt)}</p>
                    </div>
                    <div className="bg-[#09090B] border border-white/5 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase text-gray-600 mb-2">Controls</p>
                      <div className="flex flex-wrap gap-1.5">
                        <a href={`/categories/${selectedCategory.id}/edit/`} className="rounded-lg bg-[#131316] border border-white/10 px-2 py-1 text-[10px] font-bold text-gray-300 hover:bg-[#27272A]">Edit</a>
                        <button className="rounded-lg bg-[#131316] border border-white/10 px-2 py-1 text-[10px] font-bold text-gray-300 hover:bg-[#27272A]">Map Tax</button>
                        <button className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/20">Archive</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-600 italic py-4">Select a category to see details.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CategoriesPage;

