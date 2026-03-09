import React, { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CustomerLayout } from "./layouts/CustomerLayout";
import { DarkSidebarLayout } from "./layouts/DarkSidebarLayout";
import { cashflowSample, profitAndLossSample } from "./reports/sampleData";

const LazyDashboardRoute = React.lazy(() => import("./routes/DashboardRoute"));
const LazyChartOfAccountsRoute = React.lazy(() => import("./routes/ChartOfAccountsRoute"));
const LazyAccountSettingsRoute = React.lazy(() => import("./routes/AccountSettingsRoute"));
const LazyLoginPage = React.lazy(() => import("./auth/LoginPage"));
const LazyWelcomePage = React.lazy(() => import("./auth/CloverBooksWelcomePage"));
const LazyCreateAccountPage = React.lazy(() => import("./auth/CloverBooksCreateAccount"));
const LazyOAuthCallbackPage = React.lazy(() => import("./auth/OAuthCallbackPage"));
const LazyCompanionControlTowerPage = React.lazy(() => import("./companion/CompanionControlTowerPage"));
const LazyCompanionOverviewPage = React.lazy(() => import("./companion/CompanionOverviewPage"));
const LazyCompanionIssuesPage = React.lazy(() => import("./companion/CompanionIssuesPage"));
const LazyCompanionProposalsPage = React.lazy(() => import("./companion/CompanionProposalsPage"));
const LazyTaxGuardianPage = React.lazy(() => import("./companion/TaxGuardianPage"));
const LazyTaxCatalogPage = React.lazy(() => import("./companion/TaxCatalogPage"));
const LazyTaxProductRulesPage = React.lazy(() => import("./companion/TaxProductRulesPage"));
const LazyTaxSettingsPage = React.lazy(() => import("./companion/TaxSettingsPage"));
const LazyInvoicesRoute = React.lazy(async () => {
  const module = await import("./invoices/InvoicesPage");
  return {
    default: () => <module.default defaultCurrency="USD" />,
  };
});
const LazyInvoicesListPage = React.lazy(() => import("./invoices/InvoicesListPage"));
const LazyExpensesListPage = React.lazy(() => import("./expenses/ExpensesListPage"));
const LazyCustomersPage = React.lazy(() => import("./customers/CustomersPage"));
const LazySuppliersPage = React.lazy(() => import("./suppliers/SuppliersPage"));
const LazyProductsPage = React.lazy(() => import("./products/ProductsPage"));
const LazyCategoriesPage = React.lazy(() => import("./categories/CategoriesPage"));
const LazyInventoryOverviewPage = React.lazy(() => import("./inventory/InventoryOverviewPage"));
const LazyBankingRoute = React.lazy(async () => {
  const module = await import("./BankingAccountsAndFeedPage");
  return {
    default: () => (
      <module.default
        overviewUrl="/api/banking/overview/"
        feedUrl="/api/banking/feed/"
        importUrl="/banking/import"
      />
    ),
  };
});
const LazyBankSetupPage = React.lazy(() => import("./banking/BankSetupPage"));
const LazyBankAccountsPage = React.lazy(() => import("./banking/BankAccountsPage"));
const LazyExpenseListPage = React.lazy(() => import("./expenses/ExpenseListPage"));
const LazyAICompanionPage = React.lazy(() => import("./companion/AICompanionPage"));
const LazyWorkflowsRulesPage = React.lazy(() => import("./workflows/WorkflowsRulesPage"));
const LazyBillsPage = React.lazy(() => import("./bills/BillsPage"));
const LazyReconciliationPage = React.lazy(() => import("./reconciliation/ReconciliationPage"));
const LazyReconciliationReportPage = React.lazy(() => import("./reconciliation/ReconciliationReportPage"));
const LazyProfitAndLossReportPage = React.lazy(() => import("./reports/ProfitAndLossReportPage"));
const LazyCashflowReportPage = React.lazy(() => import("./reports/CashflowReportPage"));
const LazyCashflowReportPrintPage = React.lazy(async () => {
  const module = await import("./reports/CashflowReportPrintPage");
  return { default: module.CashflowReportPrintPage };
});
const LazyJournalEntriesPage = React.lazy(() => import("./journal/JournalEntriesPage"));
const LazyTransactionsPage = React.lazy(() => import("./transactions/TransactionsPage"));
const LazyLedgerTransactionsPage = React.lazy(() => import("./transactions/LedgerTransactionsPage"));
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

  if (!auth.bootstrapped && auth.loading && !auth.authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Loading workspace...
      </div>
    );
  }

  if (!auth.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
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

export const AppRoutes: React.FC = () => (
  <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={<LazyLoginPage />} />
      <Route path="/welcome" element={<LazyWelcomePage />} />
      <Route path="/signup" element={<LazyCreateAccountPage />} />
      <Route path="/auth/callback" element={<LazyOAuthCallbackPage />} />
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

      {/* Dark OS pages — sidebar layout */}
      <Route
        element={
          <RequireAuth>
            <DarkSidebarLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<LazyDashboardRoute />} />
        <Route path="/banking" element={<LazyLedgerTransactionsPage />} />
        <Route path="/ledger" element={<Navigate to="/banking" replace />} />
        <Route path="/expenses" element={<LazyExpensesListPage />} />
        <Route path="/receipts" element={<Navigate to="/expenses" replace />} />
        <Route path="/invoices" element={<LazyInvoicesListPage />} />
        <Route path="/invoices/list" element={<Navigate to="/invoices" replace />} />
        <Route path="/customers" element={<LazyCustomersPage />} />
        <Route path="/bank-accounts" element={<LazyBankAccountsPage />} />
        <Route path="/expense-list" element={<LazyExpenseListPage />} />
        <Route path="/ai-companion" element={<LazyAICompanionPage />} />
        <Route path="/workflows" element={<LazyWorkflowsRulesPage />} />
        <Route path="/bills" element={<LazyBillsPage />} />
      </Route>

      {/* Standard pages — sidebar layout */}
      <Route
        element={
          <RequireAuth>
            <CustomerLayout />
          </RequireAuth>
        }
      >
        <Route path="/ai-companion/*" element={<LegacyCompanionRedirect />} />
        <Route path="/companion" element={<LazyCompanionControlTowerPage />} />
        <Route path="/companion/overview" element={<LazyCompanionOverviewPage />} />
        <Route path="/companion/issues" element={<LazyCompanionIssuesPage />} />
        <Route path="/companion/proposals" element={<LazyCompanionProposalsPage />} />
        <Route path="/companion/tax" element={<LazyTaxGuardianPage />} />
        <Route path="/companion/tax/catalog" element={<LazyTaxCatalogPage />} />
        <Route path="/companion/tax/product-rules" element={<LazyTaxProductRulesPage />} />
        <Route path="/companion/tax/settings" element={<LazyTaxSettingsPage />} />
        <Route path="/invoices/old" element={<LazyInvoicesRoute />} />

        <Route path="/customers" element={<LazyCustomersPage />} />
        <Route path="/suppliers" element={<LazySuppliersPage />} />
        <Route path="/products" element={<LazyProductsPage />} />
        <Route path="/categories" element={<LazyCategoriesPage />} />
        <Route path="/inventory" element={<LazyInventoryOverviewPage />} />
        <Route path="/banking/old" element={<LazyBankingRoute />} />
        <Route path="/banking/setup" element={<LazyBankSetupPage />} />
        <Route path="/reconciliation" element={<LazyReconciliationPage />} />
        <Route path="/reconciliation/report" element={<LazyReconciliationReportPage />} />
        <Route path="/reports/pl" element={<ProfitAndLossReportRoute />} />
        <Route path="/reports/cashflow" element={<CashflowReportRoute />} />
        <Route path="/reports/cashflow/print" element={<CashflowReportPrintRoute />} />
        <Route path="/accounts" element={<Navigate to="/chart-of-accounts" replace />} />
        <Route path="/accounts/" element={<Navigate to="/chart-of-accounts" replace />} />
        <Route path="/chart-of-accounts" element={<LazyChartOfAccountsRoute />} />
        <Route path="/journal" element={<LazyJournalEntriesPage />} />
        <Route path="/transactions" element={<LazyTransactionsPage />} />
        <Route path="/settings" element={<LazyAccountSettingsRoute />} />
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
