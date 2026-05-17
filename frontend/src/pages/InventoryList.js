import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { deleteInventoryItem, getInventory } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, Export, ChartBar, BellRinging, Trash } from '@phosphor-icons/react';
import { downloadCSV } from '../lib/exportUtils';

export default function InventoryList() {
  const { selectedCompany, can } = useCompany();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [alertSending, setAlertSending] = useState(false);
  const [alertResult, setAlertResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
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
  const totalCases = filtered.reduce((s, i) => s + (i.cases_on_hand || i.stock_on_hand || 0), 0);
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  const lowStockCount = filtered.filter(i => (i.cases_on_hand || i.stock_on_hand || 0) <= (i.reorder_point || 0)).length;
  const exportInventory = () => {
    downloadCSV('inventory.csv', filtered.map((item) => ({
      sku: item.sku || '',
      product_name: item.product_name || '',
      category: item.category || '',
      warehouse: item.warehouse || '',
      cases_on_hand: Number(item.cases_on_hand || item.stock_on_hand || 0).toFixed(1),
      available_cases: Number(item.available_cases || item.available_stock || item.cases_on_hand || item.stock_on_hand || 0).toFixed(1),
      unit_cost: Number(item.unit_cost || 0).toFixed(2),
      inventory_value: Number(item.inventory_value || 0).toFixed(2),
    })), ['sku', 'product_name', 'category', 'warehouse', 'cases_on_hand', 'available_cases', 'unit_cost', 'inventory_value']);
  };

  const reloadInventory = async () => {
    if (!selectedCompany?.company_id) return;
    setLoading(true);
    try {
      const response = await getInventory(selectedCompany.company_id, categoryFilter || undefined);
      setItems(response.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInventoryItem = async () => {
    if (!deleteTarget || !selectedCompany?.company_id) return;
    setDeleting(true);
    try {
      await deleteInventoryItem(selectedCompany.company_id, deleteTarget.item_id);
      await reloadInventory();
      setFeedback({ type: 'success', message: `${deleteTarget.product_name || 'Inventory item'} was moved to deleted records.` });
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Unable to delete this inventory item.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div data-testid="inventory-list-page" className="space-y-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Inventory</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Track stock levels across warehouses</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {lowStockCount > 0 && (
              <button data-testid="send-low-stock-alert" onClick={async () => {
                setAlertSending(true);
                try {
                  const { sendLowStockAlert } = await import('../lib/api');
                  const res = await sendLowStockAlert(selectedCompany.company_id);
                  setAlertResult(res.data);
                  setTimeout(() => setAlertResult(null), 5000);
                } catch (err) { console.error(err); setAlertResult({ status: 'error' }); }
                finally { setAlertSending(false); }
              }}
                disabled={alertSending}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: '#BA1A1A', boxShadow: '0 0 0 1px #BA1A1A', opacity: alertSending ? 0.6 : 1 }}>
                <BellRinging size={16} /> {alertSending ? 'Sending...' : `Alert (${lowStockCount})`}
              </button>
            )}
            <button data-testid="inventory-valuation-btn" onClick={() => navigate('/inventory/valuation')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
              style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>
              <ChartBar size={16} /> Valuation
            </button>
            <button data-testid="add-inventory-btn" onClick={() => navigate('/products')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <Plus size={16} weight="bold" /> Manage Products
            </button>
          </div>
        </div>

        {feedback && (
          <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48' }}>
            {feedback.message}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total Inventory Value', value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, color: '#0F2D5C' },
            { label: 'Total Cases in Stock', value: totalCases.toFixed(1), color: '#0E7490' },
            { label: 'Product SKUs', value: filtered.length, color: '#191C1E' },
            { label: 'Low Stock Alerts', value: lowStockCount, color: lowStockCount > 0 ? '#BA1A1A' : '#16a34a' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>{label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Alert Result */}
        {alertResult && (
          <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: alertResult.status === 'sent' ? '#dcfce7' : alertResult.status === 'no_alerts' ? '#F2F4F6' : '#fef2f2' }}>
            <BellRinging size={16} style={{ color: alertResult.status === 'sent' ? '#16a34a' : '#BA1A1A' }} />
            <span className="text-sm font-medium" style={{ color: alertResult.status === 'sent' ? '#16a34a' : '#434655' }}>
              {alertResult.status === 'sent' ? `Low stock alert sent to ${alertResult.sent_to} for ${alertResult.items_count} items` :
               alertResult.status === 'no_alerts' ? 'All inventory levels are adequate' : 'Failed to send alert'}
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
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
          <button onClick={exportInventory} aria-label="Export inventory" className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><Export size={18} /></button>
        </div>

        {/* Table */}
        <div className="hidden md:block rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Warehouse</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Cases on Hand</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Available Cases</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Unit Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No inventory items found</td></tr>
                ) : filtered.map((item, i) => {
                  const casesOnHand = item.cases_on_hand || item.stock_on_hand || 0;
                  const availableCases = item.available_cases || item.available_stock || casesOnHand;
                  const isLow = casesOnHand <= (item.reorder_point || 0);
                  return (
                    <tr key={item.item_id} data-testid={`inventory-row-${item.item_id}`}
                      onClick={() => navigate(`/inventory/${item.item_id}`)}
                      className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                      style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{item.sku}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{item.product_name}</td>
                      <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: '#434655' }}>{item.category}</span></td>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{item.warehouse}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: isLow ? '#BA1A1A' : '#191C1E' }}>
                        {casesOnHand.toFixed(1)} cases
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#191C1E' }}>{availableCases.toFixed(1)} cases</td>
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
                      <td className="px-4 py-3 text-center">
                        {can.admin ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(item);
                            }}
                            className="rounded-lg p-1.5 hover:bg-[#FEF2F2]"
                            style={{ color: '#B42318' }}
                          >
                            <Trash size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-xl bg-white">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl p-6 text-center text-sm" style={{ background: '#FFFFFF', color: '#434655' }}>No inventory items found</div>
          ) : filtered.map((item) => {
            const casesOnHand = item.cases_on_hand || item.stock_on_hand || 0;
            const availableCases = item.available_cases || item.available_stock || casesOnHand;
            const isLow = casesOnHand <= (item.reorder_point || 0);
            return (
              <button key={item.item_id} onClick={() => navigate(`/inventory/${item.item_id}`)} className="w-full rounded-xl p-4 text-left" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: '#191C1E' }}>{item.product_name}</p>
                    <p className="mt-1 text-sm" style={{ color: '#64748B' }}>{item.sku} • {item.warehouse || 'Warehouse'}</p>
                    <p className="mt-1 text-xs" style={{ color: '#64748B' }}>{casesOnHand.toFixed(1)} on hand • {availableCases.toFixed(1)} available</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: isLow ? '#FEF2F2' : '#DCFCE7', color: isLow ? '#B42318' : '#027A48' }}>
                    {isLow ? 'Low Stock' : 'Active'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span style={{ color: '#64748B' }}>Inventory Value</span>
                  <span className="font-semibold" style={{ color: '#191C1E' }}>${(item.inventory_value || 0).toFixed(2)}</span>
                </div>
                {can.admin && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(item);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: '#FEF2F2', color: '#B42318' }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <ConfirmDeleteModal open={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={handleDeleteInventoryItem} loading={deleting} />
      </div>
    </AppShell>
  );
}
