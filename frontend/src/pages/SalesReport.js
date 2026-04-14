import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getSalesReport } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Export, Printer } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function SalesReport() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const navigate = useNavigate();

  const loadData = () => {
    if (!selectedCompany) return;
    setLoading(true);
    getSalesReport(selectedCompany.company_id, startDate || undefined, endDate || undefined)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedCompany]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0037B0', borderTopColor: 'transparent' }} /></div></AppShell>;

  const d = data || {};

  return (
    <AppShell>
      <div data-testid="sales-report-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Sales Report</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{selectedCompany?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Export size={18} /></button>
            <button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Printer size={18} /></button>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#434655' }}>From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#434655' }}>To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
          <div className="pt-5"><button onClick={loadData} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0037B0, #1D4ED8)' }}>Apply</button></div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Sales', value: d.total_sales, color: '#0037B0' },
            { label: 'Collected', value: d.total_collected, color: '#16a34a' },
            { label: 'Invoice Count', value: d.invoice_count, fmt: false, color: '#191C1E' },
            { label: 'Avg Invoice', value: d.average_invoice, color: '#4D5B94' },
          ].map(({ label, value, color, fmt = true }) => (
            <div key={label} className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>{label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color }}>
                {fmt ? `$${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}` : (value || 0)}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Monthly Sales Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.monthly_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#434655' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E6E8EA', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v) => [`$${v.toLocaleString()}`, 'Sales']} />
                  <Bar dataKey="amount" fill="#0037B0" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>By Status</h3>
            <div className="space-y-3">
              {(d.by_status || []).map((s, i) => {
                const colors = { Paid: '#16a34a', Sent: '#0037B0', Draft: '#434655', Overdue: '#BA1A1A', 'Partial Paid': '#92400e', Cancelled: '#434655' };
                return (
                  <div key={s.status} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F2F4F6' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: colors[s.status] || '#434655' }} />
                      <span className="text-sm font-medium" style={{ color: '#191C1E' }}>{s.status}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Customers */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Top Customers</h3>
            <div className="space-y-2">
              {(d.top_customers || []).map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F2F4F6' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: '#434655' }}>{c.invoice_count} invoices</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    ${(c.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Top Products</h3>
            <div className="space-y-2">
              {(d.top_products || []).map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F2F4F6' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{p.product}</p>
                    <p className="text-xs" style={{ color: '#434655' }}>{p.quantity} units sold</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    ${(p.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
