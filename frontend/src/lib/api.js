import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const SESSION_TOKEN_KEY = 'hn_session_token';

export const getSessionToken = () => localStorage.getItem(SESSION_TOKEN_KEY) || '';
export const setSessionToken = (token) => {
  if (token) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  }
};
export const clearSessionToken = () => localStorage.removeItem(SESSION_TOKEN_KEY);

const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const token = response?.data?.session_token;
    if (token) {
      setSessionToken(token);
    }
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      clearSessionToken();
    }
    return Promise.reject(error);
  }
);

// Auth
export const exchangeSession = (session_id) => api.post('/auth/session', { session_id });
export const registerLocal = (data) => api.post('/auth/register-local', data);
export const login = (data) => api.post('/auth/login', data);
export const loginLocal = (data) => api.post('/auth/login-local', data);
export const getMe = () => api.get('/auth/me');
export const selectAuthCompany = (company_id) => api.post('/auth/select-company', { company_id });
export const updateProfile = (data) => api.put('/auth/profile', data);
export const changePassword = (data) => api.post('/auth/change-password', data);
export const logout = () => api.post('/auth/logout');

// Companies
export const getCompanies = () => api.get('/companies');
export const getCompany = (id) => api.get(`/companies/${id}`);

// Customers
export const getCustomers = (companyId) => api.get(`/companies/${companyId}/customers`);
export const createCustomer = (companyId, data) => api.post(`/companies/${companyId}/customers`, data);
export const getCustomer = (companyId, customerId) => api.get(`/companies/${companyId}/customers/${customerId}`);
export const updateCustomer = (companyId, customerId, data) => api.put(`/companies/${companyId}/customers/${customerId}`, data);
export const deleteCustomer = (companyId, customerId) => api.delete(`/companies/${companyId}/customers/${customerId}`);

// Vendors
export const getVendors = (companyId) => api.get(`/companies/${companyId}/vendors`);
export const createVendor = (companyId, data) => api.post(`/companies/${companyId}/vendors`, data);
export const getVendor = (companyId, vendorId) => api.get(`/companies/${companyId}/vendors/${vendorId}`);
export const updateVendor = (companyId, vendorId, data) => api.put(`/companies/${companyId}/vendors/${vendorId}`, data);
export const deleteVendor = (companyId, vendorId) => api.delete(`/companies/${companyId}/vendors/${vendorId}`);

// Invoices
export const getInvoices = (companyId, status) => {
  const params = status ? `?status=${status}` : '';
  return api.get(`/companies/${companyId}/invoices${params}`);
};
export const createInvoice = (companyId, data) => api.post(`/companies/${companyId}/invoices`, data);
export const getInvoice = (companyId, invoiceId) => api.get(`/companies/${companyId}/invoices/${invoiceId}`);
export const updateInvoice = (companyId, invoiceId, data) => api.put(`/companies/${companyId}/invoices/${invoiceId}`, data);
export const deleteInvoice = (companyId, invoiceId) => api.delete(`/companies/${companyId}/invoices/${invoiceId}`);
export const recordPayment = (companyId, invoiceId, data) => api.post(`/companies/${companyId}/invoices/${invoiceId}/payments`, data);
export const getCreditMemos = (companyId, customerId) => api.get(`/companies/${companyId}/credit-memos${customerId ? `?customer_id=${encodeURIComponent(customerId)}` : ''}`);
export const createCreditMemo = (companyId, data) => api.post(`/companies/${companyId}/credit-memos`, data);
export const deleteCreditMemo = (companyId, creditMemoId) => api.delete(`/companies/${companyId}/credit-memos/${creditMemoId}`);
export const getSalesOrders = (companyId, params) => api.get(`/companies/${companyId}/sales-orders${params ? `?${new URLSearchParams(params).toString()}` : ''}`);
export const createSalesOrder = (companyId, data) => api.post(`/companies/${companyId}/sales-orders`, data);
export const getSalesOrder = (companyId, salesOrderId) => api.get(`/companies/${companyId}/sales-orders/${salesOrderId}`);
export const updateSalesOrder = (companyId, salesOrderId, data) => api.put(`/companies/${companyId}/sales-orders/${salesOrderId}`, data);
export const deleteSalesOrder = (companyId, salesOrderId) => api.delete(`/companies/${companyId}/sales-orders/${salesOrderId}`);
export const convertSalesOrderToInvoice = (companyId, salesOrderId) => api.post(`/companies/${companyId}/sales-orders/${salesOrderId}/convert-to-invoice`);
export const getCustomerSalesOrders = (companyId, customerId) => api.get(`/companies/${companyId}/customers/${customerId}/sales-orders`);

