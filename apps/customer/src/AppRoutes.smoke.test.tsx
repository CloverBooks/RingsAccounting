import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet } from "react-router-dom";

const mockDashboardPayload = {
  business: { currency: "USD" },
  metrics: {},
  recent_invoices: [],
  recent_expenses: [],
  bank_accounts: [],
};

const mockCoaApiPayload = {
  accounts: [{ id: 1, code: "1000", name: "Cash", type: "ASSET", detailType: "Cash", isActive: true }],
  currencyCode: "USD",
  totalsByType: { ASSET: 1 },
};

vi.mock("./routes/DashboardRoute", () => ({
  default: () => <div data-testid="dashboard-page">Dashboard Page</div>,
}));
vi.mock("./auth/LoginPage", () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));
vi.mock("./auth/CloverBooksWelcomePage", () => ({
  default: () => <div data-testid="welcome-page">Welcome Page</div>,
}));
vi.mock("./auth/CloverBooksCreateAccount", () => ({
  default: () => <div data-testid="signup-page">Signup Page</div>,
}));
vi.mock("./auth/OAuthCallbackPage", () => ({
  default: () => <div data-testid="oauth-callback-page">OAuth Callback Page</div>,
}));
vi.mock("./agentic/AgenticConsolePage", () => ({
  default: () => <div data-testid="agentic-console-page">Agentic Console Page</div>,
}));
vi.mock("./agentic/ReceiptsDemoPage", () => ({
  default: () => <div data-testid="receipts-demo-page">Receipts Demo Page</div>,
}));
vi.mock("./onboarding/OnboardingPage", () => ({
  default: () => <div data-testid="onboarding-page">Onboarding Page</div>,
}));
vi.mock("./companion/CompanionControlTowerPage", () => ({
  default: () => <div data-testid="companion-page">Companion Page</div>,
}));
vi.mock("./companion/CompanionOverviewPage", () => ({
  default: () => <div data-testid="companion-overview-page">Companion Overview Page</div>,
}));
vi.mock("./companion/CompanionIssuesPage", () => ({
  default: () => <div data-testid="companion-issues-page">Companion Issues Page</div>,
}));
vi.mock("./companion/CompanionProposalsPage", () => ({
  default: () => <div data-testid="companion-proposals-page">Companion Proposals Page</div>,
}));
vi.mock("./companion/TaxGuardianPage", () => ({
  default: () => <div data-testid="tax-page">Tax Guardian Page</div>,
}));
vi.mock("./companion/TaxCatalogPage", () => ({
  default: () => <div data-testid="tax-catalog-page">Tax Catalog Page</div>,
}));
vi.mock("./companion/TaxProductRulesPage", () => ({
  default: () => <div data-testid="tax-product-rules-page">Tax Product Rules Page</div>,
}));
vi.mock("./companion/TaxSettingsPage", () => ({
  default: () => <div data-testid="tax-settings-page">Tax Settings Page</div>,
}));
vi.mock("./invoices/InvoicesListPage", () => ({
  default: () => <div data-testid="invoices-list-page">Invoices List Page</div>,
}));
vi.mock("./expenses/ExpensesListPage", () => ({
  default: () => <div data-testid="expenses-page">Expenses Page</div>,
}));
vi.mock("./customers/CustomersPage", () => ({
  default: () => <div data-testid="customers-page">Customers Page</div>,
}));
vi.mock("./suppliers/SuppliersPage", () => ({
  default: () => <div data-testid="suppliers-page">Suppliers Page</div>,
}));
vi.mock("./products/ProductsPage", () => ({
  default: () => <div data-testid="products-page">Products Page</div>,
}));
vi.mock("./categories/CategoriesPage", () => ({
  default: () => <div data-testid="categories-page">Categories Page</div>,
}));
vi.mock("./inventory/InventoryOverviewPage", () => ({
  default: () => <div data-testid="inventory-page">Inventory Page</div>,
}));
vi.mock("./banking/BankSetupPage", () => ({
  default: () => <div data-testid="bank-setup-page">Bank Setup Page</div>,
}));
vi.mock("./transactions/LedgerTransactionsPage", () => ({
  default: () => <div data-testid="banking-page">Banking Page</div>,
}));
vi.mock("./reconciliation/ReconciliationPage", () => ({
  default: () => <div data-testid="reconciliation-page">Reconciliation Page</div>,
}));
vi.mock("./reconciliation/ReconciliationReportPage", () => ({
  default: () => <div data-testid="reconciliation-report-page">Reconciliation Report Page</div>,
}));
vi.mock("./reports/ProfitAndLossReportPage", () => ({
  default: () => <div data-testid="profit-loss-page">Profit And Loss Page</div>,
}));
vi.mock("./reports/CashflowReportPage", () => ({
  default: () => <div data-testid="cashflow-page">Cashflow Page</div>,
}));
vi.mock("./reports/CashflowReportPrintPage", () => ({
  CashflowReportPrintPage: () => <div data-testid="cashflow-print-page">Cashflow Print Page</div>,
}));
vi.mock("./routes/ChartOfAccountsRoute", () => ({
  default: () => <div data-testid="coa-page">Chart Of Accounts Page</div>,
}));
vi.mock("./journal/JournalEntriesPage", () => ({
  default: () => <div data-testid="journal-page">Journal Entries Page</div>,
}));
vi.mock("./transactions/TransactionsPage", () => ({
  default: () => <div data-testid="transactions-page">Transactions Page</div>,
}));
vi.mock("./routes/AccountSettingsRoute", () => ({
  default: () => <div data-testid="settings-page">Settings Page</div>,
}));
vi.mock("./settings/RolesSettingsPage", () => ({
  default: () => <div data-testid="roles-settings-page">Roles Settings Page</div>,
}));
vi.mock("./settings/TeamManagement", () => ({
  default: () => <div data-testid="team-management-page">Team Management Page</div>,
}));
vi.mock("./bankReview/BankReviewPage", () => ({
  default: () => <div data-testid="bank-review-page">Bank Review Page</div>,
}));
vi.mock("./booksReview/BooksReviewPage", () => ({
  default: () => <div data-testid="books-review-page">Books Review Page</div>,
}));

