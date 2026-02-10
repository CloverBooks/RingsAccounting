/**
 * Companion Control Tower — Helpers
 *
 * Pure utility functions shared across tower components.
 */

import {
  Banknote,
  FileText,
  Layers,
  ListChecks,
} from "lucide-react";
import type { SurfaceKey, FocusMode } from "./types";

// ─── Class-name joiner ──────────────────────────────────────────────────────
export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

// ─── Surface metadata ───────────────────────────────────────────────────────
export function surfaceMeta(key: SurfaceKey) {
  const map: Record<SurfaceKey, { label: string; icon: typeof Banknote }> = {
    receipts: { label: "Receipts", icon: FileText },
    invoices: { label: "Invoices", icon: Layers },
    books: { label: "Books Review", icon: ListChecks },
    banking: { label: "Banking", icon: Banknote },
  };
  return map[key];
}

export const SURFACE_URLS: Record<SurfaceKey, string> = {
  banking: "/banking",
  invoices: "/invoices",
  receipts: "/expenses",
  books: "/books-review",
};

// ─── Surface key normalization ──────────────────────────────────────────────
export function normalizeSurfaceKey(value?: string | null): SurfaceKey | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "bank" || v === "banking" || v === "bank_review" || v === "bank-review") return "banking";
  if (v === "books" || v === "book" || v === "books_review" || v === "books-review") return "books";
  if (v === "receipts" || v === "expenses") return "receipts";
  if (v === "invoices" || v === "revenue") return "invoices";
  return null;
}

export function surfaceKeyToFilterParam(surface: SurfaceKey) {
  return surface === "banking" ? "bank" : surface;
}

// ─── Money formatting ───────────────────────────────────────────────────────
export function formatMoney(x: number | undefined | null) {
  if (x == null || Number.isNaN(x)) return "$0";
  const abs = Math.abs(x);
  if (abs >= 1_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(x / 1_000).toFixed(1)}K`;
  return `$${x.toFixed(0)}`;
}

// ─── Focus tone badge ───────────────────────────────────────────────────────
export function focusTone(mode: FocusMode) {
  if (mode === "all_clear")
    return { label: "All Clear", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
  if (mode === "fire_drill")
    return { label: "Action Needed", className: "bg-rose-50 text-rose-700 border border-rose-200" };
  return { label: "Watchlist", className: "bg-amber-50 text-amber-700 border border-amber-200" };
}

// ─── Severity chips ─────────────────────────────────────────────────────────
export function severityChip(sev: "low" | "medium" | "high") {
  if (sev === "high")
    return { label: "Needs attention", cls: "bg-rose-50 text-rose-700 border border-rose-200" };
  if (sev === "medium")
    return { label: "Review", cls: "bg-amber-50 text-amber-700 border border-amber-200" };
  return { label: "Ready", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
}
