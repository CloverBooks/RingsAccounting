import React, { useMemo, useState, useCallback } from "react";
import { Search, Plus, Package2, AlertTriangle, Warehouse, ArrowUpRight, Filter, X } from "lucide-react";
import { ReceiveStockSheet, AdjustStockSheet } from "./InventoryMovementSheets";
import type { InventoryLocation } from "./api";

// NOTE:
// - TailwindCSS assumed to be available.
// - JetBrains Mono should be registered in your global CSS as `font-mono`.
// - Replace placeholder data + hooks with real API wiring when ready.

// -----------------------------
// Types
// -----------------------------

export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock" | "discontinued";

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  status: InventoryStatus;
  onHand: number;
  committed: number;
  available: number;
  daysOfCover: number | null;
  locations: {
    name: string;
    onHand: number;
  }[];
  lastMovement: string; // e.g. "2025-12-20"
}

export interface InventoryOverviewStats {
  totalSkus: number;
  totalOnHandUnits: number;
  totalOnHandValue?: number; // optional until GL wiring is done
  lowStockCount: number;
  outOfStockCount: number;
  locationsCount: number;
}

interface InventoryOverviewData {
  stats: InventoryOverviewStats;
  items: InventoryItem[];
}

// -----------------------------
// Demo hook (replace with real API later)
// -----------------------------

function useInventoryOverviewDemo(): { data: InventoryOverviewData | null; isLoading: boolean } {
  const [isLoading] = useState(false);

  const data = useMemo<InventoryOverviewData>(() => {
    const items: InventoryItem[] = [
      {
        id: "1",
        name: "Blue Hoodie Premium",
        sku: "HD-BLUE-XS-2025",
        category: "Apparel",
        status: "in_stock",
        onHand: 128,
        committed: 34,
        available: 94,
        daysOfCover: 32,
        locations: [
          { name: "Main", onHand: 90 },
          { name: "Outlet", onHand: 38 },
        ],
        lastMovement: "2025-12-21",
      },
      {
        id: "2",
        name: "Black Hoodie Premium",
        sku: "HD-BLACK-M-2025",
        category: "Apparel",
        status: "low_stock",
        onHand: 22,
        committed: 18,
        available: 4,
        daysOfCover: 5,
        locations: [
          { name: "Main", onHand: 18 },
          { name: "Outlet", onHand: 4 },
        ],
        lastMovement: "2025-12-20",
      },
      {
        id: "3",
        name: "Everyday Notebook A5",
        sku: "NB-A5-GRID-001",
        category: "Stationery",
        status: "out_of_stock",
        onHand: 0,
        committed: 0,
        available: 0,
        daysOfCover: null,
        locations: [],
        lastMovement: "2025-12-12",
      },
      {
        id: "4",
        name: "Wireless Mouse Pro",
        sku: "MS-WL-PRO-2025",
        category: "Accessories",
        status: "in_stock",
        onHand: 64,
        committed: 9,
        available: 55,
        daysOfCover: 21,
        locations: [
          { name: "Main", onHand: 40 },
          { name: "Online", onHand: 24 },
        ],
        lastMovement: "2025-12-22",
      },
    ];

    const stats: InventoryOverviewStats = {
      totalSkus: items.length,
      totalOnHandUnits: items.reduce((acc, item) => acc + item.onHand, 0),
      totalOnHandValue: undefined,
      lowStockCount: items.filter((i) => i.status === "low_stock").length,
      outOfStockCount: items.filter((i) => i.status === "out_of_stock").length,
      locationsCount: new Set(items.flatMap((i) => i.locations.map((l) => l.name))).size,
    };

    return { stats, items };
  }, []);

  return { data, isLoading };
}

// -----------------------------
// Small UI helpers
// -----------------------------

function classNames(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}

function statusLabel(status: InventoryStatus): string {
  switch (status) {
    case "in_stock":
      return "In stock";
    case "low_stock":
      return "Low stock";
    case "out_of_stock":
      return "Out of stock";
    case "discontinued":
      return "Discontinued";
    default:
      return status;
  }
}

