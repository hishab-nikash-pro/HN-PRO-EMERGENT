import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getInvoice, updateInvoice, recordPayment } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, Printer, Copy, CurrencyDollar, Check, X } from '@phosphor-icons/react';

const STATUS_STYLES = {
  Draft: { bg: '#F2F4F6', color: '#434655' },
  Sent: { bg: '#dbeafe', color: '#0F2D5C' },
  'Partial Paid': { bg: '#fef3c7', color: '#92400e' },
  Paid: { bg: '#dcfce7', color: '#16a34a' },
  Overdue: { bg: '#fef2f2', color: '#BA1A1A' },
  Cancelled: { bg: '#F2F4F6', color: '#434655' },
};

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_method: 'Bank Transfer', reference: '', memo: '' });

  useEffect(() => {
    if (!selectedCompany || !invoiceId) return;
    const load = async () => {
      try {
        const res = await getInvoice(selectedCompany.company_id, invoiceId);
        setInvoice(res.data);
        setPaymentForm(prev => ({ ...prev, amount: res.data.balance_due || 0 }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompany, invoiceId]);

  const handleMarkPaid = async () => {
    try {
      await updateInvoice(selectedCompany.company_id, invoiceId, { status: 'Paid', payment_status: 'Paid', amount_paid: invoice.total });
      const res = await getInvoice(selectedCompany.company_id, invoiceId);
      setInvoice(res.data);
    } catch (err) { console.error(err); }
  };

  const handleRecordPayment = async () => {
    try {
      const res = await recordPayment(selectedCompany.company_id, invoiceId, paymentForm);
      setInvoice(res.data);
      setShowPaymentModal(false);
    } catch (err) { console.error(err); }
  };

  const handleCancel = async () => {
    try {
      await updateInvoice(selectedCompany.company_id, invoiceId, { status: 'Cancelled' });
      const res = await getInvoice(selectedCompany.company_id, invoiceId);
      setInvoice(res.data);
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    );
  }

  if (!invoice) {
    return <AppShell><div className="text-center py-12" style={{ color: '#434655' }}>Invoice not found</div></AppShell>;
  }

  const ss = STATUS_STYLES[invoice.status] || STATUS_STYLES.Draft;

  return (
    <AppShell>
      <div data-testid="invoice-detail-page" className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/sales')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{invoice.invoice_number}</h1>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: ss.bg, color: ss.color }}>{invoice.status}</span>
              </div>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{invoice.customer_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
              <>
                <button
                  data-testid="record-payment-btn"
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
                  style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
                >
                  <CurrencyDollar size={16} /> Record Payment
                </button>
                <button
                  data-testid="mark-paid-btn"
                  onClick={handleMarkPaid}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: '#16a34a' }}
                >
                  <Check size={16} /> Mark Paid
                </button>
              </>
            )}
            <button onClick={() => navigate(`/sales/${invoiceId}/print`)} data-testid="print-invoice-btn" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]" style={{ color: '#434655', boxShadow: '0 0 0 1px #C4C5D7' }}><Printer size={16} /> Print</button>
            <button onClick={() => navigate(`/sales/${invoiceId}/packing-list`)} data-testid="packing-list-btn" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]" style={{ color: '#434655', boxShadow: '0 0 0 1px #C4C5D7' }}><Copy size={16} /> Packing List</button>
            {invoice.status !== 'Cancelled' && invoice.status !== 'Paid' && (
              <button onClick={handleCancel} className="p-2 rounded-lg hover:bg-[#fef2f2] transition-colors" style={{ color: '#BA1A1A' }}><X size={18} /></button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Details */}
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Invoice Date</p>
                  <p className="text-sm font-medium mt-1" style={{ color: '#191C1E' }}>{invoice.invoice_date}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Due Date</p>
                  <p className="text-sm font-medium mt-1" style={{ color: '#191C1E' }}>{invoice.due_date}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Sales Rep</p>
                  <p className="text-sm font-medium mt-1" style={{ color: '#191C1E' }}>{invoice.sales_rep || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Warehouse</p>
                  <p className="text-sm font-medium mt-1" style={{ color: '#191C1E' }}>{invoice.warehouse || '—'}</p>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Qty</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items || []).map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F2F4F6' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{item.product}</td>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{item.description}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#191C1E' }}>{item.quantity} {item.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(item.rate || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(item.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-4 space-y-2" style={{ borderTop: '1px solid #E6E8EA' }}>
                <div className="flex justify-between text-sm"><span style={{ color: '#434655' }}>Subtotal</span><span className="tabular-nums font-medium" style={{ fontFamily: 'Manrope, sans-serif' }}>${(invoice.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: '#434655' }}>Tax</span><span className="tabular-nums font-medium" style={{ fontFamily: 'Manrope, sans-serif' }}>${(invoice.tax_total || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: '1px solid #E6E8EA' }}>
                  <span style={{ color: '#191C1E' }}>Total</span>
                  <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(invoice.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Payment History</h3>
                <div className="space-y-3">
                  {invoice.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F2F4F6' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{p.payment_method}</p>
                        <p className="text-xs" style={{ color: '#434655' }}>{p.payment_date} {p.reference && `• ${p.reference}`}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#16a34a' }}>
                        +${(p.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Payment Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span style={{ color: '#434655' }}>Total</span><span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif' }}>${(invoice.total || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: '#434655' }}>Paid</span><span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#16a34a' }}>${(invoice.amount_paid || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-bold pt-3" style={{ borderTop: '1px solid #E6E8EA' }}>
                  <span style={{ color: '#191C1E' }}>Balance Due</span>
                  <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: invoice.balance_due > 0 ? '#7F2500' : '#16a34a' }}>
                    ${(invoice.balance_due || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Terms & Notes</h3>
              <p className="text-sm" style={{ color: '#434655' }}>{invoice.terms || 'Net 30'}</p>
              {invoice.notes && <p className="text-sm mt-2" style={{ color: '#434655' }}>{invoice.notes}</p>}
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Record Payment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Amount</label>
                  <input data-testid="payment-amount" type="number" step="0.01" value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Date</label>
                  <input type="date" value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Method</label>
                  <select value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                    <option>Bank Transfer</option><option>Check</option><option>Cash</option><option>Credit Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Reference</label>
                  <input type="text" value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    placeholder="Check #, Ref #..."
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button data-testid="submit-payment-btn" onClick={handleRecordPayment} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
