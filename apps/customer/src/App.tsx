import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CustomerLayout } from "./layouts/CustomerLayout";

import CloverBooksDashboard from "./dashboard/CloverBooksDashboard";
import CompanionControlTowerPage from "./companion/CompanionControlTowerPage";
import CompanionOverviewPage from "./companion/CompanionOverviewPage";
import CompanionIssuesPage from "./companion/CompanionIssuesPage";
import CompanionProposalsPage from "./companion/CompanionProposalsPage";
import TaxGuardianPage from "./companion/TaxGuardianPage";
import TaxCatalogPage from "./companion/TaxCatalogPage";
import TaxProductRulesPage from "./companion/TaxProductRulesPage";
import TaxSettingsPage from "./companion/TaxSettingsPage";
import InvoicesPage from "./invoices/InvoicesPage";
import InvoicesListPage from "./invoices/InvoicesListPage";
import ExpensesListPage from "./expenses/ExpensesListPage";
import ReceiptsPage from "./receipts/ReceiptsPage";
import CustomersPage from "./customers/CustomersPage";
import SuppliersPage from "./suppliers/SuppliersPage";
import ProductsPage from "./products/ProductsPage";
import CategoriesPage from "./categories/CategoriesPage";
import InventoryOverviewPage from "./inventory/InventoryOverviewPage";
import BankingAccountsAndFeedPage from "./BankingAccountsAndFeedPage";
import BankSetupPage from "./banking/BankSetupPage";
import ReconciliationPage from "./reconciliation/ReconciliationPage";
import ReconciliationReportPage from "./reconciliation/ReconciliationReportPage";
import ProfitAndLossReportPage from "./reports/ProfitAndLossReportPage";
import CashflowReportPage from "./reports/CashflowReportPage";
import { CashflowReportPrintPage } from "./reports/CashflowReportPrintPage";
import { cashflowSample, profitAndLossSample } from "./reports/sampleData";
import ChartOfAccountsPage from "./ChartOfAccountsPage";
import JournalEntriesPage from "./journal/JournalEntriesPage";
import TransactionsPage from "./transactions/TransactionsPage";
import AccountSettingsPage from "./settings/AccountSettingsPage";
import RolesSettingsPage from "./settings/RolesSettingsPage";
import TeamManagement from "./settings/TeamManagement";
import BankReviewPage from "./bankReview/BankReviewPage";
import BooksReviewPage from "./booksReview/BooksReviewPage";
import CloverBooksLoginPage from "./auth/LoginPage";
import CloverBooksWelcomePage from "./auth/CloverBooksWelcomePage";
import CloverBooksCreateAccount from "./auth/CloverBooksCreateAccount";
import OAuthCallbackPage from "./auth/OAuthCallbackPage";
import AgenticConsolePage from "./agentic/AgenticConsolePage";
import ReceiptsDemoPage from "./agentic/ReceiptsDemoPage";

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

const CashflowReportRoute: React.FC = () => <CashflowReportPage {...cashflowSample} />;
const CashflowReportPrintRoute: React.FC = () => <CashflowReportPrintPage {...cashflowSample} />;
const ProfitAndLossReportRoute: React.FC = () => <ProfitAndLossReportPage {...profitAndLossSample} />;

