import React, { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CustomerLayout } from "./layouts/CustomerLayout";

import CloverBooksDashboard from "./dashboard/CloverBooksDashboard";
import { cashflowSample, profitAndLossSample } from "./reports/sampleData";
import CloverBooksLoginPage from "./auth/LoginPage";
import CloverBooksWelcomePage from "./auth/CloverBooksWelcomePage";
import CloverBooksCreateAccount from "./auth/CloverBooksCreateAccount";
import OAuthCallbackPage from "./auth/OAuthCallbackPage";
import type { ChartOfAccountsBootPayload } from "./ChartOfAccountsPage";
import { qboDefaultCoaPayload } from "./coa/qboDefaultCoa";
import { buildApiUrl, fetchWithTimeout } from "./api/client";

const LazyCompanionControlTowerPage = React.lazy(() => import("./companion/CompanionControlTowerPage"));
const LazyCompanionOverviewPage = React.lazy(() => import("./companion/CompanionOverviewPage"));
const LazyCompanionIssuesPage = React.lazy(() => import("./companion/CompanionIssuesPage"));
const LazyCompanionProposalsPage = React.lazy(() => import("./companion/CompanionProposalsPage"));
const LazyTaxGuardianPage = React.lazy(() => import("./companion/TaxGuardianPage"));
const LazyTaxCatalogPage = React.lazy(() => import("./companion/TaxCatalogPage"));
const LazyTaxProductRulesPage = React.lazy(() => import("./companion/TaxProductRulesPage"));
const LazyTaxSettingsPage = React.lazy(() => import("./companion/TaxSettingsPage"));
const LazyInvoicesPage = React.lazy(() => import("./invoices/InvoicesPage"));
const LazyInvoicesListPage = React.lazy(() => import("./invoices/InvoicesListPage"));
const LazyExpensesListPage = React.lazy(() => import("./expenses/ExpensesListPage"));
const LazyCustomersPage = React.lazy(() => import("./customers/CustomersPage"));
const LazySuppliersPage = React.lazy(() => import("./suppliers/SuppliersPage"));
const LazyProductsPage = React.lazy(() => import("./products/ProductsPage"));
const LazyCategoriesPage = React.lazy(() => import("./categories/CategoriesPage"));
const LazyInventoryOverviewPage = React.lazy(() => import("./inventory/InventoryOverviewPage"));
const LazyBankingAccountsAndFeedPage = React.lazy(() => import("./BankingAccountsAndFeedPage"));
const LazyBankSetupPage = React.lazy(() => import("./banking/BankSetupPage"));
const LazyReconciliationPage = React.lazy(() => import("./reconciliation/ReconciliationPage"));
const LazyReconciliationReportPage = React.lazy(() => import("./reconciliation/ReconciliationReportPage"));
const LazyProfitAndLossReportPage = React.lazy(() => import("./reports/ProfitAndLossReportPage"));
const LazyCashflowReportPage = React.lazy(() => import("./reports/CashflowReportPage"));
const LazyCashflowReportPrintPage = React.lazy(async () => {
  const module = await import("./reports/CashflowReportPrintPage");
  return { default: module.CashflowReportPrintPage };
});
const LazyChartOfAccountsPage = React.lazy(() => import("./ChartOfAccountsPage"));
const LazyJournalEntriesPage = React.lazy(() => import("./journal/JournalEntriesPage"));
const LazyTransactionsPage = React.lazy(() => import("./transactions/TransactionsPage"));
const LazyAccountSettingsPage = React.lazy(() => import("./settings/AccountSettingsPage"));
const LazyRolesSettingsPage = React.lazy(() => import("./settings/RolesSettingsPage"));
const LazyTeamManagement = React.lazy(() => import("./settings/TeamManagement"));
const LazyBankReviewPage = React.lazy(() => import("./bankReview/BankReviewPage"));
const LazyBooksReviewPage = React.lazy(() => import("./booksReview/BooksReviewPage"));
const LazyAgenticConsolePage = React.lazy(() => import("./agentic/AgenticConsolePage"));
const LazyReceiptsDemoPage = React.lazy(() => import("./agentic/ReceiptsDemoPage"));
const LazyOnboardingPage = React.lazy(() => import("./onboarding/OnboardingPage"));

const RouteFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center text-slate-600">
    Loading...
  </div>
);

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { auth } = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Loading workspace…
      </div>
    );
  }

  if (!auth.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

const DashboardRoute: React.FC = () => {
  const { auth } = useAuth();
  const username = auth.user?.name || auth.user?.firstName || auth.user?.email || "there";
  return <CloverBooksDashboard username={username} />;
};

const LegacyCompanionRedirect: React.FC = () => {
  const location = useLocation();
  const legacyPrefix = "/ai-companion";
  const suffix = location.pathname.startsWith(legacyPrefix)
    ? location.pathname.slice(legacyPrefix.length)
    : "";
  const rawTarget = `/companion${suffix}`;
  const targetPath = rawTarget.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/companion";
  return <Navigate to={`${targetPath}${location.search}`} replace />;
};

const CashflowReportRoute: React.FC = () => <LazyCashflowReportPage {...cashflowSample} />;
const CashflowReportPrintRoute: React.FC = () => <LazyCashflowReportPrintPage {...cashflowSample} />;
const ProfitAndLossReportRoute: React.FC = () => <LazyProfitAndLossReportPage {...profitAndLossSample} />;

const ChartOfAccountsRoute: React.FC = () => {
  const [payload, setPayload] = useState<ChartOfAccountsBootPayload>(qboDefaultCoaPayload);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    setIsLoading(true);

    fetchWithTimeout(buildApiUrl("/api/chart-of-accounts/"), {
      headers: { Accept: "application/json" },
      credentials: "include",
    }, 12_000)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load chart of accounts (${res.status})`);
        }
        const data = await res.json();
        if (aborted) return;
        setPayload({
          accounts: Array.isArray(data?.accounts) ? data.accounts : [],
          currencyCode: typeof data?.currencyCode === "string" ? data.currencyCode : "USD",
          totalsByType: typeof data?.totalsByType === "object" && data?.totalsByType ? data.totalsByType : {},
        });
      })
      .catch((error) => {
        if (aborted) {
          return;
        }
        if (window.console) {
          console.warn("Chart of accounts API unavailable, using fallback payload.", error);
        }
      })
      .finally(() => {
        if (!aborted) {
          setIsLoading(false);
        }
      });
    return () => {
      aborted = true;
    };
  }, []);

  if (isLoading && payload.accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Loading chart of accounts...
      </div>
    );
  }

  return <LazyChartOfAccountsPage payload={payload} newAccountUrl="/chart-of-accounts/new" />;
};

// Route wrappers for pages with required props
const InvoicesRoute: React.FC = () => <LazyInvoicesPage defaultCurrency="USD" />;

const BankingRoute: React.FC = () => (
  <LazyBankingAccountsAndFeedPage
    overviewUrl="/api/banking/overview/"
    feedUrl="/api/banking/feed/"
    importUrl="/banking/import"
  />
);

// Settings page with mock form data to prevent crashes
const mockFormField = (name: string, label: string, value = "") => ({
  name, id: name, label, value, errors: [], type: "text", required: false
});
const mockSettingsProps = {
  csrfToken: "",
  profileForm: { form_id: "profile", fields: [mockFormField("name", "Name")], hidden_fields: [], non_field_errors: [] },
  businessForm: { form_id: "business", fields: [mockFormField("business_name", "Business Name")], hidden_fields: [], non_field_errors: [] },
  passwordForm: { form_id: "password", fields: [], hidden_fields: [], non_field_errors: [] },
  sessions: { current_ip: "127.0.0.1", user_agent: "Browser" },
  postUrls: { profile: "/api/settings/profile/", business: "/api/settings/business/", password: "/api/settings/password/", logoutAll: "/api/auth/logout-all/" },
  messages: [],
};
const AccountSettingsRoute: React.FC = () => <LazyAccountSettingsPage {...mockSettingsProps} />;



export const AppRoutes: React.FC = () => (
  <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={<CloverBooksLoginPage />} />
      <Route path="/welcome" element={<CloverBooksWelcomePage />} />
      <Route path="/signup" element={<CloverBooksCreateAccount />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route
        path="/agentic/console"
        element={
          <RequireAuth>
            <LazyAgenticConsolePage />
          </RequireAuth>
        }
      />
      <Route
        path="/agentic/receipts-demo"
        element={
          <RequireAuth>
            <LazyReceiptsDemoPage />
          </RequireAuth>
        }
      />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <LazyOnboardingPage />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <CustomerLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/ai-companion/*" element={<LegacyCompanionRedirect />} />
        <Route path="/companion" element={<LazyCompanionControlTowerPage />} />
        <Route path="/companion/overview" element={<LazyCompanionOverviewPage />} />
        <Route path="/companion/issues" element={<LazyCompanionIssuesPage />} />
        <Route path="/companion/proposals" element={<LazyCompanionProposalsPage />} />
        <Route path="/companion/tax" element={<LazyTaxGuardianPage />} />
        <Route path="/companion/tax/catalog" element={<LazyTaxCatalogPage />} />
        <Route path="/companion/tax/product-rules" element={<LazyTaxProductRulesPage />} />
        <Route path="/companion/tax/settings" element={<LazyTaxSettingsPage />} />
        <Route path="/invoices" element={<InvoicesRoute />} />
        <Route path="/invoices/list" element={<LazyInvoicesListPage />} />
        <Route path="/expenses" element={<LazyExpensesListPage />} />
        <Route path="/customers" element={<LazyCustomersPage />} />
        <Route path="/suppliers" element={<LazySuppliersPage />} />
        <Route path="/products" element={<LazyProductsPage />} />
        <Route path="/categories" element={<LazyCategoriesPage />} />
        <Route path="/inventory" element={<LazyInventoryOverviewPage />} />
        <Route path="/banking" element={<BankingRoute />} />
        <Route path="/banking/setup" element={<LazyBankSetupPage />} />
        <Route path="/reconciliation" element={<LazyReconciliationPage />} />
        <Route path="/reconciliation/report" element={<LazyReconciliationReportPage />} />
        <Route path="/reports/pl" element={<ProfitAndLossReportRoute />} />
        <Route path="/reports/cashflow" element={<CashflowReportRoute />} />
        <Route path="/reports/cashflow/print" element={<CashflowReportPrintRoute />} />
        <Route path="/accounts" element={<Navigate to="/chart-of-accounts" replace />} />
        <Route path="/accounts/" element={<Navigate to="/chart-of-accounts" replace />} />
        <Route path="/chart-of-accounts" element={<ChartOfAccountsRoute />} />
        <Route path="/journal" element={<LazyJournalEntriesPage />} />
        <Route path="/transactions" element={<LazyTransactionsPage />} />
        <Route path="/settings" element={<AccountSettingsRoute />} />
        <Route path="/settings/roles" element={<LazyRolesSettingsPage />} />
        <Route path="/settings/team" element={<LazyTeamManagement />} />
        <Route path="/bank-review" element={<LazyBankReviewPage />} />
        <Route path="/books-review" element={<LazyBooksReviewPage />} />
        <Route path="/help" element={<div className="p-6 text-slate-600">Help center coming soon.</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </Suspense>
);

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