// Dashboard
export const getDashboard = (companyId) => api.get(`/companies/${companyId}/dashboard`);
export const getGlobalSearch = (companyId, q, limit = 8) => api.get(`/companies/${companyId}/global-search?q=${encodeURIComponent(q)}&limit=${limit}`);
export const getDeletedRecords = (companyId, recordType = 'all') => api.get(`/companies/${companyId}/deleted-records?record_type=${encodeURIComponent(recordType)}`);

// Seed
export const seedData = (companyId) => api.post(`/seed/${companyId}`);

// Expenses
export const getExpenses = (companyId, category) => {
  const params = category ? `?category=${category}` : '';
  return api.get(`/companies/${companyId}/expenses${params}`);
};
export const createExpense = (companyId, data) => api.post(`/companies/${companyId}/expenses`, data);
export const getExpense = (companyId, expenseId) => api.get(`/companies/${companyId}/expenses/${expenseId}`);
export const updateExpense = (companyId, expenseId, data) => api.put(`/companies/${companyId}/expenses/${expenseId}`, data);
export const deleteExpense = (companyId, expenseId) => api.delete(`/companies/${companyId}/expenses/${expenseId}`);

// Inventory
export const getInventory = (companyId, category) => {
  const params = category ? `?category=${category}` : '';
  return api.get(`/companies/${companyId}/inventory${params}`);
};
export const createInventoryItem = (companyId, data) => api.post(`/companies/${companyId}/inventory`, data);
export const getInventoryItem = (companyId, itemId) => api.get(`/companies/${companyId}/inventory/${itemId}`);
export const adjustStock = (companyId, itemId, data) => api.post(`/companies/${companyId}/inventory/${itemId}/adjust`, data);
export const deleteInventoryItem = (companyId, itemId) => api.delete(`/companies/${companyId}/inventory/${itemId}`);
export const getInventoryValuation = (companyId) => api.get(`/companies/${companyId}/inventory-valuation`);
export const getStockTransfers = (companyId) => api.get(`/companies/${companyId}/stock-transfers`);
export const createStockTransfer = (companyId, data) => api.post(`/companies/${companyId}/stock-transfers`, data);
export const deleteStockTransfer = (companyId, transferId) => api.delete(`/companies/${companyId}/stock-transfers/${transferId}`);

// Accounts
export const getReceivables = (companyId) => api.get(`/companies/${companyId}/receivables`);
export const getPayables = (companyId) => api.get(`/companies/${companyId}/payables`);

// Products
export const getProducts = (companyId, category) => {
  const params = category ? `?category=${category}` : '';
  return api.get(`/companies/${companyId}/products${params}`);
};
export const createProduct = (companyId, data) => api.post(`/companies/${companyId}/products`, data);
export const getProduct = (companyId, productId) => api.get(`/companies/${companyId}/products/${productId}`);
export const getProductQuickReport = (companyId, productId, params) => api.get(`/companies/${companyId}/products/${productId}/quick-report${params ? `?${new URLSearchParams(params).toString()}` : ''}`);
export const updateProduct = (companyId, productId, data) => api.put(`/companies/${companyId}/products/${productId}`, data);
export const deleteProduct = (companyId, productId) => api.delete(`/companies/${companyId}/products/${productId}`);
export const bulkDeleteProducts = (companyId, productIds) => api.post(`/companies/${companyId}/products/bulk-delete`, { product_ids: productIds });

// Alerts
export const sendLowStockAlert = (companyId) => api.post(`/companies/${companyId}/low-stock-alert`);
export const sendEmail = (data) => api.post('/send-email', data);
export const runDailyLowStockCheck = () => api.post('/scheduled/daily-low-stock-check');

