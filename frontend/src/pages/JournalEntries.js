import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getJournalEntries, createJournalEntry, postJournalEntry, getAccounts } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Plus, Check, Trash, Export } from '@phosphor-icons/react';

export default function JournalEntries() {
  const { selectedCompany } = useCompany();
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ entry_date: new Date().toISOString().split('T')[0], description: '', lines: [{ account_code: '', account_name: '', description: '', debit: 0, credit: 0 }, { account_code: '', account_name: '', description: '', debit: 0, credit: 0 }], status: 'Draft' });

  const load = () => { if (!selectedCompany) return; setLoading(true);
    Promise.all([getJournalEntries(selectedCompany.company_id), getAccounts(selectedCompany.company_id)])
      .then(([e, a]) => { setEntries(e.data); setAccounts(a.data); }).catch(console.error).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [selectedCompany]);

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const updateLine = (idx, field, value) => {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: value };
    if (field === 'account_code') {
      const acct = accounts.find(a => a.code === value);
      lines[idx].account_name = acct?.name || '';
    }
    setForm({ ...form, lines });
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { account_code: '', account_name: '', description: '', debit: 0, credit: 0 }] });
  const removeLine = (idx) => { if (form.lines.length > 2) setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) }); };

  const handleSave = async (status = 'Draft') => {
    if (status === 'Posted' && !balanced) return;
    try {
      await createJournalEntry(selectedCompany.company_id, { ...form, status });
      setShowModal(false);
      setForm({ entry_date: new Date().toISOString().split('T')[0], description: '', lines: [{ account_code: '', account_name: '', description: '', debit: 0, credit: 0 }, { account_code: '', account_name: '', description: '', debit: 0, credit: 0 }], status: 'Draft' });
      load();
    } catch (err) { console.error(err); }
  };

  const handlePost = async (entryId) => {
    try { await postJournalEntry(selectedCompany.company_id, entryId); load(); } catch (err) { console.error(err); }
  };

  return (
    <AppShell>
      <div data-testid="journal-entries-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Journal Entries</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Double-entry accounting transactions</p></div>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><Export size={18} /></button>
            <button data-testid="new-journal-entry-btn" onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}><Plus size={16} weight="bold" /> New Entry</button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div> : (
            <table className="w-full text-sm">
              <thead><tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Entry #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Description</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Debit</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Credit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Actions</th>
              </tr></thead>
              <tbody>{entries.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No journal entries yet</td></tr> :
                entries.map((e, i) => (
                  <tr key={e.entry_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{e.entry_number}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{e.entry_date}</td>
                    <td className="px-4 py-3" style={{ color: '#191C1E' }}>{e.description}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(e.total_debit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(e.total_credit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: e.status === 'Posted' ? '#dcfce7' : '#F2F4F6', color: e.status === 'Posted' ? '#16a34a' : '#434655' }}>{e.status}</span></td>
                    <td className="px-4 py-3 text-center">{e.status === 'Draft' && <button data-testid={`post-entry-${e.entry_id}`} onClick={() => handlePost(e.entry_id)} className="text-xs font-medium px-2 py-1 rounded" style={{ color: '#16a34a' }}>Post</button>}</td>
                  </tr>
                ))}</tbody>
            </table>
          )}
        </div>

        {/* New Journal Entry Modal */}
        {showModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-3xl" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>New Journal Entry</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Date</label>
                  <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Description</label>
                  <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Entry description" className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
              </div>
              <div className="space-y-2 mb-4">
                {form.lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg" style={{ background: '#F7F9FB' }}>
                    <div className="col-span-4">
                      {idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Account</label>}
                      <select value={line.account_code} onChange={(e) => updateLine(idx, 'account_code', e.target.value)} className="w-full px-2 py-2 text-xs rounded-md focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                        <option value="">Select account</option>
                        {accounts.map(a => <option key={a.account_id} value={a.code}>{a.code} - {a.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">{idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Description</label>}
                      <input type="text" value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} placeholder="Line memo" className="w-full px-2 py-2 text-xs rounded-md focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                    <div className="col-span-2">{idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Debit</label>}
                      <input type="number" step="0.01" value={line.debit} onChange={(e) => updateLine(idx, 'debit', parseFloat(e.target.value) || 0)} className="w-full px-2 py-2 text-xs rounded-md text-right focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                    <div className="col-span-2">{idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Credit</label>}
                      <input type="number" step="0.01" value={line.credit} onChange={(e) => updateLine(idx, 'credit', parseFloat(e.target.value) || 0)} className="w-full px-2 py-2 text-xs rounded-md text-right focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                    <div className="col-span-1 flex justify-center">{form.lines.length > 2 && <button onClick={() => removeLine(idx)} className="p-1 rounded" style={{ color: '#BA1A1A' }}><Trash size={14} /></button>}</div>
                  </div>
                ))}
                <button onClick={addLine} className="text-xs font-medium" style={{ color: '#0F2D5C' }}><Plus size={12} className="inline" /> Add Line</button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: balanced ? '#dcfce7' : '#fef2f2' }}>
                <div className="flex gap-6 text-sm">
                  <span>Debits: <strong className="tabular-nums">${totalDebit.toFixed(2)}</strong></span>
                  <span>Credits: <strong className="tabular-nums">${totalCredit.toFixed(2)}</strong></span>
                  <span>Diff: <strong className="tabular-nums" style={{ color: balanced ? '#16a34a' : '#BA1A1A' }}>${Math.abs(totalDebit - totalCredit).toFixed(2)}</strong></span>
                </div>
                <span className="text-xs font-semibold" style={{ color: balanced ? '#16a34a' : '#BA1A1A' }}>{balanced ? 'Balanced' : 'Not Balanced'}</span>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button onClick={() => handleSave('Draft')} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>Save Draft</button>
                <button data-testid="post-journal-entry-btn" onClick={() => handleSave('Posted')} disabled={!balanced} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  <Check size={14} className="inline mr-1" /> Post Entry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
