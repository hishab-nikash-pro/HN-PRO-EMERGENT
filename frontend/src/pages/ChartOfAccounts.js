import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getAccounts, createAccount } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Plus, MagnifyingGlass, Export } from '@phosphor-icons/react';

const TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
const SUB_TYPES = { Asset: ['Current Asset', 'Fixed Asset'], Liability: ['Current Liability', 'Long-Term'], Equity: ["Owner's Equity"], Income: ['Operating Revenue', 'Other Revenue'], Expense: ['Operating Expense', 'Cost of Sales'] };
const TYPE_COLORS = { Asset: '#0037B0', Liability: '#BA1A1A', Equity: '#16a34a', Income: '#4D5B94', Expense: '#7F2500' };

export default function ChartOfAccounts() {
  const { selectedCompany } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', account_type: 'Asset', sub_type: 'Current Asset', description: '', opening_balance: 0 });

  const load = () => { if (!selectedCompany) return; setLoading(true); getAccounts(selectedCompany.company_id).then(r => setAccounts(r.data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [selectedCompany]);

  const filtered = accounts.filter(a => a.code?.includes(search) || a.name?.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    if (!form.code || !form.name) return;
    await createAccount(selectedCompany.company_id, form);
    setShowModal(false);
    setForm({ code: '', name: '', account_type: 'Asset', sub_type: 'Current Asset', description: '', opening_balance: 0 });
    load();
  };

  return (
    <AppShell>
      <div data-testid="chart-of-accounts-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Chart of Accounts</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Manage your accounting structure</p></div>
          <button data-testid="add-account-btn" onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0037B0, #1D4ED8)' }}><Plus size={16} weight="bold" /> Add Account</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs"><MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
            <input data-testid="accounts-search" type="text" placeholder="Search by code or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
          <button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Export size={18} /></button>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0037B0', borderTopColor: 'transparent' }} /></div> : (
            <table className="w-full text-sm">
              <thead><tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Account Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Sub-Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Balance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
              </tr></thead>
              <tbody>{filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No accounts</td></tr> :
                filtered.map((a, i) => (
                  <tr key={a.account_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: TYPE_COLORS[a.account_type] || '#191C1E' }}>{a.code}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{a.name}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${TYPE_COLORS[a.account_type]}15`, color: TYPE_COLORS[a.account_type] }}>{a.account_type}</span></td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{a.sub_type}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(a.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{a.status}</span></td>
                  </tr>
                ))}</tbody>
            </table>
          )}
        </div>
        {showModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Add Account</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Code</label>
                    <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. 7000" className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                  <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Name</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Account name" className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Type</label>
                    <select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value, sub_type: SUB_TYPES[e.target.value]?.[0] || '' })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                      {TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Sub-Type</label>
                    <select value={form.sub_type} onChange={(e) => setForm({ ...form, sub_type: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                      {(SUB_TYPES[form.account_type] || []).map(s => <option key={s}>{s}</option>)}</select></div>
                </div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Opening Balance</label>
                  <input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button data-testid="save-account-btn" onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0037B0, #1D4ED8)' }}>Save Account</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
