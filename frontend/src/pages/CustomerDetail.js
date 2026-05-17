import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, EnvelopeSimple, Phone, Globe, MapPin } from '@phosphor-icons/react';
import { useCompany } from '../contexts/CompanyContext';
import { getCreditMemos, getCustomer, getEstimates, getInvoices, listCustomerPayments } from '../lib/api';
import AppShell from '../components/layout/AppShell';

const TABS = ['Invoices', 'Payments', 'Estimates', 'Refunds'];
const FILTERS = ['Today', 'Month', 'Custom'];
const todayString = () => new Date().toISOString().slice(0, 10);
const monthPrefix = () => todayString().slice(0, 7);

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [activeTab, setActiveTab] = useState('Invoices');
  const [activeFilter, setActiveFilter] = useState('Month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selectedCompany?.company_id || !customerId) return;
    setLoading(true);
    try {
      const [customerRes, invoiceRes, paymentRes, estimateRes, refundRes] = await Promise.all([
        getCustomer(selectedCompany.company_id, customerId),
        getInvoices(selectedCompany.company_id),
        listCustomerPayments(selectedCompany.company_id, customerId),
        getEstimates(selectedCompany.company_id),
        getCreditMemos(selectedCompany.company_id, customerId),
      ]);
      setCustomer(customerRes.data || null);
      setInvoices((invoiceRes.data || []).filter((invoice) => invoice.customer_id === customerId));
      setPayments(Array.isArray(paymentRes.data?.payments) ? paymentRes.data.payments : []);
      setEstimates((estimateRes.data || []).filter((estimate) => estimate.customer_id === customerId));
      setRefunds(Array.isArray(refundRes.data) ? refundRes.data : []);
    } catch (error) {
      console.error(error);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.company_id, customerId]);

  useEffect(() => {
    if (!selectedCompany?.company_id || !customerId) return;
    load();
  }, [selectedCompany?.company_id, customerId, load]);

  const inDateRange = useCallback((dateValue) => {
    const value = String(dateValue || '');
    if (!value) return true;
    if (activeFilter === 'Today') return value === todayString();
    if (activeFilter === 'Month') return value.startsWith(monthPrefix());
    if (activeFilter === 'Custom') {
      if (customStart && value < customStart) return false;
      if (customEnd && value > customEnd) return false;
    }
    return true;
  }, [activeFilter, customStart, customEnd]);

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => inDateRange(invoice.invoice_date)), [invoices, inDateRange]);
  const filteredPayments = useMemo(() => payments.filter((payment) => inDateRange(payment.payment_date)), [payments, inDateRange]);
  const filteredEstimates = useMemo(() => estimates.filter((estimate) => inDateRange(estimate.estimate_date)), [estimates, inDateRange]);
  const filteredRefunds = useMemo(() => refunds.filter((refund) => inDateRange(refund.credit_date || refund.created_at?.slice(0, 10))), [refunds, inDateRange]);

  if (loading) {
    return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  }
  if (!customer) {
    return <AppShell><div className="text-center py-12" style={{ color: '#434655' }}>Customer not found.</div></AppShell>;
  }

  const storeName = customer.store_name || customer.name || '';
  const contactPerson = customer.contact_person || customer.company_name || '';

  return (
    <AppShell>
      <div data-testid="customer-detail-page" className="space-y-6 max-w-6xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/customers')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{storeName}</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{contactPerson || 'Customer profile'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate(`/customers/${customerId}/edit`)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>Edit</button>
            <button onClick={() => navigate(`/customers/${customerId}/statement`)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>Statement</button>
            <button onClick={() => navigate('/sales/new')} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Create Invoice</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Store Name</div>
              <div className="text-base font-semibold mt-1" style={{ color: '#191C1E' }}>{storeName || '-'}</div>
            </div>
            <DetailRow label="Contact Person" value={contactPerson || '-'} />
            <DetailRow icon={<Phone size={15} />} label="Phone" value={customer.phone || '-'} />
            <DetailRow icon={<EnvelopeSimple size={15} />} label="Email" value={customer.email || '-'} />
            <DetailRow icon={<MapPin size={15} />} label="Address" value={customer.address || '-'} />
            <DetailRow icon={<Globe size={15} />} label="Website" value={customer.website || '-'} />
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {TABS.map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: activeTab === tab ? '#0F2D5C' : '#F7F9FB', color: activeTab === tab ? '#FFFFFF' : '#0F2D5C' }}>
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {FILTERS.map((filter) => (
                    <button key={filter} onClick={() => setActiveFilter(filter)} className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: activeFilter === filter ? '#E0F2FE' : '#F7F9FB', color: activeFilter === filter ? '#075985' : '#475569' }}>
                      {filter}
                    </button>
                  ))}
                  {activeFilter === 'Custom' && (
                    <>
                      <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded-lg px-3 py-2 text-xs" style={{ boxShadow: '0 0 0 1px #CBD5E1' }} />
                      <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-lg px-3 py-2 text-xs" style={{ boxShadow: '0 0 0 1px #CBD5E1' }} />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              {activeTab === 'Invoices' && (
                <SimpleTable
                  empty="No invoices for this filter."
                  columns={['Date', 'Invoice #', 'Total', 'Balance', 'Status']}
                  rows={filteredInvoices.map((invoice) => ({
                    key: invoice.invoice_id,
                    onClick: () => navigate(`/sales/${invoice.invoice_id}`),
                    cells: [invoice.invoice_date || '-', invoice.invoice_number || '-', `$${Number(invoice.total || 0).toFixed(2)}`, `$${Number(invoice.balance_due || 0).toFixed(2)}`, invoice.status || '-'],
                  }))}
                />
              )}
              {activeTab === 'Payments' && (
                <SimpleTable
                  empty="No payments for this filter."
                  columns={['Date', 'Reference', 'Amount', 'Method']}
                  rows={filteredPayments.map((payment, index) => ({
                    key: payment.payment_id || index,
                    cells: [payment.payment_date || '-', payment.reference || '-', `$${Number(payment.amount || 0).toFixed(2)}`, payment.payment_method || '-'],
                  }))}
                />
              )}
              {activeTab === 'Estimates' && (
                <SimpleTable
                  empty="No estimates for this filter."
                  columns={['Date', 'Estimate #', 'Total', 'Status']}
                  rows={filteredEstimates.map((estimate) => ({
                    key: estimate.estimate_id,
                    onClick: () => navigate(`/estimates/${estimate.estimate_id}`),
                    cells: [estimate.estimate_date || '-', estimate.estimate_number || '-', `$${Number(estimate.total || 0).toFixed(2)}`, estimate.status || '-'],
                  }))}
                />
              )}
              {activeTab === 'Refunds' && (
                <SimpleTable
                  empty="No refunds or credit memos for this filter."
                  columns={['Date', 'Credit Memo #', 'Amount', 'Status']}
                  rows={filteredRefunds.map((refund) => ({
                    key: refund.credit_memo_id,
                    cells: [refund.credit_date || refund.created_at?.slice(0, 10) || '-', refund.credit_memo_number || '-', `$${Number(refund.total || 0).toFixed(2)}`, refund.status || '-'],
                  }))}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DetailRow({ icon = null, label, value }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{label}</div>
      <div className="text-sm mt-1 flex items-center gap-2" style={{ color: '#191C1E' }}>
        {icon}
        <span>{value}</span>
      </div>
    </div>
  );
}

function SimpleTable({ columns, rows, empty }) {
  if (!rows.length) {
    return <div className="py-16 text-center text-sm" style={{ color: '#64748B' }}>{empty}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
            {columns.map((column) => <th key={column} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} onClick={row.onClick} className={row.onClick ? 'cursor-pointer hover:bg-[#EFF6FF]' : ''} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
              {row.cells.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3" style={{ color: '#191C1E' }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
