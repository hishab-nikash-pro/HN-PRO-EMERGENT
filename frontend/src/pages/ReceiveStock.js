import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getStockReceipts, createStockReceipt, getVendors, getInventory } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Plus, Trash, Export } from '@phosphor-icons/react';

export default function ReceiveStock() {
  const { selectedCompany } = useCompany();
  const [receipts, setReceipts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ vendor_id: '', vendor_name: '', reference: '', receive_date: new Date().toISOString().split('T')[0], items: [{ item_id: '', product_name: '', quantity: 0, unit_cost: 0 }], notes: '', total_cost: 0 });

  const load = () => { if (!selectedCompany) return; setLoading(true);
    Promise.all([getStockReceipts(selectedCompany.company_id), getVendors(selectedCompany.company_id), getInventory(selectedCompany.company_id)])
      .then(([r, v, i]) => { setReceipts(r.data); setVendors(v.data); setInventory(i.data); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [selectedCompany]);

  const updateItem = (idx, field, value) => {
    const items = [...form.items]; items[idx] = { ...items[idx], [field]: value };
    if (field === 'item_id') { const inv = inventory.find(i => i.item_id === value); if (inv) items[idx].product_name = inv.product_name; }
    const total = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_cost) || 0), 0);
    setForm({ ...form, items, total_cost: total });
  };

  const handleSave = async () => {
    await createStockReceipt(selectedCompany.company_id, form);
    setShowCreate(false); load();
  };

  return (
    <AppShell>
      <div data-testid="receive-stock-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Receive Stock</h1><p className="text-sm mt-1" style={{ color: '#434655' }}>Receive inventory from vendors</p></div>
          <button data-testid="new-stock-receipt-btn" onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0037B0, #1D4ED8)' }}><Plus size={16} weight="bold" /> Receive Stock</button>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0037B0', borderTopColor: 'transparent' }} /></div> : (
            <table className="w-full text-sm">
              <thead><tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Date</th><th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Vendor</th><th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Reference</th><th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Items</th><th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Total Cost</th>
              </tr></thead>
              <tbody>{receipts.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No stock receipts</td></tr> : receipts.map((r, i) => (
                <tr key={r.receipt_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                  <td className="px-4 py-3" style={{ color: '#191C1E' }}>{r.receive_date}</td><td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{r.vendor_name}</td><td className="px-4 py-3" style={{ color: '#434655' }}>{r.reference || '—'}</td><td className="px-4 py-3 text-right" style={{ color: '#191C1E' }}>{(r.items || []).length}</td><td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(r.total_cost || 0).toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        {showCreate && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-2xl" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Receive Stock</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Vendor</label><select value={form.vendor_id} onChange={(e) => { const v = vendors.find(x => x.vendor_id === e.target.value); setForm({ ...form, vendor_id: e.target.value, vendor_name: v?.name || '' }); }} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ boxShadow: '0 0 0 1px #C4C5D7' }}><option value="">Select</option>{vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Reference / PO #</label><input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Date</label><input type="date" value={form.receive_date} onChange={(e) => setForm({ ...form, receive_date: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} /></div>
              </div>
              <div className="space-y-2 mb-4">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                    <select value={item.item_id} onChange={(e) => updateItem(idx, 'item_id', e.target.value)} className="px-2 py-2 text-xs rounded-md" style={{ boxShadow: '0 0 0 1px #C4C5D7' }}><option value="">Product</option>{inventory.map(i => <option key={i.item_id} value={i.item_id}>{i.product_name}</option>)}</select>
                    <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" className="px-2 py-2 text-xs rounded-md text-right" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} />
                    <input type="number" step="0.01" value={item.unit_cost} onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)} placeholder="Unit Cost" className="px-2 py-2 text-xs rounded-md text-right" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} />
                    <div className="text-xs font-semibold text-right tabular-nums">${((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)).toFixed(2)}</div>
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, items: [...form.items, { item_id: '', product_name: '', quantity: 0, unit_cost: 0 }] })} className="text-xs font-medium" style={{ color: '#0037B0' }}><Plus size={12} className="inline" /> Add Line</button>
              </div>
              <div className="text-right text-sm font-bold mb-4">Total: ${form.total_cost.toFixed(2)}</div>
              <div className="flex justify-end gap-2"><button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button><button data-testid="save-stock-receipt-btn" onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0037B0, #1D4ED8)' }}>Save Receipt</button></div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
