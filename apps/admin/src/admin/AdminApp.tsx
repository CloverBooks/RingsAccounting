import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppShell } from "@shared-ui";
import { fetchRuntimeSettings, type RuntimeSettingsSnapshot } from "./api";
import { OverviewSection } from "./OverviewSection";
import { Card, StatusPill, cn } from "./AdminUI";
import { useAuth } from "../contexts/AuthContext";

type Role = "support" | "finance" | "engineer" | "superadmin";

type NavSectionId =
  | "overview"
  | "employees"
  | "users"
  | "support"
  | "approvals"
  | "workspaces"
  | "banking"
  | "reconciliation"
  | "ledger"
  | "invoices"
  | "expenses"
  | "autonomy"
  | "ai-monitoring"
  | "feature-flags"
  | "settings"
  | "logs";

interface NavItem {
  id: NavSectionId;
  label: string;
  description?: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { id: "overview", label: "Overview", description: "System health & KPIs" },
      { id: "users", label: "Users", description: "Manage accounts & access" },
      { id: "employees", label: "Employees", description: "Admin access & roles" },
      { id: "support", label: "Support", description: "Tickets & customer issues" },
      { id: "approvals", label: "Approvals", description: "Maker-Checker workflow" },
      { id: "logs", label: "Audit & logs", description: "Recent admin activity" },
    ],
  },
  {
    label: "Accounting",
    items: [
      { id: "workspaces", label: "Workspaces", description: "Tenant books & health" },
      { id: "banking", label: "Banking", description: "Bank feeds & imports" },
      { id: "reconciliation", label: "Reconciliation", description: "Unreconciled items" },
      { id: "ledger", label: "Ledger health", description: "Trial balance & anomalies" },
      { id: "invoices", label: "Invoices", description: "Global sales audit" },
      { id: "expenses", label: "Expenses", description: "Purchases & receipts" },
    ],
  },
  {
    label: "Intelligence & Ops",
    items: [
      { id: "autonomy", label: "Autonomy Engine", description: "Queues, breakers, and modes" },
      { id: "ai-monitoring", label: "AI monitoring", description: "Engine telemetry & runtime state" },
      { id: "feature-flags", label: "Feature flags", description: "Rollouts & experiments" },
      { id: "settings", label: "Settings", description: "Runtime config & auth posture" },
    ],
  },
];

const importUsersSection = () => import("./UsersSection");
const importWorkspacesSection = () => import("./WorkspacesSection");
const importBankingSection = () => import("./BankingSection");
const importSupportSection = () => import("./SupportSection");
const importApprovalsSection = () => import("./ApprovalsSection");
const importEmployeesSection = () => import("./EmployeesSection");
const importAutonomySection = () => import("./AutonomySection");
const importAiOpsSection = () => import("./AiOpsSection");
const importFeatureFlagsSection = () => import("./FeatureFlagsSection");
const importRuntimeSettingsSection = () => import("./RuntimeSettingsSection");
const importOperationalSections = () => import("./AdminOperationalSections");

const LazyUsersSection = React.lazy(async () => {
  const module = await importUsersSection();
  return { default: module.UsersSection };
});
const LazyWorkspacesSection = React.lazy(async () => {
  const module = await importWorkspacesSection();
  return { default: module.WorkspacesSection };
});
const LazyBankingSection = React.lazy(async () => {
  const module = await importBankingSection();
  return { default: module.BankingSection };
});
const LazySupportSection = React.lazy(async () => {
  const module = await importSupportSection();
  return { default: module.SupportSection };
});
const LazyApprovalsSection = React.lazy(async () => {
  const module = await importApprovalsSection();
  return { default: module.ApprovalsSection };
});
const LazyEmployeesSection = React.lazy(async () => {
  const module = await importEmployeesSection();
  return { default: module.EmployeesSection };
});
const LazyAutonomySection = React.lazy(async () => {
  const module = await importAutonomySection();
  return { default: module.AutonomySection };
});
const LazyAiOpsSection = React.lazy(async () => {
  const module = await importAiOpsSection();
  return { default: module.AiOpsSection };
});
const LazyFeatureFlagsSection = React.lazy(async () => {
  const module = await importFeatureFlagsSection();
  return { default: module.FeatureFlagsSection };
});
const LazyRuntimeSettingsSection = React.lazy(async () => {
  const module = await importRuntimeSettingsSection();
  return { default: module.RuntimeSettingsSection };
});
const LazyReconciliationSection = React.lazy(async () => {
  const module = await importOperationalSections();
  return { default: module.ReconciliationSection };
});
const LazyLedgerSection = React.lazy(async () => {
  const module = await importOperationalSections();
  return { default: module.LedgerSection };
});
const LazyInvoicesSection = React.lazy(async () => {
  const module = await importOperationalSections();
  return { default: module.InvoicesSection };
});
const LazyExpensesSection = React.lazy(async () => {
  const module = await importOperationalSections();
  return { default: module.ExpensesSection };
});
const LazyLogsSection = React.lazy(async () => {
  const module = await importOperationalSections();
  return { default: module.LogsSection };
});