// Mock data for Chart of Accounts page
const mockCOAPayload = {
  accounts: [
    { id: 1, code: "1000", name: "Cash", type: "ASSET" as const, detailType: "Cash and Cash Equivalents", isActive: true, balance: 45250.00, favorite: true },
    { id: 2, code: "1100", name: "Accounts Receivable", type: "ASSET" as const, detailType: "Accounts Receivable", isActive: true, balance: 12500.00, favorite: false },
    { id: 3, code: "1200", name: "Inventory", type: "ASSET" as const, detailType: "Inventory", isActive: true, balance: 8750.00, favorite: false },
    { id: 4, code: "2000", name: "Accounts Payable", type: "LIABILITY" as const, detailType: "Accounts Payable", isActive: true, balance: 5200.00, favorite: false },
    { id: 5, code: "2100", name: "Credit Card", type: "LIABILITY" as const, detailType: "Credit Card", isActive: true, balance: 1500.00, favorite: false },
    { id: 6, code: "3000", name: "Owner's Equity", type: "EQUITY" as const, detailType: "Owner's Equity", isActive: true, balance: 50000.00, favorite: false },
    { id: 7, code: "3100", name: "Retained Earnings", type: "EQUITY" as const, detailType: "Retained Earnings", isActive: true, balance: 8500.00, favorite: true },
    { id: 8, code: "4000", name: "Sales Revenue", type: "INCOME" as const, detailType: "Sales", isActive: true, balance: 125000.00, favorite: true },
    { id: 9, code: "4100", name: "Service Revenue", type: "INCOME" as const, detailType: "Service/Fee Income", isActive: true, balance: 35000.00, favorite: false },
    { id: 10, code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" as const, detailType: "Cost of Goods Sold", isActive: true, balance: 62000.00, favorite: false },
    { id: 11, code: "6000", name: "Rent Expense", type: "EXPENSE" as const, detailType: "Rent or Lease", isActive: true, balance: 18000.00, favorite: false },
    { id: 12, code: "6100", name: "Utilities", type: "EXPENSE" as const, detailType: "Utilities", isActive: true, balance: 4200.00, favorite: false },
    { id: 13, code: "6200", name: "Salaries & Wages", type: "EXPENSE" as const, detailType: "Payroll Expenses", isActive: true, balance: 85000.00, favorite: true },
  ],
  currencyCode: "USD",
};
const ChartOfAccountsRoute: React.FC = () => (
  <ChartOfAccountsPage payload={mockCOAPayload} newAccountUrl="/chart-of-accounts/new" />
);

// Route wrappers for pages with required props
const InvoicesRoute: React.FC = () => <InvoicesPage defaultCurrency="USD" />;

const BankingRoute: React.FC = () => (
  <BankingAccountsAndFeedPage
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
const AccountSettingsRoute: React.FC = () => <AccountSettingsPage {...mockSettingsProps} />;



export const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<CloverBooksLoginPage />} />
    <Route path="/welcome" element={<CloverBooksWelcomePage />} />
    <Route path="/signup" element={<CloverBooksCreateAccount />} />
    <Route path="/auth/callback" element={<OAuthCallbackPage />} />
    <Route
      path="/agentic/console"
      element={
        <RequireAuth>
          <AgenticConsolePage />
        </RequireAuth>
      }
    />
    <Route
      path="/agentic/receipts-demo"
      element={
        <RequireAuth>
          <ReceiptsDemoPage />
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
      <Route path="/companion" element={<CompanionControlTowerPage />} />
      <Route path="/companion/overview" element={<CompanionOverviewPage />} />
      <Route path="/companion/issues" element={<CompanionIssuesPage />} />
      <Route path="/companion/proposals" element={<CompanionProposalsPage />} />
      <Route path="/companion/tax" element={<TaxGuardianPage />} />
      <Route path="/companion/tax/catalog" element={<TaxCatalogPage />} />
      <Route path="/companion/tax/product-rules" element={<TaxProductRulesPage />} />
      <Route path="/companion/tax/settings" element={<TaxSettingsPage />} />
      <Route path="/invoices" element={<InvoicesRoute />} />
      <Route path="/invoices/list" element={<InvoicesListPage />} />
      <Route path="/expenses" element={<ExpensesListPage />} />
      <Route path="/receipts" element={<ReceiptsPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/suppliers" element={<SuppliersPage />} />
      <Route path="/products" element={<ProductsPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/inventory" element={<InventoryOverviewPage />} />
      <Route path="/banking" element={<BankingRoute />} />
      <Route path="/banking/setup" element={<BankSetupPage />} />
      <Route path="/reconciliation" element={<ReconciliationPage />} />
      <Route path="/reconciliation/report" element={<ReconciliationReportPage />} />
      <Route path="/reports/pl" element={<ProfitAndLossReportRoute />} />
      <Route path="/reports/cashflow" element={<CashflowReportRoute />} />
      <Route path="/reports/cashflow/print" element={<CashflowReportPrintRoute />} />
      <Route path="/chart-of-accounts" element={<ChartOfAccountsRoute />} />
      <Route path="/journal" element={<JournalEntriesPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/settings" element={<AccountSettingsRoute />} />
      <Route path="/settings/roles" element={<RolesSettingsPage />} />
      <Route path="/settings/team" element={<TeamManagement />} />
      <Route path="/bank-review" element={<BankReviewPage />} />
      <Route path="/books-review" element={<BooksReviewPage />} />
      <Route path="/help" element={<div className="p-6 text-slate-600">Help center coming soon.</div>} />
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
