import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getBalanceSheet } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Export, Printer } from '@phosphor-icons/react';

function StatementRow({ label, value, bold, indent, borderTop, color }) {
  return (
    <div className={`flex justify-between py-2 ${indent ? 'pl-6' : ''}`}
      style={{ borderTop: borderTop ? '2px solid #E6E8EA' : undefined, borderBottom: '1px solid #F2F4F6' }}>
      <span className={`text-sm ${bold ? 'font-semibold' : ''}`} style={{ color: '#191C1E' }}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-medium'}`}
        style={{ fontFamily: 'Manrope, sans-serif', color: color || '#191C1E' }}>
        ${(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

export default function BalanceSheet() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState('');
  const navigate = useNavigate();

  const loadData = () => {
    if (!selectedCompany) return;
    setLoading(true);
    getBalanceSheet(selectedCompany.company_id, asOfDate || undefined)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [selectedCompany]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;

  const d = data || {};
  const a = d.assets || {};
  const ca = a.current_assets || {};
  const l = d.liabilities || {};
  const cl = l.current_liabilities || {};
  const eq = d.equity || {};

  return (
    <AppShell>
      <div data-testid="balance-sheet-page" className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Balance Sheet</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{selectedCompany?.name} — As of {d.as_of_date}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Export size={18} /></button>
            <button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Printer size={18} /></button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div><label className="block text-xs font-medium mb-1" style={{ color: '#434655' }}>As of Date</label>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
          <div className="pt-5"><button onClick={loadData} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Apply</button></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Assets</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>${(a.total_assets || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Liabilities</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>${(l.total_liabilities || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Equity</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#16a34a' }}>${(eq.total_equity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>ASSETS</h3>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Current Assets</div>
          <StatementRow label="Cash & Equivalents" value={ca.cash_and_equivalents} indent />
          <StatementRow label="Accounts Receivable" value={ca.accounts_receivable} indent />
          <StatementRow label="Inventory" value={ca.inventory} indent />
          <StatementRow label="Total Current Assets" value={ca.total_current_assets} bold borderTop />
          <StatementRow label="TOTAL ASSETS" value={a.total_assets} bold borderTop color="#0F2D5C" />

          <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>LIABILITIES</div>
          <div className="mb-2 text-xs font-medium" style={{ color: '#434655' }}>Current Liabilities</div>
          <StatementRow label="Accounts Payable" value={cl.accounts_payable} indent />
          <StatementRow label="Total Current Liabilities" value={cl.total_current_liabilities} bold borderTop />
          <StatementRow label="TOTAL LIABILITIES" value={l.total_liabilities} bold borderTop color="#BA1A1A" />

          <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>EQUITY</div>
          <StatementRow label="Owner's Equity" value={eq.owner_equity} indent />
          <StatementRow label="Retained Earnings" value={eq.retained_earnings} indent />
          <StatementRow label="TOTAL EQUITY" value={eq.total_equity} bold borderTop color="#16a34a" />

          <div className="flex justify-between py-3 mt-4" style={{ borderTop: '3px double #191C1E' }}>
            <span className="text-base font-bold" style={{ color: '#191C1E' }}>TOTAL LIABILITIES & EQUITY</span>
            <span className="text-base font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              ${(d.total_liabilities_and_equity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
