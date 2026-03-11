import React, { useState, useEffect, useMemo } from "react";
import { Plus, Filter, Search, Tag, Package, Wrench, Archive, Sparkles, ArrowUpRight, Check } from "lucide-react";
import { NewProductSheet } from "./NewProductSheet";

// Shared types
export type ItemKind = "product" | "service";
export type ItemStatus = "active" | "archived";

export interface ProductServiceItem {
  id: number;
  name: string;
  code: string;
  sku: string;
  kind: ItemKind;
  status: ItemStatus;
  type: string;
  category?: string;
  unitLabel?: string;
  price: number;
  currency: string;
  incomeAccountLabel?: string;
  expenseAccountLabel?: string;
  lastSoldOn?: string;
  usageCount?: number;
  isRecurring?: boolean;
  description?: string;
}

interface Stats {
  activeCount: number;
  productCount: number;
  serviceCount: number;
  avgPrice: number;
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function kindIcon(kind: ItemKind) {
  if (kind === "product") return <Package className="h-3.5 w-3.5" />;
  return <Wrench className="h-3.5 w-3.5" />;
}

export default function ProductsPage() {
  const [items, setItems] = useState<ProductServiceItem[]>([]);
  const [stats, setStats] = useState<Stats>({ activeCount: 0, productCount: 0, serviceCount: 0, avgPrice: 0 });
  const [currency, setCurrency] = useState("CAD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeKind, setActiveKind] = useState<ItemKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewItemSheet, setShowNewItemSheet] = useState(false);
  const [newItemKind, setNewItemKind] = useState<"product" | "service">("product");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeKind !== "all") params.set("kind", activeKind);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("q", search);

      const response = await fetch(`/api/products/list/?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch products");

      const json = await response.json();

      // Map API response to our interface
      const mappedItems: ProductServiceItem[] = (json.items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        code: item.code || item.sku || `ITEM-${item.id}`,
        sku: item.sku || "",
        kind: item.kind || (item.type === "PRODUCT" ? "product" : "service"),
        status: item.status || (item.is_archived ? "archived" : "active"),
        type: item.type,
        category: item.income_category_name || undefined,
        price: parseFloat(item.price) || 0,
        currency: json.currency || "CAD",
        incomeAccountLabel: item.income_account_label || undefined,
        expenseAccountLabel: item.expense_account_label || undefined,
        lastSoldOn: item.last_sold_on || undefined,
        usageCount: item.usage_count || 0,
        description: item.description || "",
      }));

      setItems(mappedItems);
      setStats({
        activeCount: json.stats?.active_count || 0,
        productCount: json.stats?.product_count || 0,
        serviceCount: json.stats?.service_count || 0,
        avgPrice: parseFloat(json.stats?.avg_price) || 0,
      });
      setCurrency(json.currency || "CAD");

      // Auto-select first item if none selected
      if (mappedItems.length > 0 && !selectedId) {
        setSelectedId(mappedItems[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeKind, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const selected = useMemo(
    () => items.find((it) => it.id === selectedId) ?? items[0] ?? null,
    [items, selectedId]
  );

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#A3E635] border-t-transparent" />
          <p className="text-sm text-gray-500">Loading catalog…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center max-w-md">
          <p className="text-sm font-medium text-red-400">{error}</p>
          <button onClick={() => { setError(null); fetchData(); }}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-500">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] px-4 pb-12 pt-6 sm:px-6 lg:px-8" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-1">Catalog</p>
            <h1 className="text-3xl font-bold tracking-tight text-white">Products &amp; Services</h1>
            <p className="text-sm text-gray-500 mt-1">Manage what you sell, price it, and map it to your ledger.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setNewItemKind("service"); setShowNewItemSheet(true); }}
              className="flex items-center gap-2 border border-white/10 bg-[#18181B] text-gray-300 rounded-xl px-4 py-2 text-xs font-semibold hover:bg-[#27272A] transition-all">
              <Wrench className="h-3.5 w-3.5" /> New Service
            </button>
            <button type="button" onClick={() => { setNewItemKind("product"); setShowNewItemSheet(true); }}
              className="flex items-center gap-2 bg-[#A3E635] text-black rounded-xl px-4 py-2 text-xs font-semibold hover:bg-[#bef264] transition-all shadow-sm">
              <Plus className="h-3.5 w-3.5" /> New Product
            </button>
          </div>
        </header>

        {/* Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active Items", value: String(stats.activeCount), sub: `${stats.productCount} products · ${stats.serviceCount} services`, color: "text-white" },
            { label: "Avg. Price", value: formatMoney(stats.avgPrice, currency), sub: "Across all active items", color: "text-[#A3E635]" },
            { label: "Services", value: String(stats.serviceCount), sub: "Subscriptions or retainers", color: "text-[#8B5CF6]" },
            { label: "Catalog Health", value: "Ready", sub: "Accounts & pricing set", color: "text-[#A3E635]" },
          ].map(c => (
            <div key={c.label} className="bg-[#131316] border border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">{c.label}</p>
              <p className={`text-2xl font-bold font-mono tracking-tight ${c.color}`}>{c.value}</p>
              <p className="text-xs text-gray-600 mt-1">{c.sub}</p>
            </div>
          ))}
        </section>

        {/* Main Content */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
          {/* Items Table */}
          <div className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-1 bg-[#09090B] rounded-lg p-1">
                {(["all", "product", "service"] as const).map(kind => (
                  <button key={kind} onClick={() => setActiveKind(kind)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${activeKind === kind ? "bg-[#27272A] text-white" : "text-gray-500 hover:text-gray-300"}`}>
                    {kind === "all" ? "All" : `${kind}s`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {(["active", "archived"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
                    className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all border ${statusFilter === s ? "bg-[#27272A] text-white border-white/10" : "text-gray-500 border-transparent hover:border-white/5"}`}>
                    {s}
                  </button>
                ))}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                    className="bg-[#09090B] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-[#8B5CF6] w-48" />
                </div>
              </div>
            </div>

            {/* Column headers */}
            <div className="hidden grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)] px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 md:grid border-b border-white/5">
              <div>Item</div><div>Ledger</div><div className="text-right">Price</div><div className="text-right">Uses</div>
            </div>
            <div className="divide-y divide-white/5">
              {items.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Package className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No items found. Try adjusting filters.</p>
                </div>
              ) : items.map(item => {
                const isSel = selected?.id === item.id;
                return (
                  <button key={item.id} onClick={() => setSelectedId(item.id)}
                    className={`flex w-full flex-col gap-4 px-5 py-4 text-left transition-all md:grid md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)] md:items-center md:gap-6 ${isSel ? "bg-[#1C1C20]" : "hover:bg-[#18181B]"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${isSel ? "bg-[#27272A] border-white/10 text-[#A3E635]" : "bg-[#18181B] border-white/5 text-gray-400"}`}>
                        {kindIcon(item.kind)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">{item.name}</span>
                          {item.status === "archived" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-white/5">Archived</span>}
                        </div>
                        <div className="flex gap-2 mt-0.5 text-[11px] text-gray-500">
                          <span className="font-mono">{item.code}</span>
                          {item.category && <><span>·</span><span>{item.category}</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 truncate">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6] shrink-0" />
                      {item.incomeAccountLabel || <span className="italic text-gray-600">No account</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white font-mono">{formatMoney(item.price, currency)}</p>
                      {item.unitLabel && <p className="text-[10px] text-gray-600">per {item.unitLabel}</p>}
                    </div>
                    <div className="text-right pr-2">
                      <span className="text-xs font-semibold text-gray-300 font-mono">{item.usageCount || 0}</span>
                      <p className="text-[10px] text-gray-600">uses</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: selected item detail */}
          <aside>
            {selected ? (
              <div className="bg-[#131316] border border-white/5 rounded-2xl p-5 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#4F46E5] text-white text-sm font-bold shadow-md">
                    {selected.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{selected.name}</h3>
                    <p className="text-[11px] text-gray-500 capitalize">{selected.kind} · {selected.code}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 py-4 border-y border-white/5">
                  <div><p className="text-[10px] text-gray-500 uppercase tracking-wider">Price</p><p className="mt-1 text-sm font-bold text-[#A3E635] font-mono">{formatMoney(selected.price, currency)}</p></div>
                  <div><p className="text-[10px] text-gray-500 uppercase tracking-wider">Usage</p><p className="mt-1 text-sm font-semibold text-white">{selected.usageCount || 0} inv.</p></div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Income Account", value: selected.incomeAccountLabel, dot: "bg-[#8B5CF6]" },
                    { label: "Expense Account", value: selected.expenseAccountLabel, dot: "bg-amber-400" },
                    { label: "Category", value: selected.category, dot: "bg-[#A3E635]" },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{r.label}</p>
                      <div className="flex items-center gap-2 bg-[#09090B] rounded-xl px-3 py-2 text-xs text-gray-300 truncate">
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${r.dot}`} />{r.value}
                      </div>
                    </div>
                  ))}
                </div>
                <a href={`/items/${selected.id}/edit/`}
                  className="block w-full rounded-xl bg-[#A3E635] py-2.5 text-center text-xs font-bold text-black hover:bg-[#bef264] transition-all">
                  Edit Item Details
                </a>
              </div>
            ) : (
              <div className="bg-[#131316] border border-white/5 rounded-2xl p-8 text-center">
                <Tag className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Select an item to see details.</p>
              </div>
            )}

            <div className="mt-4 bg-[#131316] border border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Tips</p>
              <ul className="space-y-2 text-[11px] text-gray-500">
                <li>Link each item to an <span className="text-white font-medium">income account</span> for accurate P&L.</li>
                <li>Use clear SKUs to align invoices with inventory.</li>
                <li>Archive old items to preserve historical data.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>

      <NewProductSheet open={showNewItemSheet} onOpenChange={setShowNewItemSheet} defaultKind={newItemKind} onCompleted={() => { fetchData(); }} />
    </div>
  );
}
