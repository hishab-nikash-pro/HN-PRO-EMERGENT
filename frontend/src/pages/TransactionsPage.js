import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretDown, Export, MagnifyingGlass, Printer } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { useCompany } from '../contexts/CompanyContext';
import { deleteInvoice, getCreditMemos, getEstimates, getInvoices, getSalesOrders, listCustomerPayments } from '../lib/api';
import { downloadCSV, printReport } from '../lib/exportUtils';

const TRANSACTION_TABS = ['All', 'Invoices', 'Estimates', 'Sales Orders', 'Statement Charges', 'Sales Receipts', 'Received Payments', 'Credit Memos', 'Refunds'];
const CENTER_TABS = TRANSACTION_TABS.filter((tab) => tab !== 'All');
const STATUS_OPTIONS = ['All', 'Open', 'Paid', 'Sent', 'Draft', 'Cancelled'];
const DATE_OPTIONS = ['All Dates', 'Today', 'This Week', 'This Month', 'Last Month', 'Custom'];

const TYPE_ROUTES = {
  Invoices: (row) => `/sales/${row.id}`,
  Estimates: () => '/estimates',
  'Sales Orders': (row) => `/sales-orders/${row.id}`,
  'Received Payments': () => '/customer-payments',
  'Credit Memos': () => '/credit-memos',
};

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeRows({ invoices = [], estimates = [], salesOrders = [], payments = [], creditMemos = [] }) {
  return [
    ...invoices.map((item) => ({
      id: item.invoice_id,
      date: item.invoice_date,
      number: item.invoice_number,
      type: 'Invoices',
      customer: item.customer_name,
      amount: Number(item.total || 0),
      aging: item.balance_due > 0 ? item.aging || '' : '',
      openBalance: Number(item.balance_due || 0),
      status: item.status || 'Draft',
      rep: item.sales_rep || '',
      source: item,
    })),
    ...estimates.map((item) => ({
      id: item.estimate_id,
      date: item.estimate_date,
      number: item.estimate_number,
      type: 'Estimates',
      customer: item.customer_name,
      amount: Number(item.total || 0),
      aging: '',
      openBalance: item.status === 'Converted' ? 0 : Number(item.total || 0),
      status: item.status || 'Draft',
      rep: item.sales_rep || '',
      source: item,
    })),
    ...salesOrders.map((item) => ({
      id: item.sales_order_id,
      date: item.order_date,
      number: item.sales_order_number,
      type: 'Sales Orders',
      customer: item.customer_name,
      amount: Number(item.total || 0),
      aging: '',
      openBalance: item.status === 'Converted' ? 0 : Number(item.total || 0),
      status: item.status || 'Draft',
      rep: item.sales_rep || '',
      source: item,
    })),
    ...payments.map((item) => ({
      id: item.payment_id,
      date: item.payment_date,
      number: item.payment_number || item.reference_number || 'Payment',
      type: 'Received Payments',
      customer: item.customer_name,
      amount: Number(item.amount || item.total_amount || 0),
      aging: '',
      openBalance: 0,
      status: item.status || 'Paid',
      rep: item.received_by || '',
      source: item,
    })),
    ...creditMemos.map((item) => ({
      id: item.credit_memo_id,
      date: item.credit_date || item.credit_memo_date || item.memo_date || item.created_at?.slice(0, 10),
      number: item.credit_memo_number,
      type: 'Credit Memos',
      customer: item.customer_name,
      amount: Number(item.total || item.amount || 0),
      aging: '',
      openBalance: 0,
      status: item.status || 'Open',
      rep: item.sales_rep || '',
      source: item,
    })),
  ].filter((row) => row.id || row.number);
}

