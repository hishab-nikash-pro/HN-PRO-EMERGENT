import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, DownloadSimple, FileArrowUp, X } from '@phosphor-icons/react';
import ActivityTimeline from '../components/ActivityTimeline';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { approveRecord, convertPurchaseOrderToBill, getPurchaseOrder, getRecordActivity, receivePurchaseOrder, rejectRecord, submitApproval, updatePurchaseOrder } from '../lib/api';

export default function PurchaseOrderDetail() {
  const { purchaseOrderId } = useParams();
  const { selectedCompany, can } = useCompany();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [activity, setActivity] = useState({ activity_timeline: [], approval_history: [] });
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [feedback, setFeedback] = useState(null);

  const load = async () => {
    if (!selectedCompany || !purchaseOrderId) return;
    setLoading(true);
    try {
      const [orderRes, activityRes] = await Promise.all([
        getPurchaseOrder(selectedCompany.company_id, purchaseOrderId),
        getRecordActivity(selectedCompany.company_id, 'purchase_order', purchaseOrderId),
      ]);
      setOrder(orderRes.data);
      setActivity(activityRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompany, purchaseOrderId]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  if (!order) return <AppShell><div className="text-center py-12" style={{ color: '#64748B' }}>Purchase order not found.</div></AppShell>;

  const runAction = async (key, fn, successMessage) => {
    try {
      setActionLoading(key);
      setFeedback(null);
      await fn();
      setNote('');
      setFeedback({ type: 'success', message: successMessage || 'Action completed successfully.' });
      await load();
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'This action could not be completed.' });
    } finally {
      setActionLoading('');
    }
  };

  const approvalStatus = activity.approval_status || order.approval_status || 'Draft';
  const canMarkSent = can.write && order.status === 'Draft';
  const canConvert = can.write && !order.converted_bill_id;
  const canReceive = can.write && order.status !== 'Received';
  const canSubmitApproval = can.write && approvalStatus === 'Draft';
  const canApproveOrReject = can.manage && approvalStatus === 'Submitted';

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl" data-testid="purchase-order-detail-page">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/purchase-orders')} className="p-2 rounded-lg hover:bg-white" style={{ color: '#475569' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{order.purchase_order_number}</h1>
              <p className="text-sm mt-1" style={{ color: '#475569' }}>{order.vendor_name} • {order.status}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canMarkSent && <button disabled={actionLoading === 'sent'} onClick={() => runAction('sent', () => updatePurchaseOrder(selectedCompany.company_id, purchaseOrderId, { status: 'Sent' }), 'Purchase order marked as sent.')} className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #CBD5E1' }}>{actionLoading === 'sent' ? 'Saving...' : 'Mark Sent'}</button>}
            {canConvert && <button disabled={actionLoading === 'convert'} onClick={() => runAction('convert', async () => { await convertPurchaseOrderToBill(selectedCompany.company_id, purchaseOrderId); navigate('/bills'); }, 'Purchase order converted to bill.')} className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>{actionLoading === 'convert' ? 'Converting...' : 'Convert to Bill'}</button>}
            {canReceive && <button disabled={actionLoading === 'receive'} onClick={() => runAction('receive', () => receivePurchaseOrder(selectedCompany.company_id, purchaseOrderId), 'Inventory received from purchase order.')} className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: '#166534' }}><DownloadSimple size={16} className="inline mr-1" /> {actionLoading === 'receive' ? 'Receiving...' : 'Receive Inventory'}</button>}
          </div>
        </div>

        {feedback && (
          <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48' }}>
            {feedback.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Info label="Order Date" value={order.order_date} />
                <Info label="Expected Date" value={order.expected_date || '—'} />
                <Info label="Reference" value={order.reference || '—'} />
                <Info label="Approval" value={approvalStatus} />
              </div>
              {order.delivery_address && <p className="text-sm mt-4" style={{ color: '#475569' }}>{order.delivery_address}</p>}
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Qty</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{item.product_name || '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#475569' }}>{item.description}</td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">${Number(item.rate || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold">${Number(item.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="px-4 py-4 space-y-2">
                <div className="flex justify-between text-sm"><span style={{ color: '#64748B' }}>Subtotal</span><span>${Number(order.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: '#64748B' }}>Tax</span><span>${Number(order.tax_total || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: '1px solid #E2E8F0' }}><span>Total</span><span>${Number(order.total || 0).toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Approval Actions</h3>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Optional approval note" className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1' }} />
              <div className="mt-4 space-y-2">
                {canSubmitApproval && <button disabled={actionLoading === 'submit'} onClick={() => runAction('submit', () => submitApproval(selectedCompany.company_id, 'purchase_order', purchaseOrderId, { note }), 'Purchase order submitted for approval.')} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #CBD5E1' }}><FileArrowUp size={16} /> {actionLoading === 'submit' ? 'Submitting...' : 'Submit for Approval'}</button>}
                {canApproveOrReject && <button disabled={actionLoading === 'approve'} onClick={() => runAction('approve', () => approveRecord(selectedCompany.company_id, 'purchase_order', purchaseOrderId, { note }), 'Purchase order approved.')} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: '#16A34A' }}><Check size={16} /> {actionLoading === 'approve' ? 'Approving...' : 'Approve'}</button>}
                {canApproveOrReject && <button disabled={actionLoading === 'reject'} onClick={() => runAction('reject', () => rejectRecord(selectedCompany.company_id, 'purchase_order', purchaseOrderId, { note }), 'Purchase order rejected.')} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: '#DC2626' }}><X size={16} /> {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}</button>}
              </div>
            </div>
            <ActivityTimeline title="Record Activity" items={activity.activity_timeline || []} />
            <ActivityTimeline title="Approval History" items={activity.approval_history || []} empty="No approval decisions yet." />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-sm font-medium mt-1" style={{ color: '#191C1E' }}>{value}</p>
    </div>
  );
}
