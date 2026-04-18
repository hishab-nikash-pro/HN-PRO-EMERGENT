import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getInventoryItem, adjustStock } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, Package, ArrowDown, ArrowUp, Warning } from '@phosphor-icons/react';

export default function InventoryDetail() {
  const { itemId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjForm, setAdjForm] = useState({ adjustment_type: 'receive', quantity: 0, reason: '', reference: '' });

  useEffect(() => {
    if (!selectedCompany || !itemId) return;
    getInventoryItem(selectedCompany.company_id, itemId)
      .then(res => setItem(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, itemId]);

  const handleAdjust = async () => {
    if (!adjForm.quantity) return;
    try {
      const res = await adjustStock(selectedCompany.company_id, itemId, adjForm);
      setItem(res.data);
      setShowAdjust(false);
      setAdjForm({ adjustment_type: 'receive', quantity: 0, reason: '', reference: '' });
    } catch (err) { console.error(err); }
  };

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0037B0', borderTopColor: 'transparent' }} /></div></AppShell>;
  if (!item) return <AppShell><div className="text-center py-12" style={{ color: '#434655' }}>Item not found</div></AppShell>;

  const isLow = item.stock_on_hand <= item.reorder_point;

  return (
    <AppShell>
      <div data-testid="inventory-detail-page" className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/inventory')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{item.product_name}</h1>
                {isLow && <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: '#fef2f2', color: '#BA1A1A' }}>Low Stock</span>}
              </div>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{item.sku} — {item.category}</p>
            </div>
          </div>
          <button data-testid="adjust-stock-btn" onClick={() => setShowAdjust(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #0037B0, #1D4ED8)' }}>
            <Package size={16} /> Adjust Stock
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stock Info */}
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Stock Summary</h3>
              <div className="space-y-4">
                {[
                  { label: 'On Hand', value: `${item.stock_on_hand} ${item.unit}`, color: isLow ? '#BA1A1A' : '#191C1E' },
                  { label: 'Reserved', value: `${item.reserved_stock} ${item.unit}`, color: '#434655' },
                  { label: 'Available', value: `${item.available_stock} ${item.unit}`, color: '#0037B0' },
                  { label: 'Reorder Point', value: `${item.reorder_point} ${item.unit}`, color: '#434655' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span style={{ color: '#434655' }}>{label}</span>
                    <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color }}>{value}</span>
                  </div>
                ))}
              </div>
              {isLow && (
                <div className="mt-4 p-3 rounded-lg flex items-center gap-2" style={{ background: '#fef2f2' }}>
                  <Warning size={16} style={{ color: '#BA1A1A' }} />
                  <span className="text-xs font-medium" style={{ color: '#BA1A1A' }}>Stock below reorder point</span>
                </div>
              )}
            </div>
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Pricing</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span style={{ color: '#434655' }}>Unit Cost</span><span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${item.unit_cost?.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: '#434655' }}>Sales Price</span><span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${item.sales_price?.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: '#434655' }}>Margin</span><span className="font-semibold tabular-nums" style={{ color: '#16a34a' }}>{(((item.sales_price - item.unit_cost) / item.sales_price) * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between text-sm pt-3" style={{ borderTop: '1px solid #E6E8EA' }}>
                  <span className="font-semibold" style={{ color: '#191C1E' }}>Total Value</span>
                  <span className="font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${item.inventory_value?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Movement History */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
                <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Movement History</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Type</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Quantity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Reason</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.movement_history || []).length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-sm" style={{ color: '#434655' }}>No movements recorded</td></tr>
                  ) : [...(item.movement_history || [])].reverse().map((m, i) => (
                    <tr key={m.movement_id || i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{m.date?.split('T')[0]}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {m.type === 'receive' || m.type === 'return' ? <ArrowDown size={14} style={{ color: '#16a34a' }} /> : <ArrowUp size={14} style={{ color: '#BA1A1A' }} />}
                          <span className="capitalize font-medium" style={{ color: m.type === 'receive' || m.type === 'return' ? '#16a34a' : '#BA1A1A' }}>{m.type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{m.quantity} {item.unit}</td>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{m.reason || '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{m.reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Adjust Stock Modal */}
        {showAdjust && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Adjust Stock</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Type</label>
                  <select data-testid="adjust-type" value={adjForm.adjustment_type} onChange={(e) => setAdjForm({ ...adjForm, adjustment_type: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                    <option value="receive">Receive Stock</option>
                    <option value="ship">Ship / Sell</option>
                    <option value="damage">Mark Damaged</option>
                    <option value="return">Customer Return</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Quantity</label>
                  <input data-testid="adjust-quantity" type="number" value={adjForm.quantity}
                    onChange={(e) => setAdjForm({ ...adjForm, quantity: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Reason</label>
                  <input type="text" value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                    placeholder="Reason for adjustment" className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Reference</label>
                  <input type="text" value={adjForm.reference} onChange={(e) => setAdjForm({ ...adjForm, reference: e.target.value })}
                    placeholder="PO#, DO#..." className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowAdjust(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button data-testid="submit-adjust-btn" onClick={handleAdjust} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0037B0, #1D4ED8)' }}>
                  Adjust Stock
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
