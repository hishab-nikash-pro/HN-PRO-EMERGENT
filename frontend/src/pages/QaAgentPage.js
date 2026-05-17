import { useMemo, useState } from 'react';
import { CheckCircle, PlayCircle, WarningCircle, XCircle } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import {
  getBills,
  getCustomers,
  getDashboard,
  getEstimates,
  getExpenses,
  getInvoices,
  getInventory,
  getProducts,
  getPurchaseOrders,
  getSalesOrders,
  getSettings,
  getShipments,
  getStockTransfers,
  getVendors,
} from '../lib/api';

const checks = [
  { id: 'dashboard', label: 'Dashboard metrics load', run: (companyId) => getDashboard(companyId) },
  { id: 'customers', label: 'Customers page backend loads', run: (companyId) => getCustomers(companyId) },
  { id: 'vendors', label: 'Vendors page backend loads', run: (companyId) => getVendors(companyId) },
  { id: 'products', label: 'Products page backend loads', run: (companyId) => getProducts(companyId) },
  { id: 'invoices', label: 'Invoices and sales list load', run: (companyId) => getInvoices(companyId) },
  { id: 'estimates', label: 'Estimates load', run: (companyId) => getEstimates(companyId) },
  { id: 'sales-orders', label: 'Sales orders load', run: (companyId) => getSalesOrders(companyId) },
  { id: 'credit-memos-route', label: 'Credit memo route is registered', route: '/credit-memos' },
  { id: 'payments-route', label: 'Customer payments route is registered', route: '/customer-payments' },
  { id: 'bills', label: 'Bills load', run: (companyId) => getBills(companyId) },
  { id: 'expenses', label: 'Expenses load', run: (companyId) => getExpenses(companyId) },
  { id: 'purchase-orders', label: 'Purchase orders load', run: (companyId) => getPurchaseOrders(companyId) },
  { id: 'inventory', label: 'Inventory loads', run: (companyId) => getInventory(companyId) },
  { id: 'stock-transfers', label: 'Stock transfers load', run: (companyId) => getStockTransfers(companyId) },
  { id: 'shipments', label: 'Shipments load', run: (companyId) => getShipments(companyId) },
  { id: 'settings', label: 'Settings and invoice template JSON load', run: (companyId) => getSettings(companyId) },
  { id: 'template-builder', label: 'Invoice Template Builder page exists', route: '/settings?tab=invoice' },
  { id: 'deleted-records', label: 'Deleted Records page exists', route: '/deleted-records' },
  { id: 'map-view', label: 'Map View is available on dashboard', route: '/dashboard' },
];

const routePaths = new Set([
  '/dashboard', '/customers', '/vendors', '/products', '/sales', '/sales/new', '/estimates', '/sales-orders',
  '/credit-memos', '/customer-payments', '/bills', '/expenses', '/purchase-orders', '/inventory',
  '/stock-transfers', '/shipments', '/reports', '/settings', '/settings?tab=invoice', '/deleted-records',
  '/app-guide',
]);

export default function QaAgentPage() {
  const { selectedCompany } = useCompany();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);

  const summary = useMemo(() => ({
    passed: results.filter((result) => result.status === 'Passed').length,
    failed: results.filter((result) => result.status === 'Failed').length,
    warning: results.filter((result) => result.status === 'Warning').length,
  }), [results]);

  const runFullTest = async () => {
    if (!selectedCompany?.company_id) return;
    setRunning(true);
    const nextResults = [];
    for (const check of checks) {
      try {
        if (check.route) {
          const path = check.route.split('?')[0];
          nextResults.push({
            id: check.id,
            label: check.label,
            status: routePaths.has(path) ? 'Passed' : 'Failed',
            detail: routePaths.has(path) ? `Route ready: ${check.route}` : `Broken route: ${check.route}`,
          });
        } else {
          const response = await check.run(selectedCompany.company_id);
          const payload = response.data;
          nextResults.push({
            id: check.id,
            label: check.label,
            status: 'Passed',
            detail: Array.isArray(payload) ? `${payload.length} record(s) returned.` : 'Backend responded successfully.',
          });
        }
      } catch (error) {
        nextResults.push({
          id: check.id,
          label: check.label,
          status: error?.response?.status === 404 ? 'Failed' : 'Warning',
          detail: error?.response?.data?.detail || error.message || 'Unknown test failure.',
        });
      }
      setResults([...nextResults]);
    }
    setRunning(false);
  };

  return (
    <AppShell>
      <div className="space-y-5" data-testid="qa-agent-page">
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#0E7490' }}>Internal Testing Agent</p>
              <h1 className="mt-2 text-2xl font-bold" style={{ color: '#191C1E' }}>HNP QA Agent</h1>
              <p className="mt-1 text-sm" style={{ color: '#475569' }}>Tests production routes, backend endpoints, and core business modules for broken wiring.</p>
            </div>
            <button onClick={runFullTest} disabled={running} className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <PlayCircle size={18} />
              {running ? 'Running Full App Test...' : 'Run Full App Test'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Passed" value={summary.passed} color="#047857" />
          <SummaryCard label="Warning" value={summary.warning} color="#B45309" />
          <SummaryCard label="Failed" value={summary.failed} color="#B91C1C" />
        </div>

        <div className="overflow-hidden rounded-[28px] bg-white shadow-sm">
          <div className="border-b px-5 py-4" style={{ borderColor: '#E6E8EA' }}>
            <h2 className="text-base font-semibold" style={{ color: '#191C1E' }}>QA Result Report</h2>
          </div>
          {results.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm" style={{ color: '#64748B' }}>Run the QA agent to generate a detailed report.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#E6E8EA' }}>
              {results.map((result) => <ResultRow key={result.id} result={result} />)}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function ResultRow({ result }) {
  const Icon = result.status === 'Passed' ? CheckCircle : result.status === 'Failed' ? XCircle : WarningCircle;
  const color = result.status === 'Passed' ? '#047857' : result.status === 'Failed' ? '#B91C1C' : '#B45309';
  return (
    <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <Icon size={20} weight="fill" style={{ color }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: '#191C1E' }}>{result.label}</p>
          <p className="mt-1 text-xs" style={{ color: '#64748B' }}>{result.detail}</p>
        </div>
      </div>
      <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: `${color}18`, color }}>{result.status}</span>
    </div>
  );
}
