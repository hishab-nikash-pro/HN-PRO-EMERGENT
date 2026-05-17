import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Plus, Receipt, CurrencyDollar, BookOpen, Users } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { getCustomers, getInvoices, listCustomerPayments } from '../lib/api';

const tabs = ['Profile', 'Transactions', 'Payments', 'Ledger'];
const asArray = (value) => (Array.isArray(value) ? value : []);

export default function CustomerCenter() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Profile');
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany?.company_id) return;
    setLoading(true);
    Promise.all([
      getCustomers(selectedCompany.company_id),
      getInvoices(selectedCompany.company_id),
      listCustomerPayments(selectedCompany.company_id),
    ])
      .then(([customerRes, invoiceRes, paymentRes]) => {
        setCustomers(asArray(customerRes.data));
        setInvoices(asArray(invoiceRes.data));
        setPayments(asArray(paymentRes.data?.payments || paymentRes.data));
      })
      .catch(() => {
        setCustomers([]);
        setInvoices([]);
        setPayments([]);
      })
      .finally(() => setLoading(false));
  }, [selectedCompany?.company_id]);

  const term = search.trim().toLowerCase();
  const filteredCustomers = useMemo(() => asArray(customers).filter((customer) => (
    !term || [customer.name, customer.company_name, customer.phone, customer.email].join(' ').toLowerCase().includes(term)
  )), [customers, term]);
  const filteredInvoices = useMemo(() => asArray(invoices).filter((invoice) => (
    !term || [invoice.invoice_number, invoice.customer_name, invoice.status].join(' ').toLowerCase().includes(term)
  )), [invoices, term]);
  const filteredPayments = useMemo(() => asArray(payments).filter((payment) => (
    !term || [payment.customer_name, payment.payment_number, payment.reference].join(' ').toLowerCase().includes(term)
  )), [payments, term]);

  const selectedCustomer = filteredCustomers[0];

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: '#0E7490' }}>Customer Center</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Customers</h1>
            <p className="mt-1 text-sm" style={{ color: '#434655' }}>Profiles, transactions, payments, and ledgers in one place.</p>
          </div>
          <button onClick={() => navigate('/customers')} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            <Plus size={16} weight="bold" /> Add / Manage Customer
          </button>
        </div>

        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: activeTab === tab ? '#0F2D5C' : '#F7F9FB', color: activeTab === tab ? '#FFFFFF' : '#0F2D5C' }}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="relative min-w-[260px]">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers, invoices, payments..." className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-sm" style={{ color: '#64748B' }}>Loading customer center...</div>
          ) : activeTab === 'Profile' ? (
            <CenterTable
              icon={Users}
              empty="No customers found."
              columns={['Customer', 'Company', 'Phone', 'Email', 'Open Balance']}
              rows={filteredCustomers.map((customer) => ({
                key: customer.customer_id,
                onClick: () => navigate(`/customers/${customer.customer_id}`),
                cells: [customer.name, customer.company_name || '-', customer.phone || '-', customer.email || '-', `$${Number(customer.open_balance || 0).toFixed(2)}`],
              }))}
            />
          ) : activeTab === 'Transactions' ? (
            <CenterTable
              icon={Receipt}
              empty="No customer transactions found."
              columns={['Date', 'Number', 'Customer', 'Total', 'Balance', 'Status']}
              rows={filteredInvoices.map((invoice) => ({
                key: invoice.invoice_id,
                onClick: () => navigate(`/sales/${invoice.invoice_id}`),
                cells: [invoice.invoice_date || '-', invoice.invoice_number || '-', invoice.customer_name || '-', `$${Number(invoice.total || 0).toFixed(2)}`, `$${Number(invoice.balance_due || 0).toFixed(2)}`, invoice.status || '-'],
              }))}
            />
          ) : activeTab === 'Payments' ? (
            <CenterTable
              icon={CurrencyDollar}
              empty="No customer payments found."
              columns={['Date', 'Customer', 'Amount', 'Method', 'Reference']}
              rows={filteredPayments.map((payment) => ({
                key: payment.payment_id,
                cells: [payment.payment_date || '-', payment.customer_name || '-', `$${Number(payment.amount || 0).toFixed(2)}`, payment.payment_method || '-', payment.reference || '-'],
              }))}
            />
          ) : (
            filteredCustomers.length === 0 ? (
              <CenterEmpty icon={BookOpen} text="No transactions available" />
            ) : (
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <BookOpen size={26} style={{ color: '#0E7490' }} />
                <div>
                  <h2 className="font-bold" style={{ color: '#191C1E' }}>{selectedCustomer ? selectedCustomer.name : 'Customer Ledger'}</h2>
                  <p className="text-sm" style={{ color: '#64748B' }}>Open the live customer ledger page for detailed running balances.</p>
                </div>
              </div>
              <button onClick={() => navigate('/customer-ledger')} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: '#0F2D5C' }}>
                Open Customer Ledger
              </button>
            </div>
            )
          )}
        </div>
      </div>
    </AppShell>
  );
}

function CenterTable({ columns, rows, empty, icon: Icon }) {
  if (!Array.isArray(rows) || !rows.length) {
    return <CenterEmpty icon={Icon} text={empty || 'No transactions available'} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
            {columns.map((column) => <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key || index} onClick={row.onClick} className={row.onClick ? 'cursor-pointer hover:bg-[#EFF6FF]' : ''} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
              {row.cells.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3" style={{ color: cellIndex === 0 ? '#0F2D5C' : '#191C1E', fontWeight: cellIndex === 0 ? 700 : 500 }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CenterEmpty({ icon: Icon, text }) {
  return <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm" style={{ color: '#64748B' }}><Icon size={30} />{text}</div>;
}
