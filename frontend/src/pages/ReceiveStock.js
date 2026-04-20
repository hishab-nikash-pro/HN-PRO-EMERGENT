import { useEffect, useMemo, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getStockReceipts, createStockReceipt, getVendors, getInventory } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Plus, Trash, X, CheckCircle, Warning } from '@phosphor-icons/react';

const money = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyRow = () => ({ item_id: '', product_name: '', quantity: '', unit_cost: '' });
const emptyForm = () => ({
  vendor_id: '',
  vendor_name: '',
  reference: '',
  receive_date: new Date().toISOString().split('T')[0],
  items: [emptyRow()],
  notes: '',
  total_cost: 0,
});

export default function ReceiveStock() {
  const { selectedCompany } = useCompany();
  const [receipts, setReceipts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const load = () => {
    if (!selectedCompany) return;
    setLoading(true);
    Promise.all([
      getStockReceipts(selectedCompany.company_id),
      getVendors(selectedCompany.company_id),
      getInventory(selectedCompany.company_id),
    ])
      .then(([r, v, i]) => { setReceipts(r.data || []); setVendors(v.data || []); setInventory(i.data || []); })
      .catch((e) => { console.error(e); setError('Failed to load stock data'); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany]);

  const totalCost = useMemo(() => {
    return form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0);
  }, [form.items]);

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'item_id') {
      const inv = inventory.find((i) => i.item_id === value);
      if (inv) {
        items[idx].product_name = inv.product_name;
        // Auto-fill unit cost from inventory if empty
        if (!items[idx].unit_cost && inv.unit_cost) {
          items[idx].unit_cost = inv.unit_cost;
        }
      } else {
        items[idx].product_name = '';
      }
    }
    setForm({ ...form, items });
  };

  const addRow = () => setForm({ ...form, items: [...form.items, emptyRow()] });
  const removeRow = (idx) => {
    const items = form.items.filter((_, i) => i !== idx);
    setForm({ ...form, items: items.length ? items : [emptyRow()] });
  };

  const validItems = form.items.filter((i) => i.item_id && Number(i.quantity) > 0);
  const hasInvalidRow = form.items.some((i) => (i.item_id && Number(i.quantity) <= 0) || (!i.item_id && (i.quantity || i.unit_cost)));
  const canSave = form.vendor_id && validItems.length > 0 && !saving;

  const resetForm = () => setForm(emptyForm());

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        items: validItems.map((i) => ({
          item_id: i.item_id,
          product_name: i.product_name,
          quantity: Number(i.quantity) || 0,
          unit_cost: Number(i.unit_cost) || 0,
        })),
        total_cost: Number(totalCost.toFixed(2)),
      };
      await createStockReceipt(selectedCompany.company_id, payload);
      setShowCreate(false);
      resetForm();
      setSuccessMsg(`Received ${validItems.length} line item(s). Inventory updated.`);
      setTimeout(() => setSuccessMsg(''), 3500);
      load();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail || 'Failed to save receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    resetForm();
    setError('');
    setShowCreate(true);
  };

  return (
    <AppShell>
      <div data-testid="receive-stock-page" className="space-y-5 md:space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>Receive Stock</h1>
            <p className="text-sm mt-1" style={{ color: '#475569' }}>Receive inventory from vendors and auto-update stock levels</p>
          </div>
          <button data-testid="new-stock-receipt-btn" onClick={openNew}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            <Plus size={16} weight="bold" /> Receive Stock
          </button>
        </div>

        {successMsg && (
          <div data-testid="receipt-success-toast" className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: '#ECFDF5', color: '#047857' }}>
            <CheckCircle size={18} weight="fill" /> {successMsg}
          </div>
        )}

        {/* Receipts list */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #CBD5E1' }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Vendor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Reference</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Items</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-sm" style={{ color: '#475569' }}>No stock receipts yet. Click "Receive Stock" to add one.</td></tr>
                    ) : receipts.map((r, i) => (
                      <tr key={r.receipt_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                        <td className="px-4 py-3" style={{ color: '#0F172A' }}>{r.receive_date}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F172A' }}>{r.vendor_name || '—'}</td>
                        <td className="px-4 py-3" style={{ color: '#475569' }}>{r.reference || '—'}</td>
                        <td className="px-4 py-3 text-right" style={{ color: '#0F172A' }}>{(r.items || []).length}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>{money(r.total_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y" style={{ borderColor: '#F2F4F6' }}>
                {receipts.length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: '#475569' }}>No stock receipts yet.</div>
                ) : receipts.map((r) => (
                  <div key={r.receipt_id} className="p-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate" style={{ color: '#0F172A' }}>{r.vendor_name || '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{r.receive_date} • {(r.items || []).length} items{r.reference ? ` • ${r.reference}` : ''}</p>
                    </div>
                    <span className="font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>{money(r.total_cost)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Modal */}
        {showCreate && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start md:items-center justify-center overflow-y-auto p-3 md:p-6" style={{ background: 'rgba(15,23,42,0.5)' }}>
            <div className="rounded-2xl w-full max-w-3xl" style={{ background: '#FFFFFF' }}>
              {/* Header */}
              <div className="flex items-center justify-between p-5 md:p-6" style={{ borderBottom: '1px solid #F2F4F6' }}>
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>Receive Stock</h3>
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Record incoming inventory from a vendor</p>
                </div>
                <button onClick={() => setShowCreate(false)} aria-label="Close" className="p-1.5 rounded-lg" style={{ color: '#475569' }}><X size={18} /></button>
              </div>

              <div className="p-5 md:p-6 space-y-5">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
                    <Warning size={16} weight="fill" /> {error}
                  </div>
                )}

                {/* Header fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>
                      Vendor <span style={{ color: '#B91C1C' }}>*</span>
                    </label>
                    <select data-testid="receipt-vendor-select" value={form.vendor_id}
                      onChange={(e) => { const v = vendors.find(x => x.vendor_id === e.target.value); setForm({ ...form, vendor_id: e.target.value, vendor_name: v?.name || '' }); }}
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                      style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }}>
                      <option value="">Select vendor...</option>
                      {vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Reference / PO #</label>
                    <input data-testid="receipt-reference-input" type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                      style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>
                      Receive Date <span style={{ color: '#B91C1C' }}>*</span>
                    </label>
                    <input data-testid="receipt-date-input" type="date" value={form.receive_date} onChange={(e) => setForm({ ...form, receive_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                      style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Line Items</label>
                    {hasInvalidRow && (
                      <span className="text-[11px] flex items-center gap-1" style={{ color: '#B45309' }}>
                        <Warning size={12} weight="fill" /> Incomplete rows will be skipped
                      </span>
                    )}
                  </div>
                  {/* Desktop header */}
                  <div className="hidden md:grid grid-cols-[1fr_100px_120px_110px_40px] gap-2 px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                    <div>Product</div>
                    <div className="text-right">Cases</div>
                    <div className="text-right">Cost/Case</div>
                    <div className="text-right">Line Total</div>
                    <div></div>
                  </div>
                  <div className="space-y-2">
                    {form.items.map((item, idx) => {
                      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0);
                      return (
                        <div key={idx} data-testid={`receipt-row-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_100px_120px_110px_40px] gap-2 p-2 rounded-lg items-center" style={{ background: idx % 2 === 0 ? '#F7F9FB' : '#FFFFFF' }}>
                          <select data-testid={`receipt-product-${idx}`} value={item.item_id} onChange={(e) => updateItem(idx, 'item_id', e.target.value)}
                            className="px-2 py-2 text-sm rounded-md focus:outline-none focus:ring-1"
                            style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }}>
                            <option value="">Select product...</option>
                            {inventory.map(i => <option key={i.item_id} value={i.item_id}>{i.product_name}</option>)}
                          </select>
                          <div className="grid grid-cols-3 md:contents gap-2">
                            <input data-testid={`receipt-qty-${idx}`} type="number" min="0" step="0.01" value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', e.target.value)} placeholder="Cases"
                              className="px-2 py-2 text-sm rounded-md text-right focus:outline-none focus:ring-1"
                              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
                            <input data-testid={`receipt-cost-${idx}`} type="number" min="0" step="0.01" value={item.unit_cost}
                              onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)} placeholder="Cost per case"
                              className="px-2 py-2 text-sm rounded-md text-right focus:outline-none focus:ring-1"
                              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }} />
                            <div className="px-2 py-2 text-sm font-semibold text-right tabular-nums self-center" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F172A' }}>
                              {money(lineTotal)}
                            </div>
                          </div>
                          <button data-testid={`receipt-remove-${idx}`} onClick={() => removeRow(idx)} aria-label="Remove row"
                            className="justify-self-end md:justify-self-center p-1.5 rounded-md transition-colors hover:bg-red-50"
                            style={{ color: '#B91C1C' }}>
                            <Trash size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button data-testid="receipt-add-row-btn" onClick={addRow} className="mt-3 text-xs font-medium flex items-center gap-1" style={{ color: '#0F2D5C' }}>
                    <Plus size={12} /> Add Line
                  </button>
                </div>

                {/* Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg" style={{ background: '#F7F9FB' }}>
                  <div className="text-xs" style={{ color: '#475569' }}>
                    <span className="font-medium">{validItems.length}</span> valid line item(s)
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '#475569' }}>Total Cost</div>
                    <div data-testid="receipt-total" className="text-xl font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>{money(totalCost)}</div>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-6 flex flex-col-reverse sm:flex-row justify-end gap-2" style={{ borderTop: '1px solid #F2F4F6' }}>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#475569' }}>Cancel</button>
                <button data-testid="save-stock-receipt-btn" onClick={handleSave} disabled={!canSave}
                  className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  {saving ? 'Saving...' : 'Save Receipt'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
