import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getDashboard } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { TrendUp, TrendDown, CurrencyDollar, Wallet, Package, Users, Truck, Receipt, ArrowRight } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';

function KpiCard({ label, value, icon: Icon, trend, color = '#0F2D5C' }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}10` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
        {typeof value === 'number' ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : value}
      </p>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {trend >= 0 ? <TrendUp size={14} style={{ color: '#16a34a' }} /> : <TrendDown size={14} style={{ color: '#BA1A1A' }} />}
          <span className="text-xs font-medium" style={{ color: trend >= 0 ? '#16a34a' : '#BA1A1A' }}>
            {Math.abs(trend)}%
          </span>
          <span className="text-xs" style={{ color: '#434655' }}>vs last month</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    const load = async () => {
      try {
        const res = await getDashboard(selectedCompany.company_id);
        setData(res.data);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompany]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    );
  }

  const d = data || {};

  return (
    <AppShell>
      <div data-testid="dashboard-page" className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>
              {selectedCompany?.name} — Business Overview
            </p>
          </div>
          <div className="text-sm tabular-nums" style={{ color: '#434655' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <KpiCard label="Total Sales" value={d.total_sales || 0} icon={CurrencyDollar} trend={12} color="#0F2D5C" />
          <KpiCard label="Collections" value={d.total_collected || 0} icon={Wallet} trend={8} color="#16a34a" />
          <KpiCard label="Receivables" value={d.outstanding_receivables || 0} icon={Receipt} color="#7F2500" />
          <KpiCard label="Payables" value={d.total_payables || 0} icon={Truck} color="#BA1A1A" />
          <KpiCard label="Inventory Value" value={d.inventory_value || 0} icon={Package} color="#0E7490" />
        </div>

        {/* Second row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Bank/Cash" value={d.bank_cash_balance || 0} icon={Wallet} color="#0F2D5C" />
          <KpiCard label="Monthly Expense" value={d.monthly_expense || 0} icon={Receipt} color="#7F2500" />
          <KpiCard label="Gross Profit" value={d.gross_profit || 0} icon={TrendUp} trend={15} color="#16a34a" />
          <KpiCard label="Net Profit" value={d.net_profit || 0} icon={TrendUp} trend={9} color="#16a34a" />
        </div>

        {/* Charts + Aging */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Trend */}
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Sales Trend</h3>
            <div className="h-64" style={{ minHeight: 240 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <BarChart data={d.sales_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E6E8EA', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`$${value.toLocaleString()}`, 'Sales']}
                  />
                  <Bar dataKey="amount" fill="#0F2D5C" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Receivables Aging */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Receivables Aging</h3>
            <div className="space-y-3">
              {[
                { label: 'Current', key: 'current', color: '#16a34a' },
                { label: '1-30 Days', key: '1_30', color: '#0F2D5C' },
                { label: '31-60 Days', key: '31_60', color: '#0E7490' },
                { label: '61-90 Days', key: '61_90', color: '#7F2500' },
                { label: '90+ Days', key: 'over_90', color: '#BA1A1A' },
              ].map(({ label, key, color }) => {
                const val = d.aging?.[key] || 0;
                const total = Object.values(d.aging || {}).reduce((s, v) => s + v, 0) || 1;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: '#434655' }}>{label}</span>
                      <span className="text-xs font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                        ${val.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F2F4F6' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(val / total) * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Customers + Recent Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Customers */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Top Customers</h3>
              <button onClick={() => navigate('/customers')} className="text-xs font-medium flex items-center gap-1" style={{ color: '#0F2D5C' }}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-3">
              {(d.top_customers || []).map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: i < (d.top_customers?.length || 0) - 1 ? '1px solid #F2F4F6' : 'none' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: '#0E7490' }}>
                      {c.name?.charAt(0)}
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#191C1E' }}>{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: c.balance > 0 ? '#7F2500' : '#191C1E' }}>
                    ${(c.balance || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Recent Invoices</h3>
              <button onClick={() => navigate('/sales')} className="text-xs font-medium flex items-center gap-1" style={{ color: '#0F2D5C' }}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {(d.recent_invoices || []).slice(0, 6).map((inv, i) => (
                <div
                  key={inv.invoice_id || i}
                  className="flex items-center justify-between py-2 cursor-pointer hover:bg-[#F7F9FB] rounded-lg px-2 transition-colors"
                  onClick={() => navigate(`/sales/${inv.invoice_id}`)}
                  style={{ borderBottom: '1px solid #F2F4F6' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{inv.invoice_number}</p>
                    <p className="text-xs" style={{ color: '#434655' }}>{inv.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                      ${(inv.total || 0).toLocaleString()}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: inv.status === 'Paid' ? '#dcfce7' : inv.status === 'Overdue' ? '#fef2f2' : inv.status === 'Draft' ? '#F2F4F6' : '#dbeafe',
                        color: inv.status === 'Paid' ? '#16a34a' : inv.status === 'Overdue' ? '#BA1A1A' : inv.status === 'Draft' ? '#434655' : '#0F2D5C'
                      }}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
