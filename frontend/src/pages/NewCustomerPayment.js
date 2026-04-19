import { useEffect, useMemo, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getCustomers, getInvoices, receivePaymentBulk } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from '@phosphor-icons/react';

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'Check', 'Credit Card', 'ACH', 'Wire', 'Other'];
const money = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NewCustomerPayment() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Bank Transfer');
  const [reference, setReference] = useState('');
  const [depositTo, setDepositTo] = useState('Operating Account');
  const [amountsByInv, setAmountsByInv] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!selectedCompany) return;
    getCustomers(selectedCompany.company_id).then(r => setCustomers(r.data || []));
  }, [selectedCompany]);

  useEffect(() => {
    if (!selectedCompany || !customerId) { setInvoices([]); setAmountsByInv({}); return; }
    getInvoices(selectedCompany.company_id).then(r => {
      const open = (r.data || []).filter(i => i.customer_id === customerId && (i.balance_due || 0) > 0 && i.status !== 'Cancelled');
      open.sort((a, b) => (a.issue_date || '').localeCompare(b.issue_date || ''));
      setInvoices(open);
      setAmountsByInv({});
    });
  }, [customerId, selectedCompany]);

  const totalApplied = useMemo(() => Object.values(amountsByInv).reduce((s, a) => s + (Number(a) || 0), 0), [amountsByInv]);
  const selectedCustomer = customers.find(c => c.customer_id === customerId);

  const handleAmount = (invId, val, max) => {
    const n = Math.max(0, Math.min(Number(val) || 0, max));
    setAmountsByInv(prev => ({ ...prev, [invId]: n }));
  };

  const applyFull = (inv) => handleAmount(inv.invoice_id, inv.balance_due, inv.balance_due);
  const clearInvoice = (invId) => setAmountsByInv(prev => ({ ...prev, [invId]: 0 }));

  const autoApply = (total) => {
    let remaining = Number(total) || 0;
    const next = {};
    for (const inv of invoices) {
      if (remaining <= 0) { next[inv.invoice_id] = 0; continue; }
      const take = Math.min(remaining, inv.balance_due || 0);
      next[inv.invoice_id] = take;
      remaining -= take;
    }
    setAmountsByInv(next);
  };

  const handleSubmit = async () => {
    if (!selectedCompany || !customerId || totalApplied <= 0) return;
    setSubmitting(true);
    try {
      const applications = Object.entries(amountsByInv)
        .filter(([, amt]) => Number(amt) > 0)
        .map(([invoice_id, amount]) => ({ invoice_id, amount: Number(amount) }));
      await receivePaymentBulk(selectedCompany.company_id, {
        customer_id: customerId, payment_date: paymentDate, payment_method: method,
        reference, deposit_to: depositTo, applications
      });
      setSuccess(true);
      setTimeout(() => navigate('/customer-payments'), 1200);
    } catch (e) {
      console.error(e);
      alert('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div data-testid="new-customer-payment-page" className="space-y-5 max-w-5xl mx-auto">
        <button onClick={() => navigate('/customer-payments')} className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
          <ArrowLeft size={14} /> Back to Payments
        </button>

        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>Record Customer Payment</h1>
          <p className="text-sm mt-1" style={{ color: '#475569' }}>Apply a single payment across one or more outstanding invoices</p>
        </div>

        {/* Payment header card */}
        <div className="rounded-xl p-4 md:p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Customer</label>
              <select data-testid="payment-customer-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }}>
                <option value="">Select customer...</option>
                {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name} — Balance {money(c.open_balance)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Payment Date</label>
              <input data-testid="payment-date-input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Payment Method</label>
              <select data-testid="payment-method-select" value={method} onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Reference / Check #</label>
              <input data-testid="payment-reference-input" type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional"
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Deposit To</label>
              <input data-testid="payment-deposit-input" type="text" value={depositTo} onChange={(e) => setDepositTo(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
            </div>
          </div>
        </div>

        {/* Outstanding invoices */}
        {customerId && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" style={{ borderBottom: '1px solid #F2F4F6' }}>
              <div>
                <h3 className="font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>Outstanding Invoices {selectedCustomer ? `— ${selectedCustomer.name}` : ''}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{invoices.length} open invoice(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <input data-testid="auto-apply-input" type="number" step="0.01" min="0" placeholder="Auto-apply amount"
                  onKeyDown={(e) => { if (e.key === 'Enter') { autoApply(e.target.value); e.target.value = ''; } }}
                  className="px-3 py-2 text-sm rounded-lg w-40 focus:outline-none focus:ring-1"
                  style={{ background: '#F7F9FB', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
                <button data-testid="auto-apply-btn" onClick={() => { const el = document.querySelector('[data-testid="auto-apply-input"]'); if (el) { autoApply(el.value); el.value=''; } }} className="px-3 py-2 text-xs font-medium rounded-lg" style={{ background: '#F2F4F6', color: '#0F2D5C' }}>Apply</button>
              </div>
            </div>

            {invoices.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: '#475569' }}>No outstanding invoices for this customer.</div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #CBD5E1' }}>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Invoice</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Due</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Total</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Balance</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Pay</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv, i) => (
                        <tr key={inv.invoice_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                          <td className="px-4 py-3 font-medium" style={{ color: '#0E7490' }}>{inv.invoice_number}</td>
                          <td className="px-4 py-3" style={{ color: '#475569' }}>{inv.issue_date}</td>
                          <td className="px-4 py-3" style={{ color: '#475569' }}>{inv.due_date || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>{money(inv.total)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#B91C1C' }}>{money(inv.balance_due)}</td>
                          <td className="px-4 py-3 text-right">
                            <input data-testid={`pay-amount-${inv.invoice_id}`} type="number" step="0.01" min="0" max={inv.balance_due}
                              value={amountsByInv[inv.invoice_id] || ''}
                              onChange={(e) => handleAmount(inv.invoice_id, e.target.value, inv.balance_due)}
                              className="w-28 px-2 py-1 text-sm text-right rounded border focus:outline-none focus:ring-1"
                              style={{ borderColor: '#CBD5E1', color: '#0F172A' }} />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => applyFull(inv)} className="text-xs font-medium px-2 py-1 rounded" style={{ background: '#F2F4F6', color: '#0F2D5C' }}>Full</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="md:hidden divide-y" style={{ borderColor: '#F2F4F6' }}>
                  {invoices.map(inv => (
                    <div key={inv.invoice_id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#0E7490' }}>{inv.invoice_number}</p>
                          <p className="text-xs" style={{ color: '#475569' }}>Due {inv.due_date || inv.issue_date}</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#B91C1C' }}>{money(inv.balance_due)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input data-testid={`pay-amount-m-${inv.invoice_id}`} type="number" step="0.01" min="0" max={inv.balance_due}
                          value={amountsByInv[inv.invoice_id] || ''}
                          onChange={(e) => handleAmount(inv.invoice_id, e.target.value, inv.balance_due)}
                          placeholder="Pay amount"
                          className="flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1"
                          style={{ borderColor: '#CBD5E1', color: '#0F172A' }} />
                        <button onClick={() => applyFull(inv)} className="px-3 py-2 text-xs font-medium rounded-lg" style={{ background: '#F2F4F6', color: '#0F2D5C' }}>Full</button>
                        <button onClick={() => clearInvoice(inv.invoice_id)} className="px-3 py-2 text-xs font-medium rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>Clear</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Submit bar */}
        <div className="sticky bottom-2 md:bottom-4 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)', boxShadow: '0 10px 30px rgba(15, 45, 92, 0.35)' }}>
          <div className="text-white">
            <p className="text-[11px] uppercase tracking-wider opacity-80">Total to Apply</p>
            <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif' }}>{money(totalApplied)}</p>
          </div>
          <button data-testid="submit-customer-payment-btn" disabled={submitting || !customerId || totalApplied <= 0}
            onClick={handleSubmit}
            className="px-6 py-3 rounded-lg font-semibold bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: '#0F2D5C' }}>
            {submitting ? 'Recording...' : success ? 'Recorded!' : 'Record Payment'}
          </button>
        </div>

        {success && (
          <div className="flex items-center gap-2 text-sm p-3 rounded-lg" style={{ background: '#ECFDF5', color: '#047857' }}>
            <CheckCircle size={18} weight="fill" /> Payment recorded. Redirecting...
          </div>
        )}
      </div>
    </AppShell>
  );
}
