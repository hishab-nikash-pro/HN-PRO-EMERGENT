import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import AuthCallback from './components/auth/AuthCallback';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import CompanySelection from './pages/CompanySelection';
import Dashboard from './pages/Dashboard';
import SalesList from './pages/SalesList';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import CustomersList from './pages/CustomersList';
import CustomerDetail from './pages/CustomerDetail';
import VendorsList from './pages/VendorsList';
import VendorDetail from './pages/VendorDetail';
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
import InvoicePrint from './pages/InvoicePrint';
import AIAssistant from './pages/AIAssistant';
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
import './App.css';

function AppRouter() {
  const location = useLocation();

  // CRITICAL: Check URL fragment for session_id synchronously during render
  // This prevents race conditions by processing new session_id FIRST
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/select-company" element={
        <ProtectedRoute requireCompany={false}><CompanySelection /></ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/sales" element={
        <ProtectedRoute><SalesList /></ProtectedRoute>
      } />
      <Route path="/sales/new" element={
        <ProtectedRoute><CreateInvoice /></ProtectedRoute>
      } />
      <Route path="/sales/:invoiceId" element={
        <ProtectedRoute><InvoiceDetail /></ProtectedRoute>
      } />
      <Route path="/customers" element={
        <ProtectedRoute><CustomersList /></ProtectedRoute>
      } />
      <Route path="/customers/:customerId" element={
        <ProtectedRoute><CustomerDetail /></ProtectedRoute>
      } />
      <Route path="/vendors" element={
        <ProtectedRoute><VendorsList /></ProtectedRoute>
      } />
      <Route path="/vendors/:vendorId" element={
        <ProtectedRoute><VendorDetail /></ProtectedRoute>
      } />
      <Route path="/products" element={
        <ProtectedRoute><ProductsList /></ProtectedRoute>
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
      {/* Phase 3 routes */}
      <Route path="/ai-assistant" element={
        <ProtectedRoute><AIAssistant /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><Settings /></ProtectedRoute>
      } />
      <Route path="/estimates" element={
        <ProtectedRoute><EstimatesList /></ProtectedRoute>
      } />
      <Route path="/bills" element={
        <ProtectedRoute><BillsList /></ProtectedRoute>
      } />
      <Route path="/receive-stock" element={
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
      <Route path="/customer-payments/new" element={
        <ProtectedRoute><NewCustomerPayment /></ProtectedRoute>
      } />
      <Route path="/vendor-payments" element={
        <ProtectedRoute><VendorPayments /></ProtectedRoute>
      } />
      <Route path="/vendor-payments/new" element={
        <ProtectedRoute><NewVendorPayment /></ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
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
        <CompanyProvider>
          <AppRouter />
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
