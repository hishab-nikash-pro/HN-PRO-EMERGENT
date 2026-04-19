import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getProfitLoss } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Export, Printer } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { downloadCSV, printReport } from '../lib/exportUtils';

export default function ProfitLoss() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const navigate = useNavigate();

  const loadData = () => {
    if (!selectedCompany) return;
    setLoading(true);
    getProfitLoss(selectedCompany.company_id, startDate || undefined, endDate || undefined)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedCompany]);

  const handleExport = () => {
    if (!data) return;
    const rows = [
      { section: 'Income', line: 'Sales Revenue', amount: data.total_income || 0 },
      { section: 'COGS', line: 'Cost of Goods Sold', amount: -(data.cogs || 0) },
      { section: 'Gross Profit', line: 'Gross Profit', amount: data.gross_profit || 0 },
      ...(data.expense_categories || []).map((c) => ({ section: 'Operating Expenses', line: c.category, amount: -(c.amount || 0) })),
      { section: 'Net Profit', line: 'Net Profit', amount: data.net_profit || 0 },
    ];
    const period = `${startDate || 'YTD'}_to_${endDate || 'today'}`;
    downloadCSV(`ProfitLoss_${selectedCompany?.company_id || 'company'}_${period}.csv`, rows, ['section', 'line', 'amount']);
  };

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;

  const d = data || {};

  return (
    <AppShell>
      <div data-testid="profit-loss-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Profit & Loss</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{selectedCompany?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button data-testid="pl-export-csv" onClick={handleExport} title="Export CSV" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:bg-white transition-colors" style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #CBD5E1' }}><Export size={14} /> CSV</button>
            <button data-testid="pl-print" onClick={printReport} title="Print / Save PDF" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium hover:bg-white transition-colors" style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #CBD5E1' }}><Printer size={14} /> Print</button>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#434655' }}>From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#434655' }}>To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
          </div>
          <div className="pt-5">
            <button data-testid="apply-date-filter" onClick={loadData}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              Apply
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Income', value: d.total_income, color: '#0F2D5C' },
            { label: 'Gross Profit', value: d.gross_profit, sub: `${d.gross_margin}% margin`, color: '#16a34a' },
            { label: 'Operating Expenses', value: d.operating_expenses, color: '#7F2500' },
            { label: 'Net Profit', value: d.net_profit, sub: `${d.net_margin}% margin`, color: d.net_profit >= 0 ? '#16a34a' : '#BA1A1A' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>{label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color }}>
                ${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
              {sub && <p className="text-xs mt-1" style={{ color: '#434655' }}>{sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* P&L Statement */}
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Statement</h3>
            <div className="space-y-2">
              <div className="flex justify-between py-2.5 text-sm font-semibold" style={{ borderBottom: '2px solid #E6E8EA' }}>
                <span style={{ color: '#191C1E' }}>Income</span>
                <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(d.total_income || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-2 text-sm pl-4" style={{ borderBottom: '1px solid #F2F4F6' }}>
                <span style={{ color: '#434655' }}>Sales Revenue</span>
                <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(d.total_income || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-2 text-sm pl-4" style={{ borderBottom: '1px solid #F2F4F6' }}>
                <span style={{ color: '#434655' }}>Cost of Goods Sold</span>
                <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>(${ (d.cogs || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm font-semibold" style={{ borderBottom: '2px solid #E6E8EA', background: '#F7F9FB', margin: '0 -1.5rem', padding: '0.625rem 1.5rem' }}>
                <span style={{ color: '#191C1E' }}>Gross Profit</span>
                <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#16a34a' }}>${(d.gross_profit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-2.5 text-sm font-semibold mt-2" style={{ borderBottom: '1px solid #E6E8EA' }}>
                <span style={{ color: '#191C1E' }}>Operating Expenses</span>
                <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#7F2500' }}>(${ (d.operating_expenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
              </div>
              {(d.expense_categories || []).map(cat => (
                <div key={cat.category} className="flex justify-between py-2 text-sm pl-4" style={{ borderBottom: '1px solid #F2F4F6' }}>
                  <span style={{ color: '#434655' }}>{cat.category}</span>
                  <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 text-base font-bold mt-2" style={{ borderTop: '3px double #191C1E' }}>
                <span style={{ color: '#191C1E' }}>Net Profit</span>
                <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: d.net_profit >= 0 ? '#16a34a' : '#BA1A1A' }}>
                  ${(d.net_profit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Monthly Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.monthly_data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#434655' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E6E8EA', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(v) => [`$${v.toLocaleString()}`, '']} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="income" fill="#0F2D5C" name="Income" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="expenses" fill="#BA1A1A" name="Expenses" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