function withinDatePreset(rowDate, preset) {
  if (preset === 'All Dates') return true;
  if (!rowDate || preset === 'Custom') return true;
  const today = new Date();
  const date = new Date(`${rowDate}T00:00:00`);
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (preset === 'Today') return date.getTime() === startOfDay.getTime();
  if (preset === 'This Month') return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  if (preset === 'Last Month') {
    const month = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    return date.getFullYear() === year && date.getMonth() === month;
  }
  if (preset === 'This Week') {
    const start = new Date(startOfDay);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return date >= start && date <= end;
  }
  return true;
}

function TransactionGrid({ mode = 'transactions' }) {
  const { selectedCompany, can } = useCompany();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(mode === 'sales' ? 'All' : 'Invoices');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Dates');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const tabs = mode === 'sales' ? TRANSACTION_TABS : CENTER_TABS;
  const pageSize = 18;

  useEffect(() => {
    if (!selectedCompany?.company_id) return;
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const [invoiceRes, estimateRes, orderRes, paymentRes, creditMemoRes] = await Promise.all([
          getInvoices(selectedCompany.company_id),
          getEstimates(selectedCompany.company_id),
          getSalesOrders(selectedCompany.company_id),
          listCustomerPayments(selectedCompany.company_id),
          getCreditMemos(selectedCompany.company_id),
        ]);
        if (!alive) return;
        setRows(normalizeRows({
          invoices: invoiceRes.data || [],
          estimates: estimateRes.data || [],
          salesOrders: orderRes.data || [],
          payments: paymentRes.data?.payments || paymentRes.data || [],
          creditMemos: creditMemoRes.data || [],
        }));
      } catch (error) {
        console.error(error);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [selectedCompany?.company_id]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => activeTab === 'All' || row.type === activeTab)
      .filter((row) => {
        if (statusFilter === 'All') return true;
        if (statusFilter === 'Open') return Number(row.openBalance || 0) > 0 || ['Open', 'Sent', 'Draft'].includes(row.status);
        return row.status === statusFilter;
      })
      .filter((row) => withinDatePreset(row.date, dateFilter))
      .filter((row) => !query || [row.date, row.number, row.type, row.customer, row.status, row.rep].some((value) => String(value || '').toLowerCase().includes(query)))
      .sort((a, b) => {
        const aValue = a[sort.key] ?? '';
        const bValue = b[sort.key] ?? '';
        const result = typeof aValue === 'number' || typeof bValue === 'number'
          ? Number(aValue || 0) - Number(bValue || 0)
          : String(aValue).localeCompare(String(bValue));
        return sort.direction === 'asc' ? result : -result;
      });
  }, [activeTab, dateFilter, rows, search, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [activeTab, dateFilter, search, statusFilter]);

  const openRow = (row) => {
    const routeFactory = TYPE_ROUTES[row.type];
    if (routeFactory) navigate(routeFactory(row));
  };

  const setSortKey = (key) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const exportRows = () => {
    downloadCSV('transactions_export.csv', filtered.map((row) => ({
      date: row.date || '',
      number: row.number || '',
      type: row.type || '',
      customer: row.customer || '',
      amount: row.amount.toFixed(2),
      aging: row.aging || '',
      open_balance: row.openBalance.toFixed(2),
      status: row.status || '',
      rep: row.rep || '',
    })), ['date', 'number', 'type', 'customer', 'amount', 'aging', 'open_balance', 'status', 'rep']);
  };

  const runAction = (row, action) => {
    if (!action) return;
    if (action === 'view') openRow(row);
    if (action === 'edit') navigate(row.type === 'Invoices' ? `/sales/${row.id}/edit` : TYPE_ROUTES[row.type]?.(row) || '/transactions');
    if (action === 'print' && row.type === 'Invoices') navigate(`/sales/${row.id}/print`);
    if (action === 'email' && row.type === 'Invoices') navigate(`/sales/${row.id}`);
    if (action === 'delete' && row.type === 'Invoices') setDeleteTarget(row);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !selectedCompany?.company_id) return;
    await deleteInvoice(selectedCompany.company_id, deleteTarget.id);
    setRows((current) => current.filter((row) => !(row.type === 'Invoices' && row.id === deleteTarget.id)));
    setDeleteTarget(null);
  };

  const manageOptions = [
    ['New Invoice', '/sales/new'],
    ['New Estimate', '/estimates'],
    ['New Sales Order', '/sales-orders'],
    ['New Sales Receipt', '/sales/new'],
    ['Receive Payment', '/customer-payments/new'],
    ['New Credit Memo', '/credit-memos'],
    ['New Refund', '/credit-memos'],
  ];
  const reportOptions = [
    ['Sales by Customer', '/reports/sales'],
    ['Open Invoices', '/receivables'],
    ['Customer Balance', '/customer-ledger'],
    ['Receivables Aging', '/reports/receivables-aging'],
    ['Sales Summary', '/reports/sales'],
  ];

  return (
    <div data-testid={mode === 'sales' ? 'sales-list-page' : 'transactions-page'} className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#191C1E' }}>{mode === 'sales' ? 'Sales' : 'Transactions'}</h1>
          <p className="mt-1 text-sm" style={{ color: '#475569' }}>
            {mode === 'sales' ? 'Manage invoices, quotes, and sales orders' : 'QuickBooks-style transaction center using live sales records.'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="rounded-xl px-4 py-2 text-xs font-bold" style={{ background: activeTab === tab ? '#0F2D5C' : 'transparent', color: activeTab === tab ? '#FFFFFF' : '#0F2D5C' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm md:flex-row md:items-center">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>
          Filter By
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg px-3 py-2 text-sm normal-case" style={{ boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
            {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>
          Date
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-lg px-3 py-2 text-sm normal-case" style={{ boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
            {DATE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <div className="relative min-w-[220px] flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." className="w-full rounded-lg py-2 pl-9 pr-3 text-sm" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} />
        </div>
        <button onClick={exportRows} className="rounded-lg p-2 hover:bg-[#F7F9FB]" aria-label="Export transactions"><Export size={18} /></button>
        <button onClick={printReport} className="rounded-lg p-2 hover:bg-[#F7F9FB]" aria-label="Print transactions"><Printer size={18} /></button>
      </div>

      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-xs">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #C4C5D7' }}>
                {[
                  ['date', 'Date'], ['number', 'Number'], ['type', 'Type'], ['customer', 'Customer'], ['amount', 'Amount'], ['aging', 'Aging'], ['openBalance', 'Open Balance'], ['status', 'Status'], ['rep', 'Rep'],
                ].map(([key, label]) => (
                  <th key={key} onClick={() => setSortKey(key)} className="cursor-pointer border-r px-3 py-2 text-left font-bold uppercase tracking-wide" style={{ borderColor: '#D7DFEA', color: '#1E293B' }}>{label}</th>
                ))}
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-16 text-center">Loading transactions...</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={10} className="py-24 text-center" style={{ color: '#64748B' }}>No transactions match this view.</td></tr>
              ) : pageRows.map((row, index) => (
                <tr key={`${row.type}-${row.id}`} onClick={() => openRow(row)} className="cursor-pointer hover:bg-[#DCEBFF]" style={{ background: index % 2 === 0 ? '#FFFFFF' : '#EAF3FF', borderBottom: '1px solid #D7DFEA' }}>
                  <td className="border-r px-3 py-2" style={{ borderColor: '#D7DFEA' }}>{row.date || '—'}</td>
                  <td className="border-r px-3 py-2 font-bold" style={{ borderColor: '#D7DFEA', color: '#0F2D5C' }}>{row.number || '—'}</td>
                  <td className="border-r px-3 py-2" style={{ borderColor: '#D7DFEA' }}>{row.type}</td>
                  <td className="border-r px-3 py-2 font-semibold" style={{ borderColor: '#D7DFEA' }}>{row.customer || 'Unassigned'}</td>
                  <td className="border-r px-3 py-2 text-right tabular-nums" style={{ borderColor: '#D7DFEA' }}>{money(row.amount)}</td>
                  <td className="border-r px-3 py-2" style={{ borderColor: '#D7DFEA' }}>{row.aging || '—'}</td>
                  <td className="border-r px-3 py-2 text-right tabular-nums" style={{ borderColor: '#D7DFEA' }}>{money(row.openBalance)}</td>
                  <td className="border-r px-3 py-2" style={{ borderColor: '#D7DFEA' }}>{row.status || '—'}</td>
                  <td className="border-r px-3 py-2" style={{ borderColor: '#D7DFEA' }}>{row.rep || '—'}</td>
                  <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                    <select defaultValue="" onChange={(event) => { runAction(row, event.target.value); event.target.value = ''; }} className="rounded-lg px-2 py-1 text-xs" style={{ boxShadow: '0 0 0 1px #C4C5D7' }}>
                      <option value="">Actions</option>
                      <option value="view">View</option>
                      <option value="edit">Edit</option>
                      {row.type === 'Invoices' && <option value="print">Print</option>}
                      {row.type === 'Invoices' && <option value="email">Email</option>}
                      {can.admin && row.type === 'Invoices' && <option value="delete">Delete</option>}
                    </select>
                  </td>
                </tr>
              ))}
              {!loading && pageRows.length > 0 && Array.from({ length: Math.max(0, 16 - pageRows.length) }).map((_, index) => (
                <tr key={`blank-${index}`} style={{ background: (pageRows.length + index) % 2 === 0 ? '#FFFFFF' : '#EAF3FF', height: 28, borderBottom: '1px solid #D7DFEA' }}>
                  {Array.from({ length: 10 }).map((__, cell) => <td key={cell} className="border-r" style={{ borderColor: '#D7DFEA' }} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t bg-[#F8FAFC] px-3 py-2 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#D7DFEA' }}>
          <div className="flex gap-2">
            <ActionMenu label="Manage Transactions" options={manageOptions} navigate={navigate} />
            <ActionMenu label="Run Reports" options={reportOptions} navigate={navigate} />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg px-3 py-1" style={{ boxShadow: '0 0 0 1px #C4C5D7' }}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg px-3 py-1" style={{ boxShadow: '0 0 0 1px #C4C5D7' }}>Next</button>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {pageRows.map((row) => (
          <button key={`${row.type}-mobile-${row.id}`} onClick={() => openRow(row)} className="w-full rounded-2xl bg-white p-4 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-bold" style={{ color: '#0F2D5C' }}>{row.number}</span>
                <span className="mt-1 block text-sm">{row.customer || 'Unassigned'}</span>
                <span className="mt-1 block text-xs" style={{ color: '#64748B' }}>{row.type} • {row.date || 'No date'}</span>
              </span>
              <span className="text-right font-bold">{money(row.amount)}</span>
            </div>
            <div className="mt-3 flex justify-between text-xs" style={{ color: '#64748B' }}>
              <span>Status: {row.status}</span>
              <span>Open: {money(row.openBalance)}</span>
            </div>
          </button>
        ))}
      </div>

      <ConfirmDeleteModal open={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
}

function ActionMenu({ label, options, navigate }) {
  return (
    <label className="relative inline-flex items-center">
      <select onChange={(event) => { if (event.target.value) navigate(event.target.value); event.target.value = ''; }} defaultValue="" className="appearance-none rounded-lg bg-white py-2 pl-3 pr-8 text-xs font-bold" style={{ boxShadow: '0 0 0 1px #C4C5D7', color: '#0F2D5C' }}>
        <option value="">{label}</option>
        {options.map(([name, route]) => <option key={name} value={route}>{name}</option>)}
      </select>
      <CaretDown size={12} className="pointer-events-none absolute right-3" />
    </label>
  );
}

export function SalesTransactionCenter() {
  return (
    <AppShell>
      <TransactionGrid mode="sales" />
    </AppShell>
  );
}

export default function TransactionsPage() {
  return (
    <AppShell>
      <TransactionGrid mode="transactions" />
    </AppShell>
  );
}
