import { useEffect, useState } from 'react';
import { ArrowsLeftRight, Plus, Trash } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { useCompany } from '../contexts/CompanyContext';
import { createStockTransfer, deleteStockTransfer, getInventory, getStockTransfers } from '../lib/api';

const warehouses = ['Main Warehouse', 'Cold Storage A', 'Distribution Center'];
const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1';
const inputStyle = { background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#191C1E' };

export default function StockTransfersPage() {
  const { selectedCompany, can } = useCompany();
  const [transfers, setTransfers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({ item_id: '', product_id: '', product_name: '', quantity: 0, unit: 'pcs', source_warehouse: 'Main Warehouse', destination_warehouse: 'Cold Storage A', transfer_date: new Date().toISOString().slice(0, 10), notes: '' });

  const load = async () => {
    if (!selectedCompany?.company_id) return;
    setLoading(true);
    try {
      const [transferRes, inventoryRes] = await Promise.all([
        getStockTransfers(selectedCompany.company_id),
        getInventory(selectedCompany.company_id),
      ]);
      setTransfers(transferRes.data || []);
      setInventory(inventoryRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompany?.company_id]);

  const availableSourceRows = inventory.filter((item) => item.warehouse === form.source_warehouse);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setFeedback(null);
      await createStockTransfer(selectedCompany.company_id, { ...form, quantity: Number(form.quantity) || 0 });
      setShowCreate(false);
      setForm({ item_id: '', product_id: '', product_name: '', quantity: 0, unit: 'pcs', source_warehouse: 'Main Warehouse', destination_warehouse: 'Cold Storage A', transfer_date: new Date().toISOString().slice(0, 10), notes: '' });
      setFeedback({ type: 'success', message: 'Stock transfer created successfully.' });
      await load();
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Unable to save this stock transfer.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !selectedCompany?.company_id) return;
    setDeleting(true);
    try {
      await deleteStockTransfer(selectedCompany.company_id, deleteTarget.transfer_id);
      setDeleteTarget(null);
      setFeedback({ type: 'success', message: 'Stock transfer moved to deleted records.' });
      await load();
    } catch (error) {
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Unable to delete this stock transfer.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6" data-testid="stock-transfers-page">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Stock Transfers</h1>
            <p className="text-sm mt-1" style={{ color: '#475569' }}>Move inventory between freezer and distribution locations.</p>
          </div>
          {can.write && (
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <Plus size={16} />
              New Transfer
            </button>
          )}
        </div>

        {feedback && (
          <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48' }}>
            {feedback.message}
          </div>
        )}

        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex h-44 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #E2E8F0' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#475569' }}>Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#475569' }}>Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#475569' }}>From</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#475569' }}>To</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: '#475569' }}>Qty</th>
                  {can.admin && <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: '#475569' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr><td colSpan={can.admin ? 6 : 5} className="px-4 py-12 text-center" style={{ color: '#64748B' }}>No stock transfers yet.</td></tr>
                ) : transfers.map((transfer, index) => (
                  <tr key={transfer.transfer_id} style={{ borderBottom: '1px solid #F1F5F9', background: index % 2 === 0 ? '#FFFFFF' : '#FCFDFE' }}>
                    <td className="px-4 py-3">{transfer.transfer_date}</td>
                    <td className="px-4 py-3 font-medium">{transfer.product_name}</td>
                    <td className="px-4 py-3">{transfer.source_warehouse}</td>
                    <td className="px-4 py-3">{transfer.destination_warehouse}</td>
                    <td className="px-4 py-3 text-right font-semibold">{transfer.quantity} {transfer.unit}</td>
                    {can.admin && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setDeleteTarget(transfer)} className="rounded-lg p-2 hover:bg-[#FEF2F2]" style={{ color: '#B91C1C' }} title="Delete transfer">
                          <Trash size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="w-full max-w-2xl rounded-3xl p-6" style={{ background: '#FFFFFF' }}>
              <div className="flex items-center gap-2 mb-4">
                <ArrowsLeftRight size={18} style={{ color: '#0E7490' }} />
                <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Create Stock Transfer</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium" style={{ color: '#475569' }}>Source Warehouse</span>
                  <select value={form.source_warehouse} onChange={(e) => setForm((current) => ({ ...current, source_warehouse: e.target.value, item_id: '', product_id: '', product_name: '' }))} className={inputClass} style={inputStyle}>
                    {warehouses.map((warehouse) => <option key={warehouse}>{warehouse}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium" style={{ color: '#475569' }}>Destination Warehouse</span>
                  <select value={form.destination_warehouse} onChange={(e) => setForm((current) => ({ ...current, destination_warehouse: e.target.value }))} className={inputClass} style={inputStyle}>
                    {warehouses.map((warehouse) => <option key={warehouse}>{warehouse}</option>)}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-medium" style={{ color: '#475569' }}>Product</span>
                  <select value={form.item_id} onChange={(e) => {
                    const row = availableSourceRows.find((item) => item.item_id === e.target.value);
                    setForm((current) => ({ ...current, item_id: e.target.value, product_id: row?.product_id || '', product_name: row?.product_name || '', unit: row?.unit || 'pcs' }));
                  }} className={inputClass} style={inputStyle}>
                    <option value="">Select product from source warehouse</option>
                    {availableSourceRows.map((item) => <option key={`${item.item_id}-${item.product_id}`} value={item.item_id}>{item.product_name} ({item.stock_on_hand} on hand)</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium" style={{ color: '#475569' }}>Quantity</span>
                  <input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm((current) => ({ ...current, quantity: e.target.value }))} className={inputClass} style={inputStyle} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium" style={{ color: '#475569' }}>Transfer Date</span>
                  <input type="date" value={form.transfer_date} onChange={(e) => setForm((current) => ({ ...current, transfer_date: e.target.value }))} className={inputClass} style={inputStyle} />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-1.5 block text-xs font-medium" style={{ color: '#475569' }}>Notes</span>
                  <textarea rows={3} value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} className={inputClass} style={inputStyle} />
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ color: '#475569' }}>Cancel</button>
                <button disabled={saving || !form.item_id || !Number(form.quantity)} onClick={handleCreate} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>{saving ? 'Saving...' : 'Save Transfer'}</button>
              </div>
            </div>
          </div>
        )}
        <ConfirmDeleteModal open={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} />
      </div>
    </AppShell>
  );
}