const sectionPrefetchers: Partial<Record<NavSectionId, () => Promise<unknown>>> = {
  users: importUsersSection,
  employees: importEmployeesSection,
  support: importSupportSection,
  approvals: importApprovalsSection,
  workspaces: importWorkspacesSection,
  banking: importBankingSection,
  reconciliation: importOperationalSections,
  ledger: importOperationalSections,
  invoices: importOperationalSections,
  expenses: importOperationalSections,
  autonomy: importAutonomySection,
  "ai-monitoring": importAiOpsSection,
  "feature-flags": importFeatureFlagsSection,
  settings: importRuntimeSettingsSection,
  logs: importOperationalSections,
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void) => number;
  cancelIdleCallback?: (id: number) => void;
};

function scheduleWhenIdle(callback: () => void): () => void {
  if (typeof window === "undefined") {
    callback();
    return () => undefined;
  }

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const idleId = idleWindow.requestIdleCallback(callback);
    return () => idleWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(callback, 0);
  return () => window.clearTimeout(timeoutId);
}

const SectionFallback: React.FC = () => (
  <Card>
    <p className="text-sm text-slate-600">Loading section...</p>
  </Card>
);

const LogoutButton: React.FC = () => {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
      </svg>
      {isLoggingOut ? "Logging out..." : "Log out"}
    </button>
  );
};

const TopBar: React.FC<{
  currentSection: NavSectionId;
  onSelect: (id: NavSectionId) => void;
}> = ({ currentSection, onSelect }) => {
  const [runtime, setRuntime] = useState<RuntimeSettingsSnapshot | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);

  const loadRuntime = useCallback(async () => {
    if (runtimeLoading || runtime) {
      return;
    }

    setRuntimeLoading(true);
    try {
      const snapshot = await fetchRuntimeSettings();
      setRuntime(snapshot);
      setRuntimeError(null);
    } catch (error: any) {
      setRuntimeError(error?.message || "Runtime unavailable");
    } finally {
      setRuntimeLoading(false);
    }
  }, [runtime, runtimeLoading]);

  useEffect(() => {
    if (currentSection === "settings") {
      void loadRuntime();
      return;
    }
    if (runtime || runtimeError || runtimeLoading) {
      return;
    }
    return scheduleWhenIdle(() => {
      void loadRuntime();
    });
  }, [currentSection, loadRuntime, runtime, runtimeError, runtimeLoading]);

  const sectionLabel = navGroups
    .flatMap((group) => group.items)
    .find((item) => item.id === currentSection)?.label;
  const runtimeSummary = runtime
    ? `${runtime.environment.name} / ${runtime.build.service}`
    : runtimeError
      ? "runtime unavailable"
      : "loading runtime";
  const runtimeTone = runtime?.environment.jwt_secret_configured ? "good" : "warning";
  const oauthTone = runtime?.environment.google_oauth_enabled ? "good" : "warning";
  const quickAction =
    currentSection === "settings"
      ? { label: "Open audit logs", target: "logs" as NavSectionId }
      : { label: "Open runtime settings", target: "settings" as NavSectionId };

  const handleQuickAction = () => {
    if (quickAction.target === "settings") {
      void loadRuntime();
    }
    onSelect(quickAction.target);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700">
            CB
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Clover Books - Admin</p>
            <p className="text-xs text-slate-700">{sectionLabel ?? "Overview"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-700">
          <div className="hidden items-center gap-2 sm:flex">
            <StatusPill tone={runtimeTone} label={runtimeSummary} />
            {runtime ? (
              <StatusPill
                tone={oauthTone}
                label={runtime.environment.google_oauth_enabled ? "oauth on" : "oauth off"}
              />
            ) : null}
          </div>
          <button
            onClick={handleQuickAction}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {quickAction.label}
          </button>
        </div>
      </div>
    </header>
  );
};

