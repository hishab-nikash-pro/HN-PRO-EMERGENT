import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getReceivables } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { CurrencyDollar, EnvelopeSimple, Printer, ArrowRight } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function AccountsReceivable() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    getReceivables(selectedCompany.company_id)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0037B0', borderTopColor: 'transparent' }} /></div></AppShell>;

  const d = data || {};
  const agingData = [
    { label: 'Current', value: d.aging?.current || 0, color: '#16a34a' },
    { label: '1-30 Days', value: d.aging?.['1_30'] || 0, color: '#0037B0' },
    { label: '31-60 Days', value: d.aging?.['31_60'] || 0, color: '#4D5B94' },
    { label: '61-90 Days', value: d.aging?.['61_90'] || 0, color: '#7F2500' },
    { label: '90+ Days', value: d.aging?.over_90 || 0, color: '#BA1A1A' },
  ];

  return (
    <AppShell>
      <div data-testid="accounts-receivable-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Accounts Receivable</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Track customer balances and collections</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
              style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>
              <Printer size={16} /> Print Statement
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Receivable</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#7F2500' }}>
              ${(d.total_receivable || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
          </div>
          {agingData.map(a => (
            <div key={a.label} className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>{a.label}</p>
              <p className="text-xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: a.color }}>
                ${a.value.toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Aging Chart */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Aging Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#434655' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E6E8EA', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {agingData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Customer Balances */}
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Customer Balances</h3>
              <button onClick={() => navigate('/customers')} className="text-xs font-medium flex items-center gap-1" style={{ color: '#0037B0' }}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {(d.customer_balances || []).map((c, i) => (
                <div key={c.customer_id || i}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer hover:bg-[#F7F9FB] transition-colors"
                  onClick={() => navigate(`/customers/${c.customer_id}`)}
                  style={{ borderBottom: '1px solid #F2F4F6' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: '#4D5B94' }}>
                      {c.name?.charAt(0)}
                    </div>
                    <span className="text-sm font-medium" style={{ color: '#191C1E' }}>{c.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#7F2500' }}>
                    ${(c.open_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              {(d.customer_balances || []).length === 0 && (
                <p className="text-center py-6 text-sm" style={{ color: '#434655' }}>No outstanding balances</p>
              )}
            </div>
          </div>
        </div>

        {/* Open Invoices */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Open Invoices ({(d.open_invoices || []).length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Days Overdue</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {(d.open_invoices || []).slice(0, 15).map((inv, i) => (
                <tr key={inv.invoice_id || i}
                  onClick={() => navigate(`/sales/${inv.invoice_id}`)}
                  className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                  style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#0037B0' }}>{inv.invoice_number}</td>
                  <td className="px-4 py-3" style={{ color: '#191C1E' }}>{inv.customer_name}</td>
                  <td className="px-4 py-3" style={{ color: '#434655' }}>{inv.due_date}</td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: inv.days_overdue > 0 ? '#BA1A1A' : '#16a34a' }}>
                    {inv.days_overdue > 0 ? `${inv.days_overdue} days` : 'Current'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    ${(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#7F2500' }}>
                    ${(inv.balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