function statusToneClasses(status: InventoryStatus): string {
  switch (status) {
    case "in_stock":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "low_stock":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "out_of_stock":
      return "bg-rose-50 text-rose-700 border-rose-100";
    case "discontinued":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

// -----------------------------
// Metric cards (top strip)
// -----------------------------

interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, helper, icon }) => {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/80 shadow-[0_16px_60px_rgba(15,23,42,0.06)]">
      {/* liquid metal background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-slate-50 via-white to-slate-200 blur-2xl" />
        <div className="absolute -bottom-14 -left-20 h-40 w-40 rounded-full bg-gradient-to-tr from-white via-slate-50 to-slate-200 blur-2xl" />
      </div>

      <div className="relative flex h-full flex-col gap-2 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          {icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/70 shadow-[0_0_0_1px_rgba(148,163,184,0.25)]">
              {icon}
            </div>
          )}
        </div>

        <div className="mt-1 flex items-baseline justify-between gap-4">
          <p className="font-mono-soft text-2xl md:text-[28px] font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        {helper && (
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        )}
      </div>
    </div>
  );
};

// -----------------------------
// Main Page Component
// -----------------------------

const InventoryPage: React.FC = () => {
  const { data, isLoading } = useInventoryOverviewDemo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "all">("all");
  const [receiveSheetOpen, setReceiveSheetOpen] = useState(false);
  const [adjustSheetOpen, setAdjustSheetOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [movementLogOpen, setMovementLogOpen] = useState(false);

  const selectedItem = useMemo(
    () => data?.items.find((i) => i.id === selectedId) ?? data?.items[0] ?? null,
    [data, selectedId]
  );

  const filteredItems = useMemo(() => {
    if (!data) return [];

    return data.items.filter((item) => {
      const matchesStatus =
        statusFilter === "all" ? true : item.status === statusFilter;
      const term = search.trim().toLowerCase();
      const matchesSearch =
        term.length === 0 ||
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [data, search, statusFilter]);

  // Mock locations for demo - in production, this would come from API
  const mockLocations: InventoryLocation[] = useMemo(() => [
    { id: 1, workspace: 1, name: "Main Warehouse", code: "MAIN", location_type: "warehouse", parent: null, created_at: "", updated_at: "" },
    { id: 2, workspace: 1, name: "Retail Outlet", code: "OUTLET", location_type: "retail", parent: null, created_at: "", updated_at: "" },
    { id: 3, workspace: 1, name: "Online Fulfillment", code: "ONLINE", location_type: "virtual", parent: null, created_at: "", updated_at: "" },
  ], []);

  const handleReceiveStock = useCallback(() => {
    setReceiveSheetOpen(true);
  }, []);

  const handleAdjustStock = useCallback(() => {
    setAdjustSheetOpen(true);
  }, []);

  const handleSheetComplete = useCallback(() => {
    // In production, this would refetch data
    console.log("Sheet action completed - would refresh data");
  }, []);

  return (
    <div className="min-h-screen bg-[#09090B] px-4 pb-10 pt-6 md:px-8 lg:px-12" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Page header */}
      <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">Inventory</p>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl mt-1">Your stock, under control.</h1>
          <p className="text-sm text-gray-500 mt-1">Live view of items, locations, and availability across your workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSavedViewsOpen(true)}
            className="flex items-center gap-2 border border-white/10 bg-[#18181B] px-4 py-2 text-xs font-medium text-gray-300 rounded-xl hover:bg-[#27272A] transition-colors">
            <Filter className="h-3.5 w-3.5" /> Saved views
          </button>
          <button onClick={handleReceiveStock}
            className="flex items-center gap-2 bg-[#A3E635] text-black px-4 py-2 text-xs font-semibold rounded-xl hover:bg-[#bef264] transition-colors shadow-sm">
            <Plus className="h-3.5 w-3.5" /> Receive stock
          </button>
        </div>
      </header>

      {/* Metric Cards */}
      <section className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: "Total SKUs", value: isLoading || !data ? "â€”" : String(data.stats.totalSkus), sub: "Tracked items", icon: <Package2 className="h-4 w-4 text-gray-400" />, color: "text-white" },
          { label: "On-Hand Units", value: isLoading || !data ? "â€”" : data.stats.totalOnHandUnits.toLocaleString(), sub: "Across all locations", icon: <Warehouse className="h-4 w-4 text-gray-400" />, color: "text-[#A3E635]" },
          { label: "Low & Out of Stock", value: isLoading || !data ? "â€”" : `${data.stats.lowStockCount} low Â· ${data.stats.outOfStockCount} out`, sub: "May need reordering", icon: <AlertTriangle className="h-4 w-4 text-amber-400" />, color: "text-amber-400" },
          { label: "Locations", value: isLoading || !data ? "â€”" : String(data.stats.locationsCount), sub: "Warehouses & virtual", icon: <ArrowUpRight className="h-4 w-4 text-[#8B5CF6]" />, color: "text-[#8B5CF6]" },
        ].map(c => (
          <div key={c.label} className="bg-[#131316] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">{c.label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#27272A]">{c.icon}</div>
            </div>
            <p className={`text-xl font-bold font-mono tracking-tight ${c.color}`}>{c.value}</p>
            <p className="text-[11px] text-gray-600 mt-1">{c.sub}</p>
          </div>
        ))}
      </section>

      {/* Main: table + detail */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Left: table */}
        <div className="bg-[#131316] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#A3E635] text-black text-xs font-bold">INV</div>
              <div>
                <p className="text-sm font-semibold text-white">Inventory items</p>
                <p className="text-xs text-gray-500">Search, filter, inspect across locations.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A3E635]" /> Live
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2 border border-white/10 bg-[#09090B] rounded-xl px-3 py-2 text-xs text-gray-400">
              <Search className="h-4 w-4 flex-none text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, SKU, or category"
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-gray-600" />
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              {([["all", "All"], ["in_stock", "In stock"], ["low_stock", "Low"], ["out_of_stock", "Out"]] as const).map(([value, label]) => (
                <button key={value} onClick={() => setStatusFilter(value as InventoryStatus | "all")}
                  className={`rounded-xl border px-3 py-1.5 transition ${statusFilter === value ? "border-[#A3E635] bg-[#A3E635]/10 text-[#A3E635]" : "border-white/10 bg-[#18181B] text-gray-400 hover:border-white/20"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="border-b border-white/5 text-[11px] uppercase tracking-[0.12em] text-gray-600">
                <tr>
                  {["Item", "SKU", "Category", "On hand", "Committed", "Available", "Days", "Status"].map((h, i) => (
                    <th key={h} className={`px-4 py-3 font-medium ${i >= 3 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading || !data ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600">Loading inventoryâ€¦</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600">No items match this view.</td></tr>
                ) : filteredItems.map(item => {
                  const isSel = selectedItem?.id === item.id;
                  const statusColor = item.status === "in_stock" ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20"
                    : item.status === "low_stock" ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                      : item.status === "out_of_stock" ? "text-red-400 bg-red-500/10 border-red-500/20"
                        : "text-gray-400 bg-[#18181B] border-white/10";
                  return (
                    <tr key={item.id} onClick={() => setSelectedId(item.id)}
                      className={`cursor-pointer transition ${isSel ? "bg-[#1C1C20]" : "hover:bg-[#18181B]"}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-[11px] text-gray-600">Last Â· {item.lastMovement}</p>
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-[11px] text-gray-400">{item.sku}</span></td>
                      <td className="px-4 py-3 text-[11px] text-gray-400">{item.category}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-white">{item.onHand.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{item.committed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-white">{item.available.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{item.daysOfCover ?? "â€”"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusColor}`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: detail panel */}
        <aside className="bg-[#131316] border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">Snapshot</p>
              <h2 className="mt-1 text-sm font-semibold text-white">{selectedItem ? selectedItem.name : "Select an item"}</h2>
              {selectedItem && <p className="text-[11px] text-gray-500 mt-0.5">{selectedItem.category} Â· SKU <span className="font-mono">{selectedItem.sku}</span></p>}
            </div>
            {selectedItem && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${selectedItem.status === "in_stock" ? "text-[#A3E635] bg-[#A3E635]/10 border-[#A3E635]/20" : selectedItem.status === "low_stock" ? "text-amber-400 bg-amber-400/10 border-amber-400/20" : "text-red-400 bg-red-500/10 border-red-500/20"}`}>
                {statusLabel(selectedItem.status)}
              </span>
            )}
          </div>

          {selectedItem ? (
            <>
              <div className="grid grid-cols-3 gap-3 bg-[#09090B] rounded-2xl border border-white/5 p-3">
                {[{ l: "On hand", v: selectedItem.onHand.toLocaleString() }, { l: "Available", v: selectedItem.available.toLocaleString() }, { l: "Days cover", v: selectedItem.daysOfCover ?? "â€”" }].map(c => (
                  <div key={c.l}>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-gray-600">{c.l}</p>
                    <p className="mt-1 font-mono text-sm font-bold text-white">{c.v}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-gray-500">Location split</p>
                {selectedItem.locations.length === 0 ? (
                  <p className="text-[11px] text-gray-600">No active locations.</p>
                ) : selectedItem.locations.map(loc => {
                  const ratio = selectedItem.onHand ? loc.onHand / selectedItem.onHand : 0;
                  return (
                    <div key={loc.name} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>{loc.name}</span>
                        <span className="font-mono text-white">{loc.onHand.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#27272A]">
                        <div className="h-full rounded-full bg-[#A3E635]" style={{ width: `${Math.max(8, ratio * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-600">Last movement Â· {selectedItem.lastMovement}</p>
              <div className="flex flex-wrap gap-2">
                {[["Receive", handleReceiveStock], ["Adjust", handleAdjustStock], ["Movement log", () => setMovementLogOpen(true)]].map(([label, fn]) => (
                  <button key={label as string} onClick={fn as () => void}
                    className="flex items-center gap-1 border border-white/10 bg-[#18181B] px-3 py-1.5 text-[11px] font-medium text-gray-300 rounded-xl hover:bg-[#27272A] transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#09090B] p-5 text-center">
              <p className="text-sm text-gray-500">Select an item to see its inventory story.</p>
            </div>
          )}
        </aside>
      </section>

      {/* Receive Stock Sheet */}
      <ReceiveStockSheet open={receiveSheetOpen} onOpenChange={setReceiveSheetOpen} workspaceId={1}
        itemId={selectedItem ? parseInt(selectedItem.id, 10) : 0} locations={mockLocations}
        defaultLocationId={mockLocations[0]?.id || null} onCompleted={handleSheetComplete} />

      {/* Adjust Stock Sheet */}
      <AdjustStockSheet open={adjustSheetOpen} onOpenChange={setAdjustSheetOpen} workspaceId={1}
        itemId={selectedItem ? parseInt(selectedItem.id, 10) : 0} locations={mockLocations}
        defaultLocationId={mockLocations[0]?.id || null} onCompleted={handleSheetComplete} />

      {/* Saved Views Modal */}
      {savedViewsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70" onClick={() => setSavedViewsOpen(false)} />
          <div className="relative z-50 w-full max-w-md rounded-2xl border border-white/10 bg-[#131316] p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Saved Views</h3>
              <button onClick={() => setSavedViewsOpen(false)} className="p-1.5 rounded-lg hover:bg-[#27272A] text-gray-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1">
              {["All Items", "Low Stock Items", "Out of Stock", "Recent Movements"].map(v => (
                <button key={v} className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#18181B] text-sm text-gray-300 transition-colors">{v}</button>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-600">More views coming soon.</p>
          </div>
        </div>
      )}

      {/* Movement Log Modal */}
      {movementLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMovementLogOpen(false)} />
          <div className="relative z-50 w-full max-w-2xl rounded-2xl border border-white/10 bg-[#131316] p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Movement Log</h3>
              <button onClick={() => setMovementLogOpen(false)} className="p-1.5 rounded-lg hover:bg-[#27272A] text-gray-400"><X className="h-4 w-4" /></button>
            </div>
            {selectedItem ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Movement history for <strong className="text-white">{selectedItem.name}</strong></p>
                <div className="border border-white/5 rounded-xl divide-y divide-white/5">
                  <div className="px-4 py-3 flex justify-between text-sm"><span className="text-gray-500">Last movement</span><span className="text-white">{selectedItem.lastMovement}</span></div>
                  <div className="px-4 py-3 flex justify-between text-sm"><span className="text-gray-500">Current on-hand</span><span className="text-white">{selectedItem.onHand.toLocaleString()} units</span></div>
                </div>
                <p className="text-xs text-gray-600">Full history in a future update.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Select an item to view its movement log.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
