import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getPayables } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowRight } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function AccountsPayable() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    getPayables(selectedCompany.company_id)
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
      <div data-testid="accounts-payable-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Accounts Payable</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Track vendor payments and outstanding bills</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
            style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>
            <Printer size={16} /> Print Statement
          </button>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Payable</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>
              ${(d.total_payable || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Expenses</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              ${(d.total_expenses || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Vendors with Balance</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              {(d.vendor_balances || []).length}
            </p>
          </div>
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

          {/* Vendor Balances */}
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Vendor Balances</h3>
              <button onClick={() => navigate('/vendors')} className="text-xs font-medium flex items-center gap-1" style={{ color: '#0037B0' }}>
                View All <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {(d.vendor_balances || []).map((v, i) => (
                <div key={v.vendor_id || i}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer hover:bg-[#F7F9FB] transition-colors"
                  onClick={() => navigate(`/vendors/${v.vendor_id}`)}
                  style={{ borderBottom: '1px solid #F2F4F6' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: '#0037B0' }}>
                      {v.name?.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-medium" style={{ color: '#191C1E' }}>{v.name}</span>
                      <p className="text-xs" style={{ color: '#434655' }}>{v.bill_count} bills</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>
                    ${(v.payable_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Recent Expenses</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Vendor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(d.recent_expenses || []).map((e, i) => (
                <tr key={e.expense_id || i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                  <td className="px-4 py-3" style={{ color: '#434655' }}>{e.expense_date}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{e.vendor_name || '—'}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: '#434655' }}>{e.category}</span></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    ${(e.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
