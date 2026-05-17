import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import AuthCallback from './components/auth/AuthCallback';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SplashWelcome from './pages/SplashWelcome';
import Login from './pages/Login';
import CompanySelection from './pages/CompanySelection';
import WorkspaceAccess from './pages/WorkspaceAccess';
import Dashboard from './pages/Dashboard';
import SalesList from './pages/SalesList';
import TransactionsPage from './pages/TransactionsPage';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import CustomersList from './pages/CustomersList';
import CustomerCenter from './pages/CustomerCenter';
import CustomerDetail from './pages/CustomerDetail';
import EditCustomer from './pages/EditCustomer';
import VendorsList from './pages/VendorsList';
import VendorCenter from './pages/VendorCenter';
import VendorDetail from './pages/VendorDetail';
import EditVendor from './pages/EditVendor';
import ExpensesList from './pages/ExpensesList';
import AddExpense from './pages/AddExpense';
import EditExpense from './pages/EditExpense';
import InventoryList from './pages/InventoryList';
import InventoryDetail from './pages/InventoryDetail';
import InventoryValuation from './pages/InventoryValuation';
import AccountsReceivable from './pages/AccountsReceivable';
import AccountsPayable from './pages/AccountsPayable';
import ReportsHub from './pages/ReportsHub';
import ProfitLoss from './pages/ProfitLoss';
import SalesReport from './pages/SalesReport';
import ExpenseReport from './pages/ExpenseReport';
import ProductsList from './pages/ProductsList';
import ProductDetail from './pages/ProductDetail';
import EditProduct from './pages/EditProduct';
import InvoicePrint from './pages/InvoicePrint';
import AIAssistant from './pages/AIAssistant';
import AIImportCenter from './pages/AIImportCenter';
import AIImportReview from './pages/AIImportReview';
import Settings from './pages/Settings';
import BalanceSheet from './pages/BalanceSheet';
import CashFlow from './pages/CashFlow';
import PackingListPrint from './pages/PackingListPrint';
import CustomerStatementPrint from './pages/CustomerStatementPrint';
import ChartOfAccounts from './pages/ChartOfAccounts';
import JournalEntries from './pages/JournalEntries';
import EstimatesList from './pages/EstimatesList';
import BillsList from './pages/BillsList';
import ReceiveStock from './pages/ReceiveStock';
import GeneralLedger from './pages/GeneralLedger';
import TrialBalance from './pages/TrialBalance';
import CustomerPayments from './pages/CustomerPayments';
import NewCustomerPayment from './pages/NewCustomerPayment';
import VendorPayments from './pages/VendorPayments';
import NewVendorPayment from './pages/NewVendorPayment';
import SalesOrdersList from './pages/SalesOrdersList';
import SalesOrderDetail from './pages/SalesOrderDetail';
import PurchaseOrdersList from './pages/PurchaseOrdersList';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';
import AuditLog from './pages/AuditLog';
import RecurringCenter from './pages/RecurringCenter';
import BankReconciliation from './pages/BankReconciliation';
import TaxSummary from './pages/TaxSummary';
import VendorPaymentPrint from './pages/VendorPaymentPrint';
import CreditMemosList from './pages/CreditMemosList';
import StockTransfersPage from './pages/StockTransfersPage';
import ShipmentsPage from './pages/ShipmentsPage';
import BankTransactionsPage from './pages/BankTransactionsPage';
import CustomerLedgerPage from './pages/CustomerLedgerPage';
import VendorLedgerPage from './pages/VendorLedgerPage';
import GlobalSearchPage from './pages/GlobalSearchPage';
import DeletedRecordsPage from './pages/DeletedRecordsPage';
import AppGuide from './pages/AppGuide';
import QaAgentPage from './pages/QaAgentPage';
import RomaAssistantWidget from './components/layout/RomaAssistantWidget';
import { UiProvider } from './contexts/UiContext';
import './App.css';