// AI
export const aiChat = (data) => api.post('/ai/chat', data);
export const aiExtractInvoice = (formData) => api.post('/ai/extract-invoice', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const aiImportUpload = (formData) => api.post('/ai/import', formData);
export const aiExtractDocument = (formData) => api.post('/ai/extract-document', formData);
export const getAiSessions = () => api.get('/ai/sessions');
export const getAiSessionMessages = (sessionId) => api.get(`/ai/sessions/${sessionId}`);

// AI Import Center
export const aiUploadsList = (companyId) => api.get(`/companies/${companyId}/ai-uploads`);
export const aiUploadCreate = (companyId, data) => api.post(`/companies/${companyId}/ai-uploads`, data);
export const aiUploadGet = (companyId, uploadId) => api.get(`/companies/${companyId}/ai-uploads/${uploadId}`);
export const aiUploadProcess = (companyId, uploadId) => api.post(`/companies/${companyId}/ai-uploads/${uploadId}/process`);
export const aiUploadConfirm = (companyId, uploadId, data) => api.post(`/companies/${companyId}/ai-uploads/${uploadId}/confirm`, data);
export const aiUploadDelete = (companyId, uploadId) => api.delete(`/companies/${companyId}/ai-uploads/${uploadId}`);
export const getWorkflowAlerts = (companyId) => api.get(`/companies/${companyId}/workflow-alerts`);
export const getShipments = (companyId) => api.get(`/companies/${companyId}/shipments`);
export const createShipment = (companyId, data) => api.post(`/companies/${companyId}/shipments`, data);
export const getLinkedDocuments = (companyId, params) => api.get(`/companies/${companyId}/documents${params ? `?${new URLSearchParams(params).toString()}` : ''}`);
export const createLinkedDocument = (companyId, data) => api.post(`/companies/${companyId}/documents`, data);

// Settings
export const getSettings = (companyId) => api.get(`/settings/${companyId}`);
export const updateSettings = (companyId, data) => api.put(`/settings/${companyId}`, data);
export const resetBusinessData = (companyId) => api.post(`/companies/${companyId}/reset-business-data`);
export const getRecurringTemplates = (companyId, params) => api.get(`/companies/${companyId}/recurring-templates${params ? `?${new URLSearchParams(params).toString()}` : ''}`);
export const createRecurringTemplate = (companyId, data) => api.post(`/companies/${companyId}/recurring-templates`, data);
export const updateRecurringTemplate = (companyId, templateId, data) => api.put(`/companies/${companyId}/recurring-templates/${templateId}`, data);
export const runRecurringTemplate = (companyId, templateId) => api.post(`/companies/${companyId}/recurring-templates/${templateId}/run`);
export const runDueRecurringTemplates = (companyId) => api.post(`/companies/${companyId}/recurring-templates/run-due`);
export const getReminders = (companyId, status = 'Open') => api.get(`/companies/${companyId}/reminders?status=${encodeURIComponent(status)}`);
export const getTeamMembers = (companyId) => api.get(`/team-members${companyId ? `?company_id=${encodeURIComponent(companyId)}` : ''}`);
export const createTeamMember = (data) => api.post('/team-members', data);
export const deleteTeamMember = (memberId, companyId) => api.delete(`/team-members/${memberId}${companyId ? `?company_id=${encodeURIComponent(companyId)}` : ''}`);
export const getPendingRegistrations = (companyId) => api.get(`/pending-registrations${companyId ? `?company_id=${encodeURIComponent(companyId)}` : ''}`);
export const approveMember = (requestId, data) => api.post(`/team-members/${requestId}/approve`, data);
export const rejectMember = (requestId) => api.post(`/team-members/${requestId}/reject`);
export const updateMemberRole = (memberId, data) => api.put(`/team-members/${memberId}/role`, data);
export const getAuditLogs = (companyId, params) => api.get(`/companies/${companyId}/audit-logs${params ? `?${new URLSearchParams(params).toString()}` : ''}`);
export const getRecordActivity = (companyId, recordType, recordId) => api.get(`/companies/${companyId}/records/${recordType}/${recordId}/activity`);
export const submitApproval = (companyId, recordType, recordId, data = {}) => api.post(`/companies/${companyId}/approvals/${recordType}/${recordId}/submit`, data);
export const approveRecord = (companyId, recordType, recordId, data = {}) => api.post(`/companies/${companyId}/approvals/${recordType}/${recordId}/approve`, data);
export const rejectRecord = (companyId, recordType, recordId, data = {}) => api.post(`/companies/${companyId}/approvals/${recordType}/${recordId}/reject`, data);

// CSV Import
export const importCustomersCSV = (companyId, formData) => api.post(`/companies/${companyId}/import/customers`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const importVendorsCSV = (companyId, formData) => api.post(`/companies/${companyId}/import/vendors`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const importProductsCSV = (companyId, formData) => api.post(`/companies/${companyId}/import/products`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const importQuickBooksDesktop = (companyId, formData) => api.post(`/companies/${companyId}/import/quickbooks-desktop`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Chart of Accounts
export const getAccounts = (companyId) => api.get(`/companies/${companyId}/accounts`);
export const createAccount = (companyId, data) => api.post(`/companies/${companyId}/accounts`, data);
export const updateAccount = (companyId, accountId, data) => api.put(`/companies/${companyId}/accounts/${accountId}`, data);

// Journal Entries
export const getJournalEntries = (companyId) => api.get(`/companies/${companyId}/journal-entries`);
export const createJournalEntry = (companyId, data) => api.post(`/companies/${companyId}/journal-entries`, data);
export const postJournalEntry = (companyId, entryId) => api.put(`/companies/${companyId}/journal-entries/${entryId}/post`);

// Estimates
export const getEstimates = (companyId) => api.get(`/companies/${companyId}/estimates`);
export const createEstimate = (companyId, data) => api.post(`/companies/${companyId}/estimates`, data);
export const getEstimate = (companyId, estimateId) => api.get(`/companies/${companyId}/estimates/${estimateId}`);
export const updateEstimate = (companyId, estimateId, data) => api.put(`/companies/${companyId}/estimates/${estimateId}`, data);
export const convertEstimateToInvoice = (companyId, estimateId) => api.post(`/companies/${companyId}/estimates/${estimateId}/convert`);
export const deleteEstimate = (companyId, estimateId) => api.delete(`/companies/${companyId}/estimates/${estimateId}`);

// Bills
export const getBills = (companyId) => api.get(`/companies/${companyId}/bills`);
export const createBill = (companyId, data) => api.post(`/companies/${companyId}/bills`, data);
export const getBill = (companyId, billId) => api.get(`/companies/${companyId}/bills/${billId}`);
export const payBill = (companyId, billId, data) => api.post(`/companies/${companyId}/bills/${billId}/pay`, data);
export const deleteBill = (companyId, billId) => api.delete(`/companies/${companyId}/bills/${billId}`);
export const getPurchaseOrders = (companyId, params) => api.get(`/companies/${companyId}/purchase-orders${params ? `?${new URLSearchParams(params).toString()}` : ''}`);
export const createPurchaseOrder = (companyId, data) => api.post(`/companies/${companyId}/purchase-orders`, data);
export const getPurchaseOrder = (companyId, purchaseOrderId) => api.get(`/companies/${companyId}/purchase-orders/${purchaseOrderId}`);
export const updatePurchaseOrder = (companyId, purchaseOrderId, data) => api.put(`/companies/${companyId}/purchase-orders/${purchaseOrderId}`, data);
export const deletePurchaseOrder = (companyId, purchaseOrderId) => api.delete(`/companies/${companyId}/purchase-orders/${purchaseOrderId}`);
export const convertPurchaseOrderToBill = (companyId, purchaseOrderId) => api.post(`/companies/${companyId}/purchase-orders/${purchaseOrderId}/convert-to-bill`);
export const receivePurchaseOrder = (companyId, purchaseOrderId) => api.post(`/companies/${companyId}/purchase-orders/${purchaseOrderId}/receive`);
export const getVendorPurchaseOrders = (companyId, vendorId) => api.get(`/companies/${companyId}/vendors/${vendorId}/purchase-orders`);
export const autoCreateBillsFromPurchaseOrders = (companyId) => api.post(`/companies/${companyId}/purchase-orders/auto-create-bills`);

// Stock Receipts
export const getStockReceipts = (companyId) => api.get(`/companies/${companyId}/stock-receipts`);
export const createStockReceipt = (companyId, data) => api.post(`/companies/${companyId}/stock-receipts`, data);
export const postStockReceipt = (companyId, receiptId) => api.post(`/companies/${companyId}/stock-receipts/${receiptId}/post`);

// General Ledger & Trial Balance
export const getGeneralLedger = (companyId, params) => {
  const qs = new URLSearchParams(params || {}).toString();
  return api.get(`/companies/${companyId}/general-ledger${qs ? '?' + qs : ''}`);
};
export const getTrialBalance = (companyId, asOfDate) => {
  const qs = asOfDate ? `?as_of_date=${asOfDate}` : '';
  return api.get(`/companies/${companyId}/trial-balance${qs}`);
};

// Receive Payment (Customer)
export const receivePaymentBulk = (companyId, data) => api.post(`/companies/${companyId}/receive-payment`, data);
export const listCustomerPayments = (companyId, customerId) => {
  const qs = customerId ? `?customer_id=${customerId}` : '';
  return api.get(`/companies/${companyId}/customer-payments${qs}`);
};

// Pay Vendor
export const payVendorBulk = (companyId, data) => api.post(`/companies/${companyId}/pay-vendor`, data);
export const listVendorPayments = (companyId, vendorId) => {
  const qs = vendorId ? `?vendor_id=${vendorId}` : '';
  return api.get(`/companies/${companyId}/vendor-payments${qs}`);
};
export const getVendorPayment = (companyId, paymentId) => api.get(`/companies/${companyId}/vendor-payments/${paymentId}`);
export const getBankAccounts = (companyId) => api.get(`/companies/${companyId}/bank-accounts`);
export const createBankAccount = (companyId, data) => api.post(`/companies/${companyId}/bank-accounts`, data);
export const updateBankAccount = (companyId, bankAccountId, data) => api.put(`/companies/${companyId}/bank-accounts/${bankAccountId}`, data);
export const getManualBankTransactions = (companyId, bankAccountId) => api.get(`/companies/${companyId}/bank-accounts/${bankAccountId}/manual-transactions`);
export const createManualBankTransaction = (companyId, bankAccountId, data) => api.post(`/companies/${companyId}/bank-accounts/${bankAccountId}/manual-transactions`, data);
export const getStatementLines = (companyId, bankAccountId, status) => api.get(`/companies/${companyId}/bank-accounts/${bankAccountId}/statement-lines${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const importBankStatement = (companyId, bankAccountId, formData) => api.post(`/companies/${companyId}/bank-accounts/${bankAccountId}/statement-import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getStatementCandidates = (companyId, bankAccountId, lineId) => api.get(`/companies/${companyId}/bank-accounts/${bankAccountId}/statement-lines/${lineId}/candidates`);
export const matchStatementLine = (companyId, bankAccountId, lineId, data) => api.post(`/companies/${companyId}/bank-accounts/${bankAccountId}/statement-lines/${lineId}/match`, data);
export const adjustStatementLine = (companyId, bankAccountId, lineId, data) => api.post(`/companies/${companyId}/bank-accounts/${bankAccountId}/statement-lines/${lineId}/adjust`, data);
export const getReconciliationSummary = (companyId, bankAccountId) => api.get(`/companies/${companyId}/bank-accounts/${bankAccountId}/reconciliation-summary`);

// Reports
export const getProfitLoss = (companyId, startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/companies/${companyId}/reports/profit-loss${qs}`);
};
export const getSalesReport = (companyId, startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/companies/${companyId}/reports/sales${qs}`);
};
export const getExpenseReport = (companyId, startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/companies/${companyId}/reports/expenses${qs}`);
};
export const getBalanceSheet = (companyId, asOfDate) => {
  const qs = asOfDate ? `?as_of_date=${asOfDate}` : '';
  return api.get(`/companies/${companyId}/reports/balance-sheet${qs}`);
};
export const getCashFlow = (companyId, startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/companies/${companyId}/reports/cash-flow${qs}`);
};
export const getTaxSummary = (companyId, startDate, endDate) => {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/companies/${companyId}/reports/tax-summary${qs}`);
};
export const getCustomerStatement = (companyId, customerId) => api.get(`/companies/${companyId}/customers/${customerId}/statement`);
export const getCustomerLedger = (companyId, customerId) => api.get(`/companies/${companyId}/customers/${customerId}/ledger`);
export const getVendorLedger = (companyId, vendorId) => api.get(`/companies/${companyId}/vendors/${vendorId}/ledger`);

export default api;
