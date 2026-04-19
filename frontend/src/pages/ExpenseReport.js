import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getExpenseReport } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Export, Printer } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0F2D5C', '#0E7490', '#0E7490', '#7F2500', '#BA1A1A', '#16a34a', '#434655', '#92400e'];

export default function ExpenseReport() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const navigate = useNavigate();

  const loadData = () => {
    if (!selectedCompany) return;
    setLoading(true);
    getExpenseReport(selectedCompany.company_id, startDate || undefined, endDate || undefined)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedCompany]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;

  const d = data || {};

  return (
    <AppShell>
      <div data-testid="expense-report-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Expense Report</h1>
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
          <div className="pt-5"><button onClick={loadData} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Apply</button></div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Expenses</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#7F2500' }}>
              ${(d.total_expenses || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Expense Count</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{d.expense_count || 0}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Average Expense</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              ${(d.average_expense || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>By Category</h3>
            <div className="space-y-3">
              {(d.category_breakdown || []).map((cat, i) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium" style={{ color: '#191C1E' }}>{cat.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: '#434655' }}>{cat.percentage}%</span>
                      <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                        ${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F2F4F6' }}>
                    <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Trend */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Monthly Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.monthly_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#434655' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E6E8EA', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v) => [`$${v.toLocaleString()}`, 'Expenses']} />
                  <Bar dataKey="amount" fill="#7F2500" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Vendor Breakdown */}
        <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>By Vendor</h3>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Vendor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Count</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {(d.vendor_breakdown || []).map((v, i) => (
                <tr key={v.vendor} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{v.vendor}</td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#434655' }}>{v.count}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    ${v.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