function AppRouter() {
  const location = useLocation();
  const isMobilePreviewEmbed = new URLSearchParams(location.search).get('mobile_preview_embed') === '1';
  const showRomaWidget = !isMobilePreviewEmbed && !['/', '/login', '/select-company', '/workspace-access'].includes(location.pathname);

  // CRITICAL: Check URL fragment for session_id synchronously during render
  // This prevents race conditions by processing new session_id FIRST
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<SplashWelcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/select-company" element={<CompanySelection />} />
        <Route path="/workspace-access" element={<WorkspaceAccess />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/search" element={
          <ProtectedRoute><GlobalSearchPage /></ProtectedRoute>
        } />
        <Route path="/deleted-records" element={
          <ProtectedRoute><DeletedRecordsPage /></ProtectedRoute>
        } />
        <Route path="/app-guide" element={
          <ProtectedRoute><AppGuide /></ProtectedRoute>
        } />
        <Route path="/qa-agent" element={
          <ProtectedRoute><QaAgentPage /></ProtectedRoute>
        } />
        <Route path="/sales" element={
          <ProtectedRoute><SalesList /></ProtectedRoute>
        } />
        <Route path="/transactions" element={
          <ProtectedRoute><TransactionsPage /></ProtectedRoute>
        } />
        <Route path="/sales-orders" element={
          <ProtectedRoute><SalesOrdersList /></ProtectedRoute>
        } />
        <Route path="/credit-memos" element={
          <ProtectedRoute><CreditMemosList /></ProtectedRoute>
        } />
        <Route path="/sales-orders/:salesOrderId" element={
          <ProtectedRoute><SalesOrderDetail /></ProtectedRoute>
        } />
        <Route path="/sales/new" element={
          <ProtectedRoute><CreateInvoice /></ProtectedRoute>
        } />
        <Route path="/sales/:invoiceId/edit" element={
          <ProtectedRoute><CreateInvoice /></ProtectedRoute>
        } />
        <Route path="/sales/:invoiceId" element={
          <ProtectedRoute><InvoiceDetail /></ProtectedRoute>
        } />
        <Route path="/customers" element={
          <ProtectedRoute><CustomersList /></ProtectedRoute>
        } />
        <Route path="/customer-center" element={
          <ProtectedRoute><CustomerCenter /></ProtectedRoute>
        } />
        <Route path="/customers/:customerId" element={
          <ProtectedRoute><CustomerDetail /></ProtectedRoute>
        } />
        <Route path="/customers/:customerId/edit" element={
          <ProtectedRoute><EditCustomer /></ProtectedRoute>
        } />
        <Route path="/vendors" element={
          <ProtectedRoute><VendorsList /></ProtectedRoute>
        } />
        <Route path="/vendor-center" element={
          <ProtectedRoute><VendorCenter /></ProtectedRoute>
        } />
        <Route path="/vendors/:vendorId" element={
          <ProtectedRoute><VendorDetail /></ProtectedRoute>
        } />
        <Route path="/vendors/:vendorId/edit" element={
          <ProtectedRoute><EditVendor /></ProtectedRoute>
        } />
        <Route path="/products" element={
          <ProtectedRoute><ProductsList /></ProtectedRoute>
        } />
        <Route path="/products/:productId" element={
          <ProtectedRoute><ProductDetail /></ProtectedRoute>
        } />
        <Route path="/products/:productId/edit" element={
          <ProtectedRoute><EditProduct /></ProtectedRoute>
        } />
        <Route path="/sales/:invoiceId/print" element={
          <ProtectedRoute><InvoicePrint /></ProtectedRoute>
        } />
        <Route path="/expenses" element={
          <ProtectedRoute><ExpensesList /></ProtectedRoute>
        } />
        <Route path="/expenses/new" element={
          <ProtectedRoute><AddExpense /></ProtectedRoute>
        } />
        <Route path="/expenses/:expenseId" element={
          <ProtectedRoute><EditExpense /></ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute><InventoryList /></ProtectedRoute>
        } />
        <Route path="/stock-transfers" element={
          <ProtectedRoute><StockTransfersPage /></ProtectedRoute>
        } />
        <Route path="/shipments" element={
          <ProtectedRoute><ShipmentsPage /></ProtectedRoute>
        } />
        <Route path="/inventory/valuation" element={
          <ProtectedRoute><InventoryValuation /></ProtectedRoute>
        } />
        <Route path="/inventory/:itemId" element={
          <ProtectedRoute><InventoryDetail /></ProtectedRoute>
        } />
        <Route path="/receivables" element={
          <ProtectedRoute><AccountsReceivable /></ProtectedRoute>
        } />
        <Route path="/payables" element={
          <ProtectedRoute><AccountsPayable /></ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute><ReportsHub /></ProtectedRoute>
        } />
        <Route path="/reports/profit-loss" element={
          <ProtectedRoute><ProfitLoss /></ProtectedRoute>
        } />
        <Route path="/reports/sales" element={
          <ProtectedRoute><SalesReport /></ProtectedRoute>
        } />
        <Route path="/reports/expenses" element={
          <ProtectedRoute><ExpenseReport /></ProtectedRoute>
        } />
        <Route path="/reports/balance-sheet" element={
          <ProtectedRoute><BalanceSheet /></ProtectedRoute>
        } />
        <Route path="/reports/cash-flow" element={
          <ProtectedRoute><CashFlow /></ProtectedRoute>
        } />
        <Route path="/sales/:invoiceId/packing-list" element={
          <ProtectedRoute><PackingListPrint /></ProtectedRoute>
        } />
        <Route path="/customers/:customerId/statement" element={
          <ProtectedRoute><CustomerStatementPrint /></ProtectedRoute>
        } />
        <Route path="/ai-assistant" element={
          <ProtectedRoute><AIAssistant /></ProtectedRoute>
        } />
        <Route path="/ai-import" element={
          <ProtectedRoute><AIImportCenter /></ProtectedRoute>
        } />
        <Route path="/ai-import/review/:uploadId" element={
          <ProtectedRoute><AIImportReview /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute><Settings /></ProtectedRoute>
        } />
        <Route path="/estimates" element={
          <ProtectedRoute><EstimatesList /></ProtectedRoute>
        } />
        <Route path="/estimates/new" element={
          <ProtectedRoute><EstimatesList /></ProtectedRoute>
        } />
        <Route path="/estimates/:estimateId" element={
          <ProtectedRoute><EstimatesList /></ProtectedRoute>
        } />
        <Route path="/estimates/:estimateId/edit" element={
          <ProtectedRoute><EstimatesList /></ProtectedRoute>
        } />
        <Route path="/bills" element={
          <ProtectedRoute><BillsList /></ProtectedRoute>
        } />
        <Route path="/bills/:billId" element={
          <ProtectedRoute><BillsList /></ProtectedRoute>
        } />
        <Route path="/purchase-orders" element={
          <ProtectedRoute><PurchaseOrdersList /></ProtectedRoute>
        } />
        <Route path="/purchase-orders/:purchaseOrderId" element={
          <ProtectedRoute><PurchaseOrderDetail /></ProtectedRoute>
        } />
        <Route path="/receive-stock" element={
          <ProtectedRoute><ReceiveStock /></ProtectedRoute>
        } />
        <Route path="/receive-stock/:receiptId" element={
          <ProtectedRoute><ReceiveStock /></ProtectedRoute>
        } />
        <Route path="/chart-of-accounts" element={
          <ProtectedRoute><ChartOfAccounts /></ProtectedRoute>
        } />
        <Route path="/journal-entries" element={
          <ProtectedRoute><JournalEntries /></ProtectedRoute>
        } />
        <Route path="/general-ledger" element={
          <ProtectedRoute><GeneralLedger /></ProtectedRoute>
        } />
        <Route path="/trial-balance" element={
          <ProtectedRoute><TrialBalance /></ProtectedRoute>
        } />
        <Route path="/customer-payments" element={
          <ProtectedRoute><CustomerPayments /></ProtectedRoute>
        } />
        <Route path="/payments" element={
          <ProtectedRoute><CustomerPayments /></ProtectedRoute>
        } />
        <Route path="/customer-payments/new" element={
          <ProtectedRoute><NewCustomerPayment /></ProtectedRoute>
        } />
        <Route path="/vendor-payments" element={
          <ProtectedRoute><VendorPayments /></ProtectedRoute>
        } />
        <Route path="/vendor-payments/new" element={
          <ProtectedRoute><NewVendorPayment /></ProtectedRoute>
        } />
        <Route path="/vendor-payments/:paymentId/print" element={
          <ProtectedRoute><VendorPaymentPrint /></ProtectedRoute>
        } />
        <Route path="/customer-ledger" element={
          <ProtectedRoute><CustomerLedgerPage /></ProtectedRoute>
        } />
        <Route path="/vendor-ledger" element={
          <ProtectedRoute><VendorLedgerPage /></ProtectedRoute>
        } />
        <Route path="/bank-transactions" element={
          <ProtectedRoute><BankTransactionsPage /></ProtectedRoute>
        } />
        <Route path="/bank" element={
          <ProtectedRoute><BankTransactionsPage /></ProtectedRoute>
        } />
        <Route path="/bank-reconciliation" element={
          <ProtectedRoute><BankReconciliation /></ProtectedRoute>
        } />
        <Route path="/vendors/bills" element={
          <ProtectedRoute><BillsList /></ProtectedRoute>
        } />
        <Route path="/reports/receivables-aging" element={
          <ProtectedRoute><AccountsReceivable /></ProtectedRoute>
        } />
        <Route path="/reports/profit" element={
          <ProtectedRoute><ProfitLoss /></ProtectedRoute>
        } />
        <Route path="/reports/pnl" element={
          <ProtectedRoute><ProfitLoss /></ProtectedRoute>
        } />
        <Route path="/reports/tax-summary" element={
          <ProtectedRoute><TaxSummary /></ProtectedRoute>
        } />
        <Route path="/audit-log" element={
          <ProtectedRoute><AuditLog /></ProtectedRoute>
        } />
        <Route path="/recurring" element={
          <ProtectedRoute><RecurringCenter /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      {showRomaWidget && <RomaAssistantWidget />}
    </>
  );
}

function PlaceholderPage({ title, desc }) {
  const AppShell = require('./components/layout/AppShell').default;
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#F2F4F6' }}>
          <div className="w-8 h-8 rounded-lg" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)', opacity: 0.3 }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{title}</h2>
        <p className="text-sm text-center max-w-md" style={{ color: '#434655' }}>{desc}</p>
      </div>
    </AppShell>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UiProvider>
          <CompanyProvider>
            <AppRouter />
          </CompanyProvider>
        </UiProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
