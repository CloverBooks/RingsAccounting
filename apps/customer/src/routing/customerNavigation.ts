import type { NavigateFunction } from "react-router-dom";

const EXACT_ALIASES = new Map<string, string>([
  ["/accounts", "/chart-of-accounts"],
  ["/ai-companion", "/companion"],
  ["/bank/setup", "/banking/setup"],
  ["/reports/pl-shadow", "/reports/pl"],
  ["/settings/account", "/settings"],
  ["/workspace", "/dashboard"],
]);

const PREFIX_ALIASES: Array<{ from: string; to: string }> = [
  { from: "/ai-companion/", to: "/companion/" },
];

const SPA_PATHS = new Set<string>([
  "/",
  "/login",
  "/welcome",
  "/signup",
  "/auth/callback",
  "/agentic/console",
  "/agentic/receipts-demo",
  "/onboarding",
  "/dashboard",
  "/companion",
  "/companion/overview",
  "/companion/issues",
  "/companion/proposals",
  "/companion/tax",
  "/companion/tax/catalog",
  "/companion/tax/product-rules",
  "/companion/tax/settings",
  "/invoices",
  "/invoices/list",
  "/expenses",
  "/receipts",
  "/customers",
  "/suppliers",
  "/products",
  "/categories",
  "/inventory",
  "/banking",
  "/banking/setup",
  "/reconciliation",
  "/reconciliation/report",
  "/reports/pl",
  "/reports/cashflow",
  "/reports/cashflow/print",
  "/accounts",
  "/chart-of-accounts",
  "/journal",
  "/transactions",
  "/settings",
  "/settings/roles",
  "/settings/team",
  "/bank-review",
  "/books-review",
  "/help",
]);

function browserOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost";
}

function canonicalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  const exact = EXACT_ALIASES.get(trimmed);
  if (exact) {
    return exact;
  }

  const prefix = PREFIX_ALIASES.find((entry) => trimmed.startsWith(entry.from));
  if (prefix) {
    return `${prefix.to}${trimmed.slice(prefix.from.length)}`.replace(/\/{2,}/g, "/");
  }

  return trimmed;
}

function parseCandidateHref(href: string): URL | null {
  if (!href) {
    return null;
  }

  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return null;
  }

  try {
    const url = new URL(href, browserOrigin());
    if (url.origin !== browserOrigin()) {
      return null;
    }
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("/api/")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function normalizeCustomerRouteHref(href: string): string | null {
  const url = parseCandidateHref(href);
  if (!url) {
    return null;
  }

  const pathname = canonicalizePathname(url.pathname);
  if (!SPA_PATHS.has(pathname)) {
    return null;
  }

  const suffix = `${url.search}${url.hash}`;
  return pathname === "/" ? `/${suffix}`.replace(/\/$/, "") || "/" : `${pathname}${suffix}`;
}

export function isCustomerSpaHref(href: string): boolean {
  return normalizeCustomerRouteHref(href) !== null;
}

export function navigateToCustomerHref(
  navigate: NavigateFunction,
  href: string,
  options?: { replace?: boolean },
): boolean {
  const normalized = normalizeCustomerRouteHref(href);
  if (normalized) {
    navigate(normalized, { replace: options?.replace });
    return true;
  }

  if (typeof window !== "undefined" && window.location?.assign) {
    window.location.assign(href);
    return false;
  }

  return false;
}

export function normalizeCustomerPathname(pathname: string): string {
  return canonicalizePathname(pathname);
}
