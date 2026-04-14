import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getInventory } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, Export, ChartBar } from '@phosphor-icons/react';

export default function InventoryList() {
  const { selectedCompany } = useCompany();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    setLoading(true);
    getInventory(selectedCompany.company_id, categoryFilter || undefined)
      .then(res => setItems(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, categoryFilter]);

  const filtered = items.filter(it =>
    it.product_name?.toLowerCase().includes(search.toLowerCase()) ||
    it.sku?.toLowerCase().includes(search.toLowerCase()) ||
    it.category?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered.reduce((s, i) => s + (i.inventory_value || 0), 0);
  const totalItems = filtered.reduce((s, i) => s + (i.stock_on_hand || 0), 0);
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  const lowStockCount = filtered.filter(i => i.stock_on_hand <= i.reorder_point).length;

  return (
    <AppShell>
      <div data-testid="inventory-list-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Inventory</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Track stock levels across warehouses</p>
          </div>
          <div className="flex items-center gap-2">
            <button data-testid="inventory-valuation-btn" onClick={() => navigate('/inventory/valuation')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
              style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>
              <ChartBar size={16} /> Valuation
            </button>
            <button data-testid="add-inventory-btn" onClick={() => {}}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #0037B0, #1D4ED8)' }}>
              <Plus size={16} weight="bold" /> Add Item
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Inventory Value', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#0037B0' },
            { label: 'Total Items in Stock', value: totalItems.toLocaleString(), color: '#4D5B94' },
            { label: 'Product SKUs', value: filtered.length, color: '#191C1E' },
            { label: 'Low Stock Alerts', value: lowStockCount, color: lowStockCount > 0 ? '#BA1A1A' : '#16a34a' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>{label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
            <input data-testid="inventory-search" type="text" placeholder="Search by SKU or product..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
          </div>
          <select data-testid="inventory-category-filter" value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
            style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><Export size={18} /></button>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0037B0', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Warehouse</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>On Hand</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Available</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Unit Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No inventory items found</td></tr>
                ) : filtered.map((item, i) => {
                  const isLow = item.stock_on_hand <= item.reorder_point;
                  return (
                    <tr key={item.item_id} data-testid={`inventory-row-${item.item_id}`}
                      onClick={() => navigate(`/inventory/${item.item_id}`)}
                      className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                      style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#0037B0' }}>{item.sku}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{item.product_name}</td>
                      <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: '#434655' }}>{item.category}</span></td>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{item.warehouse}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: isLow ? '#BA1A1A' : '#191C1E' }}>
                        {item.stock_on_hand} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#191C1E' }}>{item.available_stock} {item.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(item.unit_cost || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                        ${(item.inventory_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: isLow ? '#fef2f2' : '#dcfce7', color: isLow ? '#BA1A1A' : '#16a34a' }}>
                          {isLow ? 'Low Stock' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
