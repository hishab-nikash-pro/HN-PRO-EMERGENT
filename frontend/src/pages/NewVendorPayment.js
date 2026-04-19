import { useEffect, useMemo, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getVendors, getBills, payVendorBulk } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from '@phosphor-icons/react';

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'Check', 'Credit Card', 'ACH', 'Wire', 'Other'];
const money = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NewVendorPayment() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [bills, setBills] = useState([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('Bank Transfer');
  const [reference, setReference] = useState('');
  const [paidFrom, setPaidFrom] = useState('Operating Account');
  const [amountsByBill, setAmountsByBill] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!selectedCompany) return;
    getVendors(selectedCompany.company_id).then(r => setVendors(r.data || []));
  }, [selectedCompany]);

  useEffect(() => {
    if (!selectedCompany || !vendorId) { setBills([]); setAmountsByBill({}); return; }
    getBills(selectedCompany.company_id).then(r => {
      const open = (r.data || []).filter(b => b.vendor_id === vendorId && (b.balance_due || 0) > 0);
      open.sort((a, b) => (a.bill_date || a.issue_date || '').localeCompare(b.bill_date || b.issue_date || ''));
      setBills(open);
      setAmountsByBill({});
    });
  }, [vendorId, selectedCompany]);

  const totalApplied = useMemo(() => Object.values(amountsByBill).reduce((s, a) => s + (Number(a) || 0), 0), [amountsByBill]);
  const selectedVendor = vendors.find(v => v.vendor_id === vendorId);

  const handleAmount = (billId, val, max) => {
    const n = Math.max(0, Math.min(Number(val) || 0, max));
    setAmountsByBill(prev => ({ ...prev, [billId]: n }));
  };

  const applyFull = (bill) => handleAmount(bill.bill_id, bill.balance_due, bill.balance_due);
  const clearBill = (billId) => setAmountsByBill(prev => ({ ...prev, [billId]: 0 }));

  const autoApply = (total) => {
    let remaining = Number(total) || 0;
    const next = {};
    for (const b of bills) {
      if (remaining <= 0) { next[b.bill_id] = 0; continue; }
      const take = Math.min(remaining, b.balance_due || 0);
      next[b.bill_id] = take;
      remaining -= take;
    }
    setAmountsByBill(next);
  };

  const handleSubmit = async () => {
    if (!selectedCompany || !vendorId || totalApplied <= 0) return;
    setSubmitting(true);
    try {
      const applications = Object.entries(amountsByBill)
        .filter(([, amt]) => Number(amt) > 0)
        .map(([bill_id, amount]) => ({ bill_id, amount: Number(amount) }));
      await payVendorBulk(selectedCompany.company_id, {
        vendor_id: vendorId, payment_date: paymentDate, payment_method: method,
        reference, paid_from: paidFrom, applications
      });
      setSuccess(true);
      setTimeout(() => navigate('/vendor-payments'), 1200);
    } catch (e) {
      console.error(e);
      alert('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div data-testid="new-vendor-payment-page" className="space-y-5 max-w-5xl mx-auto">
        <button onClick={() => navigate('/vendor-payments')} className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
          <ArrowLeft size={14} /> Back to Payments
        </button>

        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>Pay Vendor</h1>
          <p className="text-sm mt-1" style={{ color: '#475569' }}>Apply a single payment across one or more outstanding bills</p>
        </div>

        <div className="rounded-xl p-4 md:p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Vendor</label>
              <select data-testid="vpayment-vendor-select" value={vendorId} onChange={(e) => setVendorId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }}>
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.name} — Owe {money(v.payable_balance)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Payment Date</label>
              <input data-testid="vpayment-date-input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Payment Method</label>
              <select data-testid="vpayment-method-select" value={method} onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Reference / Check #</label>
              <input data-testid="vpayment-reference-input" type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional"
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Paid From</label>
              <input data-testid="vpayment-paidfrom-input" type="text" value={paidFrom} onChange={(e) => setPaidFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
            </div>
          </div>
        </div>

        {vendorId && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" style={{ borderBottom: '1px solid #F2F4F6' }}>
              <div>
                <h3 className="font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>Outstanding Bills {selectedVendor ? `— ${selectedVendor.name}` : ''}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{bills.length} open bill(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <input data-testid="vauto-apply-input" type="number" step="0.01" min="0" placeholder="Auto-apply amount"
                  onKeyDown={(e) => { if (e.key === 'Enter') { autoApply(e.target.value); e.target.value = ''; } }}
                  className="px-3 py-2 text-sm rounded-lg w-40 focus:outline-none focus:ring-1"
                  style={{ background: '#F7F9FB', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
                <button data-testid="vauto-apply-btn" onClick={() => { const el = document.querySelector('[data-testid="vauto-apply-input"]'); if (el) { autoApply(el.value); el.value=''; } }} className="px-3 py-2 text-xs font-medium rounded-lg" style={{ background: '#F2F4F6', color: '#0F2D5C' }}>Apply</button>
              </div>
            </div>

            {bills.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: '#475569' }}>No outstanding bills for this vendor.</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #CBD5E1' }}>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Bill</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Due</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Total</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Balance</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Pay</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b, i) => (
                        <tr key={b.bill_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                          <td className="px-4 py-3 font-medium" style={{ color: '#0E7490' }}>{b.bill_number || b.reference_number || b.bill_id?.slice(-6)}</td>
                          <td className="px-4 py-3" style={{ color: '#475569' }}>{b.bill_date || b.issue_date || '—'}</td>
                          <td className="px-4 py-3" style={{ color: '#475569' }}>{b.due_date || '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>{money(b.total)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#B91C1C' }}>{money(b.balance_due)}</td>
                          <td className="px-4 py-3 text-right">
                            <input data-testid={`vpay-amount-${b.bill_id}`} type="number" step="0.01" min="0" max={b.balance_due}
                              value={amountsByBill[b.bill_id] || ''}
                              onChange={(e) => handleAmount(b.bill_id, e.target.value, b.balance_due)}
                              className="w-28 px-2 py-1 text-sm text-right rounded border focus:outline-none focus:ring-1"
                              style={{ borderColor: '#CBD5E1', color: '#0F172A' }} />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => applyFull(b)} className="text-xs font-medium px-2 py-1 rounded" style={{ background: '#F2F4F6', color: '#0F2D5C' }}>Full</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y" style={{ borderColor: '#F2F4F6' }}>
                  {bills.map(b => (
                    <div key={b.bill_id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#0E7490' }}>{b.bill_number || b.reference_number || b.bill_id?.slice(-6)}</p>
                          <p className="text-xs" style={{ color: '#475569' }}>Due {b.due_date || b.bill_date || '—'}</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#B91C1C' }}>{money(b.balance_due)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input data-testid={`vpay-amount-m-${b.bill_id}`} type="number" step="0.01" min="0" max={b.balance_due}
                          value={amountsByBill[b.bill_id] || ''}
                          onChange={(e) => handleAmount(b.bill_id, e.target.value, b.balance_due)}
                          placeholder="Pay amount"
                          className="flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1"
                          style={{ borderColor: '#CBD5E1', color: '#0F172A' }} />
                        <button onClick={() => applyFull(b)} className="px-3 py-2 text-xs font-medium rounded-lg" style={{ background: '#F2F4F6', color: '#0F2D5C' }}>Full</button>
                        <button onClick={() => clearBill(b.bill_id)} className="px-3 py-2 text-xs font-medium rounded-lg" style={{ background: '#FEF2F2', color: '#B91C1C' }}>Clear</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="sticky bottom-2 md:bottom-4 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)', boxShadow: '0 10px 30px rgba(15, 45, 92, 0.35)' }}>
          <div className="text-white">
            <p className="text-[11px] uppercase tracking-wider opacity-80">Total to Pay</p>
            <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif' }}>{money(totalApplied)}</p>
          </div>
          <button data-testid="submit-vendor-payment-btn" disabled={submitting || !vendorId || totalApplied <= 0}
            onClick={handleSubmit}
            className="px-6 py-3 rounded-lg font-semibold bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: '#0F2D5C' }}>
            {submitting ? 'Recording...' : success ? 'Recorded!' : 'Pay Vendor'}
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