const Sidebar: React.FC<{
  current: NavSectionId;
  onSelect: (id: NavSectionId) => void;
  onPrefetch: (id: NavSectionId) => void;
  canManageAdminUsers: boolean;
}> = ({ current, onSelect, onPrefetch, canManageAdminUsers }) => {
  return (
    <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex lg:w-72">
      <div className="border-b border-slate-200 px-4 pb-3 pt-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Navigation</p>
        <p className="text-xs text-slate-600">Internal-only rails. Every action is accountable.</p>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => item.id !== "employees" || canManageAdminUsers);
          if (visibleItems.length === 0) {
            return null;
          }
          return (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = current === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelect(item.id)}
                      onMouseEnter={() => onPrefetch(item.id)}
                      onFocus={() => onPrefetch(item.id)}
                      className={cn(
                        "flex w-full flex-col rounded-xl border px-2.5 py-2 text-left text-xs transition",
                        active
                          ? "border-slate-200 bg-white text-slate-900 shadow-sm"
                          : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100",
                      )}
                    >
                      <span className="font-semibold">{item.label}</span>
                      {item.description ? (
                        <span className="mt-0.5 text-[11px] text-slate-500">{item.description}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-slate-200 px-4 py-3">
        <LogoutButton />
        <div className="text-[11px] text-slate-600">
          <p>Everything you do here leaves a trail.</p>
          <p className="mt-0.5">Built for internal ops / Clover Books</p>
        </div>
      </div>
    </aside>
  );
};

const roleFromAuth = (opts: { role?: string | null; isStaff?: boolean; isSuperuser?: boolean }): Role => {
  const role = (opts.role || "").toLowerCase();
  if (role === "support") return "support";
  if (role === "finance" || role === "ops") return "finance";
  if (role === "engineer" || role === "engineering") return "engineer";
  if (role === "superadmin" || role === "admin") return "superadmin";
  if (opts.isSuperuser || opts.isStaff) return "superadmin";
  return "support";
};

const roleLevel = (role: Role) => (role === "superadmin" ? 4 : role === "engineer" ? 3 : role === "finance" ? 2 : 1);

const routeSection = (pathname: string): NavSectionId => {
  const path = (pathname || "/").replace(/^\/+/, "");
  const segment = path.split("/")[0] || "overview";
  const aliases: Record<string, NavSectionId> = {
    "control-tower": "overview",
    audit: "logs",
  };
  const candidate = aliases[segment] || (segment === "" ? "overview" : segment);
  const valid = navGroups.flatMap((group) => group.items).some((item) => item.id === candidate);
  return valid ? (candidate as NavSectionId) : "overview";
};

export const AdminApp: React.FC = () => {
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canManageAdminUsers = Boolean(auth.user?.is_admin || auth.user?.role === "superadmin");
  const canGrantSuperadmin = Boolean(auth.user?.role === "superadmin");
  const role = useMemo(
    () =>
      roleFromAuth({
        role: auth.user?.role,
        isSuperuser: Boolean(auth.user?.isSuperuser ?? auth.user?.is_superuser ?? auth.user?.is_admin),
      }),
    [auth.user?.isSuperuser, auth.user?.is_admin, auth.user?.is_superuser, auth.user?.role],
  );
  const current = useMemo(() => routeSection(location.pathname), [location.pathname]);

  const prefetchSection = useCallback((id: NavSectionId) => {
    if (id === "overview") {
      return;
    }
    const importer = sectionPrefetchers[id];
    if (importer) {
      void importer();
    }
  }, []);

  useEffect(() => {
    prefetchSection(current);
  }, [current, prefetchSection]);

  const handleSelect = (id: NavSectionId) => {
    if (id === "overview") {
      navigate("/control-tower");
      return;
    }
    if (id === "logs") {
      navigate("/audit");
      return;
    }
    navigate(`/${id}`);
  };

  const sectionBody = (() => {
    switch (current) {
      case "overview":
        return <OverviewSection />;
      case "users":
        return <LazyUsersSection roleLevel={roleLevel(role)} />;
      case "employees":
        return (
          <LazyEmployeesSection
            canManageAdminUsers={canManageAdminUsers}
            canGrantSuperadmin={canGrantSuperadmin}
          />
        );
      case "support":
        return <LazySupportSection role={role} />;
      case "approvals":
        return <LazyApprovalsSection role={{ level: roleLevel(role) }} />;
      case "workspaces":
        return <LazyWorkspacesSection roleLevel={roleLevel(role)} />;
      case "banking":
        return <LazyBankingSection />;
      case "reconciliation":
        return <LazyReconciliationSection />;
      case "ledger":
        return <LazyLedgerSection />;
      case "invoices":
        return <LazyInvoicesSection />;
      case "expenses":
        return <LazyExpensesSection />;
      case "autonomy":
        return <LazyAutonomySection />;
      case "ai-monitoring":
        return <LazyAiOpsSection />;
      case "feature-flags":
        return <LazyFeatureFlagsSection role={role} />;
      case "settings":
        return <LazyRuntimeSettingsSection />;
      case "logs":
        return <LazyLogsSection />;
      default:
        return <OverviewSection />;
    }
  })();

  return (
    <AppShell className="bg-transparent">
      <div className="flex min-h-screen flex-col text-slate-900">
        <TopBar currentSection={current} onSelect={handleSelect} />
        <div className="flex flex-1">
          <Sidebar
            current={current}
            onSelect={handleSelect}
            onPrefetch={prefetchSection}
            canManageAdminUsers={canManageAdminUsers}
          />
          <main className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl space-y-6 pb-8">
              <Suspense fallback={<SectionFallback />}>{sectionBody}</Suspense>
            </div>
          </main>
        </div>
      </div>
    </AppShell>
  );
};
