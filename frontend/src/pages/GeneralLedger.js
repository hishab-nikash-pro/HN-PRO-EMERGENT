import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getGeneralLedger, getAccounts } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Export, Printer, CaretDown, CaretRight } from '@phosphor-icons/react';

export default function GeneralLedger() {
  const { selectedCompany } = useCompany();
  const [ledger, setLedger] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expanded, setExpanded] = useState({});

  const load = () => { if (!selectedCompany) return; setLoading(true);
    const params = {};
    if (accountFilter) params.account_code = accountFilter;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    Promise.all([getGeneralLedger(selectedCompany.company_id, params), getAccounts(selectedCompany.company_id)])
      .then(([l, a]) => { setLedger(l.data); setAccounts(a.data); const exp = {}; l.data.forEach(a => exp[a.code] = true); setExpanded(exp); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [selectedCompany]);

  return (
    <AppShell>
      <div data-testid="general-ledger-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>General Ledger</h1><p className="text-sm mt-1" style={{ color: '#434655' }}>All posted transactions by account</p></div>
          <div className="flex gap-2"><button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Export size={18} /></button><button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Printer size={18} /></button></div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}><option value="">All Accounts</option>{accounts.map(a => <option key={a.account_id} value={a.code}>{a.code} - {a.name}</option>)}</select>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
          <button onClick={load} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Apply</button>
        </div>
        {loading ? <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div> : (
          <div className="space-y-4">
            {ledger.length === 0 ? <div className="rounded-2xl p-12 text-center" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}><p className="text-sm" style={{ color: '#434655' }}>No journal entries posted yet. Create and post journal entries to see the general ledger.</p></div> :
            ledger.map(acct => (
              <div key={acct.code} className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <button onClick={() => setExpanded(prev => ({ ...prev, [acct.code]: !prev[acct.code] }))} className="w-full flex items-center justify-between px-5 py-3 text-left" style={{ background: '#F7F9FB' }}>
                  <div className="flex items-center gap-2">
                    {expanded[acct.code] ? <CaretDown size={14} /> : <CaretRight size={14} />}
                    <span className="font-semibold text-sm" style={{ color: '#0F2D5C' }}>{acct.code}</span>
                    <span className="font-semibold text-sm" style={{ color: '#191C1E' }}>{acct.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: '#434655' }}>{acct.type}</span>
                  </div>
                  <span className="font-bold tabular-nums text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(acct.closing_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </button>
                {expanded[acct.code] && (
                  <table className="w-full text-sm">
                    <thead><tr style={{ borderBottom: '1px solid #C4C5D7' }}>
                      <th className="text-left px-4 py-2 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Date</th><th className="text-left px-4 py-2 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Entry #</th><th className="text-left px-4 py-2 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Description</th><th className="text-right px-4 py-2 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Debit</th><th className="text-right px-4 py-2 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Credit</th><th className="text-right px-4 py-2 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Balance</th>
                    </tr></thead>
                    <tbody>
                      <tr style={{ background: '#F7F9FB' }}><td colSpan={3} className="px-4 py-2 text-xs font-medium" style={{ color: '#434655' }}>Opening Balance</td><td className="px-4 py-2 text-right tabular-nums text-xs">{acct.opening_balance > 0 ? `$${acct.opening_balance.toFixed(2)}` : ''}</td><td className="px-4 py-2 text-right tabular-nums text-xs">{acct.opening_balance < 0 ? `$${Math.abs(acct.opening_balance).toFixed(2)}` : ''}</td><td className="px-4 py-2 text-right font-semibold tabular-nums text-xs" style={{ fontFamily: 'Manrope, sans-serif' }}>${acct.opening_balance.toFixed(2)}</td></tr>
                      {(acct.entries || []).map((e, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F2F4F6' }}>
                          <td className="px-4 py-2 text-xs" style={{ color: '#434655' }}>{e.date}</td><td className="px-4 py-2 text-xs font-medium" style={{ color: '#0F2D5C' }}>{e.entry_number}</td><td className="px-4 py-2 text-xs" style={{ color: '#191C1E' }}>{e.description}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-xs" style={{ fontFamily: 'Manrope, sans-serif' }}>{e.debit > 0 ? `$${e.debit.toFixed(2)}` : ''}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-xs" style={{ fontFamily: 'Manrope, sans-serif' }}>{e.credit > 0 ? `$${e.credit.toFixed(2)}` : ''}</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums text-xs" style={{ fontFamily: 'Manrope, sans-serif' }}>${(e.balance || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#F7F9FB', borderTop: '2px solid #E6E8EA' }}><td colSpan={3} className="px-4 py-2 text-xs font-semibold" style={{ color: '#191C1E' }}>Closing Balance</td><td colSpan={2}></td><td className="px-4 py-2 text-right font-bold tabular-nums text-xs" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(acct.closing_balance || 0).toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
