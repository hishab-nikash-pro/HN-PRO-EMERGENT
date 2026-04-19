import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { listVendorPayments } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, CaretRight } from '@phosphor-icons/react';

const money = (v) => `$${(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function VendorPayments() {
  const { selectedCompany } = useCompany();
  const [payments, setPayments] = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    setLoading(true);
    listVendorPayments(selectedCompany.company_id)
      .then(res => {
        setPayments(res.data.payments || []);
        setTotalPaid(res.data.total_paid || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany]);

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || (p.vendor_name || '').toLowerCase().includes(q) || (p.bill_number || '').toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q);
    const matchM = !method || p.payment_method === method;
    return matchQ && matchM;
  });
  const methods = [...new Set(payments.map(p => p.payment_method).filter(Boolean))];
  const filteredTotal = filtered.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <AppShell>
      <div data-testid="vendor-payments-page" className="space-y-5 md:space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>Vendor Payments</h1>
            <p className="text-sm mt-1" style={{ color: '#475569' }}>Payments made to vendors against bills</p>
          </div>
          <button
            data-testid="new-vendor-payment-btn"
            onClick={() => navigate('/vendor-payments/new')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
          >
            <Plus size={16} weight="bold" /> Pay Vendor
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-xl p-4 md:p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#475569' }}>Total Paid</p>
            <p className="text-lg md:text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>{money(totalPaid)}</p>
          </div>
          <div className="rounded-xl p-4 md:p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#475569' }}>Payment Count</p>
            <p className="text-lg md:text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>{payments.length}</p>
          </div>
          <div className="rounded-xl p-4 md:p-5 col-span-2 md:col-span-1" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#475569' }}>Filtered Total</p>
            <p className="text-lg md:text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0E7490' }}>{money(filteredTotal)}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#475569' }} />
            <input data-testid="vpayments-search" type="text" placeholder="Search by vendor, bill, ref..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
          </div>
          <select data-testid="vpayment-method-filter" value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
            style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }}>
            <option value="">All Methods</option>
            {methods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block rounded-xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #CBD5E1' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Vendor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Bill</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Method</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Reference</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#475569' }}>No payments yet</td></tr>
                  ) : filtered.map((p, i) => (
                    <tr key={p.payment_id || i} data-testid={`vpayment-row-${p.payment_id || i}`}
                      className="transition-colors hover:bg-[#F7F9FB]"
                      style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                      <td className="px-4 py-3" style={{ color: '#0F172A' }}>{p.payment_date || '—'}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{p.vendor_name || '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#0E7490' }}>{p.bill_number || '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#475569' }}>{p.payment_method || '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#475569' }}>{p.reference || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#B91C1C' }}>
                        {money(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl p-6 text-center text-sm" style={{ background: '#FFFFFF', color: '#475569' }}>No payments yet</div>
          ) : filtered.map((p, i) => (
            <div key={p.payment_id || i} className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate" style={{ color: '#0F172A' }}>{p.vendor_name || '—'}</p>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{p.payment_date} • {p.bill_number || '—'}</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>{p.payment_method}{p.reference ? ` • ${p.reference}` : ''}</p>
              </div>
              <span className="font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#B91C1C' }}>{money(p.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
