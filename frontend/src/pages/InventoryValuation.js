import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getInventoryValuation } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Warning } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0F2D5C', '#0E7490', '#0E7490', '#7F2500', '#BA1A1A', '#16a34a', '#434655'];

export default function InventoryValuation() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    getInventoryValuation(selectedCompany.company_id)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;

  const d = data || {};

  return (
    <AppShell>
      <div data-testid="inventory-valuation-page" className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/inventory')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Inventory Valuation</h1>
            <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{selectedCompany?.name}</p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Inventory Value</p>
            <p className="text-3xl font-bold mt-2 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>
              ${(d.total_value || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total SKUs</p>
            <p className="text-3xl font-bold mt-2" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{d.item_count || 0}</p>
          </div>
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Low Stock Items</p>
            <p className="text-3xl font-bold mt-2" style={{ fontFamily: 'Manrope, sans-serif', color: (d.low_stock_items?.length || 0) > 0 ? '#BA1A1A' : '#16a34a' }}>
              {d.low_stock_items?.length || 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown Chart */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Value by Category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.category_breakdown || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E6E8EA', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`$${value.toLocaleString()}`, 'Value']} />
                  <Bar dataKey="value" fill="#0F2D5C" radius={[0, 6, 6, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top High-Value Items */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Top High-Value Items</h3>
            <div className="space-y-3">
              {(d.top_items || []).slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F2F4F6' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{item.product_name}</p>
                    <p className="text-xs" style={{ color: '#434655' }}>{item.sku} — {item.stock} units</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    ${(item.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {(d.low_stock_items || []).length > 0 && (
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Warning size={18} style={{ color: '#BA1A1A' }} />
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>Low Stock Alerts</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(d.low_stock_items || []).map((item, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: '#fef2f2' }}>
                  <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{item.product_name}</p>
                  <div className="flex justify-between mt-1 text-xs">
                    <span style={{ color: '#434655' }}>{item.sku}</span>
                    <span className="font-semibold" style={{ color: '#BA1A1A' }}>{item.stock} / {item.reorder_point}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
