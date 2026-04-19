import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getCashFlow } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Export, Printer } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';

export default function CashFlow() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const navigate = useNavigate();

  const loadData = () => {
    if (!selectedCompany) return;
    setLoading(true);
    getCashFlow(selectedCompany.company_id, startDate || undefined, endDate || undefined)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedCompany]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;

  const d = data || {};
  const op = d.operating_activities || {};

  return (
    <AppShell>
      <div data-testid="cash-flow-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Cash Flow Statement</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{selectedCompany?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Export size={18} /></button>
            <button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Printer size={18} /></button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#434655' }}>From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#434655' }}>To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
          <div className="pt-5"><button onClick={loadData} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Apply</button></div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Collections', value: op.collections_from_customers, color: '#16a34a' },
            { label: 'Payments', value: op.payments_to_vendors, color: '#BA1A1A' },
            { label: 'Net Cash Flow', value: d.net_change_in_cash, color: (d.net_change_in_cash || 0) >= 0 ? '#16a34a' : '#BA1A1A' },
            { label: 'Ending Cash', value: d.ending_cash, color: '#0F2D5C' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>{label}</p>
              <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color }}>
                ${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Chart */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Monthly Cash Flow</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.monthly_data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#434655' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#434655' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E6E8EA', borderRadius: '8px', fontSize: '12px' }} formatter={(v) => [`$${v.toLocaleString()}`, '']} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine y={0} stroke="#C4C5D7" />
                  <Bar dataKey="inflow" fill="#16a34a" name="Inflow" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="outflow" fill="#BA1A1A" name="Outflow" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Statement */}
          <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Cash Flow Statement</h3>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider py-2" style={{ color: '#434655', borderBottom: '2px solid #E6E8EA' }}>Operating Activities</div>
              <div className="flex justify-between py-2 pl-4 text-sm" style={{ borderBottom: '1px solid #F2F4F6' }}>
                <span style={{ color: '#434655' }}>Collections from Customers</span>
                <span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#16a34a' }}>${(op.collections_from_customers || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-2 pl-4 text-sm" style={{ borderBottom: '1px solid #F2F4F6' }}>
                <span style={{ color: '#434655' }}>Payments to Vendors</span>
                <span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>(${ (op.payments_to_vendors || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
              </div>
              {(op.expense_breakdown || []).slice(0, 5).map(cat => (
                <div key={cat.category} className="flex justify-between py-1.5 pl-8 text-xs" style={{ borderBottom: '1px solid #F2F4F6' }}>
                  <span style={{ color: '#434655' }}>{cat.category}</span>
                  <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${cat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between py-2.5 font-semibold text-sm" style={{ borderTop: '2px solid #E6E8EA' }}>
                <span style={{ color: '#191C1E' }}>Net Operating Cash Flow</span>
                <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: (op.net_operating_cash_flow || 0) >= 0 ? '#16a34a' : '#BA1A1A' }}>
                  ${(op.net_operating_cash_flow || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="text-xs font-semibold uppercase tracking-wider py-2 mt-3" style={{ color: '#434655', borderBottom: '1px solid #E6E8EA' }}>Summary</div>
              <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid #F2F4F6' }}>
                <span style={{ color: '#434655' }}>Beginning Cash</span>
                <span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif' }}>${(d.beginning_cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-2 text-sm" style={{ borderBottom: '1px solid #F2F4F6' }}>
                <span style={{ color: '#434655' }}>Net Change in Cash</span>
                <span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: (d.net_change_in_cash || 0) >= 0 ? '#16a34a' : '#BA1A1A' }}>
                  ${(d.net_change_in_cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-3 font-bold text-base" style={{ borderTop: '3px double #191C1E' }}>
                <span style={{ color: '#191C1E' }}>Ending Cash</span>
                <span className="tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>
                  ${(d.ending_cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