vi.mock("./contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    auth: { authenticated: true, loading: false, user: { name: "Test User", email: "test@example.com" } },
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("./layouts/CustomerLayout", () => ({
  CustomerLayout: () => (
    <div data-testid="customer-layout">
      <Outlet />
    </div>
  ),
}));
vi.mock("./layouts/DarkSidebarLayout", () => ({
  DarkSidebarLayout: () => (
    <div data-testid="dark-sidebar-layout">
      <Outlet />
    </div>
  ),
}));

import { AppRoutes } from "./App";

function installFetchMock(overrides?: { settingsFails?: boolean }) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/dashboard")) {
      return new Response(JSON.stringify(mockDashboardPayload), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/chart-of-accounts/")) {
      return new Response(JSON.stringify(mockCoaApiPayload), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/api/settings/bootstrap/")) {
      if (overrides?.settingsFails) {
        return new Response("fail", { status: 500 });
      }
      return new Response(JSON.stringify({ csrfToken: "token" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("AppRoutes smoke coverage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installFetchMock();
  });

  const routeCases: Array<{ path: string; testId?: string; text?: RegExp }> = [
    { path: "/", testId: "dashboard-page" },
    { path: "/login", testId: "login-page" },
    { path: "/welcome", testId: "welcome-page" },
    { path: "/signup", testId: "signup-page" },
    { path: "/auth/callback", testId: "oauth-callback-page" },
    { path: "/agentic/console", testId: "agentic-console-page" },
    { path: "/agentic/receipts-demo", testId: "receipts-demo-page" },
    { path: "/onboarding", testId: "onboarding-page" },
    { path: "/dashboard", testId: "dashboard-page" },
    { path: "/companion", testId: "companion-page" },
    { path: "/companion/overview", testId: "companion-overview-page" },
    { path: "/companion/issues", testId: "companion-issues-page" },
    { path: "/companion/proposals", testId: "companion-proposals-page" },
    { path: "/companion/tax", testId: "tax-page" },
    { path: "/companion/tax/catalog", testId: "tax-catalog-page" },
    { path: "/companion/tax/product-rules", testId: "tax-product-rules-page" },
    { path: "/companion/tax/settings", testId: "tax-settings-page" },
    { path: "/ai-companion/issues", testId: "companion-issues-page" },
    { path: "/invoices", testId: "invoices-list-page" },
    { path: "/invoices/list", testId: "invoices-list-page" },
    { path: "/expenses", testId: "expenses-page" },
    { path: "/receipts", testId: "expenses-page" },
    { path: "/customers", testId: "customers-page" },
    { path: "/suppliers", testId: "suppliers-page" },
    { path: "/products", testId: "products-page" },
    { path: "/categories", testId: "categories-page" },
    { path: "/inventory", testId: "inventory-page" },
    { path: "/banking", testId: "banking-page" },
    { path: "/banking/setup", testId: "bank-setup-page" },
    { path: "/reconciliation", testId: "reconciliation-page" },
    { path: "/reconciliation/report", testId: "reconciliation-report-page" },
    { path: "/reports/pl", testId: "profit-loss-page" },
    { path: "/reports/cashflow", testId: "cashflow-page" },
    { path: "/reports/cashflow/print", testId: "cashflow-print-page" },
    { path: "/accounts", testId: "coa-page" },
    { path: "/accounts/", testId: "coa-page" },
    { path: "/chart-of-accounts", testId: "coa-page" },
    { path: "/journal", testId: "journal-page" },
    { path: "/transactions", testId: "transactions-page" },
    { path: "/settings", testId: "settings-page" },
    { path: "/settings/roles", testId: "roles-settings-page" },
    { path: "/settings/team", testId: "team-management-page" },
    { path: "/bank-review", testId: "bank-review-page" },
    { path: "/books-review", testId: "books-review-page" },
    { path: "/help", text: /Help center coming soon/i },
    { path: "/missing-route", testId: "dashboard-page" },
  ];

  for (const routeCase of routeCases) {
    it(`renders route ${routeCase.path}`, async () => {
      renderRoute(routeCase.path);

      if (routeCase.testId) {
        expect(await screen.findByTestId(routeCase.testId, {}, { timeout: 8000 })).toBeInTheDocument();
        return;
      }

      expect(await screen.findByText(routeCase.text!, {}, { timeout: 8000 })).toBeInTheDocument();
    });
  }

  it("falls back to safe settings payload when bootstrap fails", async () => {
    installFetchMock({ settingsFails: true });
    renderRoute("/settings");

    expect(await screen.findByTestId("settings-page", {}, { timeout: 8000 })).toBeInTheDocument();
  });
});
