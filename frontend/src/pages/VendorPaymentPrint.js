import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { getVendorPayment } from '../lib/api';
import { ArrowLeft, Printer } from '@phosphor-icons/react';

export default function VendorPaymentPrint() {
  const { paymentId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    if (!selectedCompany || !paymentId) return;
    getVendorPayment(selectedCompany.company_id, paymentId).then((res) => setPayment(res.data));
  }, [selectedCompany, paymentId]);

  if (!payment) {
    return <AppShell><div className="py-16 text-center text-sm" style={{ color: '#64748B' }}>Loading payment voucher...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/vendor-payments')} className="flex items-center gap-2 text-sm" style={{ color: '#475569' }}>
            <ArrowLeft size={16} />
            Back to Vendor Payments
          </button>
          <button onClick={() => window.print()} className="px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            <Printer size={16} className="inline mr-1" />
            Print Voucher
          </button>
        </div>

        <div className="rounded-3xl p-6 md:p-8" style={{ background: '#FFFFFF', boxShadow: '0 10px 35px rgba(15,45,92,0.08)' }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4" style={{ borderBottom: '1px solid #E6E8EA', paddingBottom: '1.25rem' }}>
            <div>
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: '#0E7490' }}>Vendor Payment Voucher</p>
              <h1 className="text-3xl font-bold mt-2" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Hishab Nikash Pro</h1>
              <p className="text-sm mt-2" style={{ color: '#475569' }}>{selectedCompany?.name}</p>
            </div>
            <div className="text-sm space-y-1" style={{ color: '#475569' }}>
              <p><strong>Payment ID:</strong> {payment.payment_id}</p>
              <p><strong>Date:</strong> {payment.payment_date || '—'}</p>
              <p><strong>Method:</strong> {payment.payment_method || '—'}</p>
              <p><strong>Reference:</strong> {payment.reference || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Panel title="Pay To">
              <Line label="Vendor" value={payment.vendor_name} />
              <Line label="Bill" value={payment.bill_number} />
            </Panel>
            <Panel title="Check / Bank Details">
              <Line label="Bank Account" value={payment.bank_account_name || payment.paid_from} />
              <Line label="Check Number" value={payment.check_number || '—'} />
              <Line label="Check Date" value={payment.check_date || payment.payment_date || '—'} />
            </Panel>
          </div>

          <div className="rounded-2xl p-5 mt-6" style={{ background: '#F7F9FB' }}>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: '#64748B' }}>Payment Amount</span>
              <span className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>${Number(payment.amount || 0).toFixed(2)}</span>
            </div>
            {payment.memo && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider" style={{ color: '#64748B' }}>Memo</p>
                <p className="text-sm mt-1" style={{ color: '#191C1E' }}>{payment.memo}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: '#191C1E' }}>{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span style={{ color: '#64748B' }}>{label}</span>
      <span style={{ color: '#191C1E' }}>{value || '—'}</span>
    </div>
  );
}
