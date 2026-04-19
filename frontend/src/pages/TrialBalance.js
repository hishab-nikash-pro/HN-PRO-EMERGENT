import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getTrialBalance } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Export, Printer, Check, X } from '@phosphor-icons/react';

const TYPE_COLORS = { Asset: '#0F2D5C', Liability: '#BA1A1A', Equity: '#16a34a', Income: '#0E7490', Expense: '#7F2500' };

export default function TrialBalance() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState('');

  const load = () => { if (!selectedCompany) return; setLoading(true);
    getTrialBalance(selectedCompany.company_id, asOfDate || undefined).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [selectedCompany]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;

  const d = data || { rows: [], total_debit: 0, total_credit: 0, balanced: true };

  return (
    <AppShell>
      <div data-testid="trial-balance-page" className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Trial Balance</h1><p className="text-sm mt-0.5" style={{ color: '#434655' }}>{selectedCompany?.name} — As of {d.as_of_date}</p></div>
          <div className="flex gap-2"><button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Export size={18} /></button><button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Printer size={18} /></button></div>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
          <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Apply</button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: d.balanced ? '#dcfce7' : '#fef2f2' }}>
            {d.balanced ? <Check size={14} style={{ color: '#16a34a' }} /> : <X size={14} style={{ color: '#BA1A1A' }} />}
            <span className="text-xs font-semibold" style={{ color: d.balanced ? '#16a34a' : '#BA1A1A' }}>{d.balanced ? 'Balanced' : 'Not Balanced'}</span>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: '#F7F9FB', borderBottom: '2px solid #C4C5D7' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Account Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Type</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Debit</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Credit</th>
            </tr></thead>
            <tbody>
              {d.rows.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No account balances. Post journal entries to generate trial balance.</td></tr> :
              d.rows.map((r, i) => (
                <tr key={r.code} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: TYPE_COLORS[r.type] || '#191C1E' }}>{r.code}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{r.name}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${TYPE_COLORS[r.type]}15`, color: TYPE_COLORS[r.type] }}>{r.type}</span></td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{r.debit > 0 ? `$${r.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{r.credit > 0 ? `$${r.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '3px double #191C1E', background: '#F7F9FB' }}>
                <td colSpan={3} className="px-4 py-3 font-bold text-sm" style={{ color: '#191C1E' }}>TOTALS</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${d.total_debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${d.total_credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
