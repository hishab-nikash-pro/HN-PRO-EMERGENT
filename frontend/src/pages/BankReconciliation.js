import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import {
  adjustStatementLine,
  createBankAccount,
  getBankAccounts,
  getReconciliationSummary,
  getStatementCandidates,
  getStatementLines,
  importBankStatement,
  matchStatementLine,
} from '../lib/api';
import { ArrowsClockwise, Bank, CheckCircle, FileArrowUp, Plus, ArrowLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

const initialAccount = {
  account_name: '',
  account_type: 'Checking',
  account_number_last4: '',
  currency: 'USD',
  opening_balance: 0,
  current_balance: 0,
  ledger_account_code: '1000',
  notes: '',
};

export default function BankReconciliation() {
  const { selectedCompany } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementLines, setStatementLines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState(initialAccount);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [adjustment, setAdjustment] = useState({ account_code: '6900', account_name: 'Bank Reconciliation Adjustment', description: '', amount: 0 });
  const navigate = useNavigate();

  const loadAccounts = async () => {
    if (!selectedCompany) return;
    const res = await getBankAccounts(selectedCompany.company_id);
    const rows = res.data || [];
    setAccounts(rows);
    if (!selectedAccountId && rows[0]) setSelectedAccountId(rows[0].bank_account_id);
  };

  const loadSelectedAccount = async () => {
    if (!selectedCompany || !selectedAccountId) return;
    setLoading(true);
    try {
      const [linesRes, summaryRes] = await Promise.all([
        getStatementLines(selectedCompany.company_id, selectedAccountId),
        getReconciliationSummary(selectedCompany.company_id, selectedAccountId),
      ]);
      setStatementLines(linesRes.data || []);
      setSummary(summaryRes.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [selectedCompany]);

  useEffect(() => {
    loadSelectedAccount();
  }, [selectedCompany, selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.bank_account_id === selectedAccountId),
    [accounts, selectedAccountId],
  );

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCompany || !selectedAccountId) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await importBankStatement(selectedCompany.company_id, selectedAccountId, formData);
    setMessage(`Imported ${res.data.imported || 0} statement line(s).`);
    await loadSelectedAccount();
    event.target.value = '';
  };

  const handleSelectLine = async (line) => {
    setSelectedLine(line);
    if (!selectedCompany || !selectedAccountId) return;
    const res = await getStatementCandidates(selectedCompany.company_id, selectedAccountId, line.line_id);
    setCandidates(res.data.candidates || []);
    setAdjustment((prev) => ({ ...prev, amount: Math.abs(Number(line.amount || 0)), description: `Adjustment for ${line.description}` }));
  };

  const handleMatch = async (candidate) => {
    if (!selectedCompany || !selectedAccountId || !selectedLine) return;
    await matchStatementLine(selectedCompany.company_id, selectedAccountId, selectedLine.line_id, {
      record_type: candidate.record_type,
      record_id: candidate.record_id,
      note: candidate.summary,
    });
    setMessage('Statement line matched.');
    setSelectedLine(null);
    setCandidates([]);
    await loadSelectedAccount();
  };

  const handleAdjustment = async () => {
    if (!selectedCompany || !selectedAccountId || !selectedLine) return;
    await adjustStatementLine(selectedCompany.company_id, selectedAccountId, selectedLine.line_id, adjustment);
    setMessage('Adjustment entry created and line marked as adjusted.');
    setSelectedLine(null);
    setCandidates([]);
    await loadSelectedAccount();
  };

  const handleCreateBankAccount = async () => {
    await createBankAccount(selectedCompany.company_id, {
      ...accountForm,
      opening_balance: Number(accountForm.opening_balance) || 0,
      current_balance: Number(accountForm.current_balance) || 0,
    });
    setShowAccountModal(false);
    setAccountForm(initialAccount);
    await loadAccounts();
    setMessage('Bank account created.');
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Bank Reconciliation</h1>
              <p className="text-sm mt-1" style={{ color: '#475569' }}>Import statement lines, match them to customer/vendor payments, and post adjustments when needed.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadSelectedAccount()} className="px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#EFF6FF', color: '#0F2D5C' }}>
              <ArrowsClockwise size={16} className="inline mr-1" />
              Refresh
            </button>
            <button onClick={() => setShowAccountModal(true)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <Plus size={16} className="inline mr-1" />
              Bank Account
            </button>
          </div>
        </div>

        {message && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#ECFDF3', color: '#166534' }}>{message}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Kpi title="Accounts" value={accounts.length} tone="#0F2D5C" />
          <Kpi title="Unmatched" value={summary?.unmatched_count || 0} tone="#B91C1C" />
          <Kpi title="Matched" value={summary?.matched_count || 0} tone="#0E7490" />
          <Kpi title="Difference" value={`$${Number(summary?.difference || 0).toFixed(2)}`} tone="#7C2D12" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div className="rounded-2xl p-4 md:p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                <div className="flex-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Bank Account</label>
                  <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full max-w-md px-3 py-2.5 text-sm rounded-lg" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' }}>
                    <option value="">Select bank account</option>
                    {accounts.map((account) => (
                      <option key={account.bank_account_id} value={account.bank_account_id}>
                        {account.account_name} • {account.account_number_last4 || '----'}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer" style={{ background: '#F7F9FB', color: '#0F2D5C' }}>
                  <FileArrowUp size={16} />
                  Import Statement CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              {selectedAccount && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  <Info label="Type" value={selectedAccount.account_type} />
                  <Info label="Ledger" value={selectedAccount.ledger_account_code} />
                  <Info label="Opening" value={`$${Number(selectedAccount.opening_balance || 0).toFixed(2)}`} />
                  <Info label="Current" value={`$${Number(selectedAccount.current_balance || 0).toFixed(2)}`} />
                </div>
              )}
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
                <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Statement Lines</h2>
              </div>
              {loading ? (
                <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>
              ) : statementLines.length === 0 ? (
                <div className="px-5 py-10 text-sm text-center" style={{ color: '#64748B' }}>No statement lines yet. Import a CSV to start reconciliation.</div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #E6E8EA' }}>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Description</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Amount</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Status</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementLines.map((line, index) => (
                          <tr key={line.line_id} style={{ borderBottom: '1px solid #F2F4F6', background: index % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                            <td className="px-4 py-3">{line.statement_date}</td>
                            <td className="px-4 py-3">{line.description}</td>
                            <td className="px-4 py-3 text-right font-semibold" style={{ color: Number(line.amount) >= 0 ? '#0E7490' : '#B91C1C' }}>${Number(line.amount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3"><StatusChip status={line.status} /></td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => handleSelectLine(line)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#EFF6FF', color: '#0F2D5C' }}>Review</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden divide-y" style={{ borderColor: '#F2F4F6' }}>
                    {statementLines.map((line) => (
                      <button key={line.line_id} onClick={() => handleSelectLine(line)} className="w-full text-left p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#191C1E' }}>{line.description}</p>
                            <p className="text-xs mt-1" style={{ color: '#64748B' }}>{line.statement_date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold" style={{ color: Number(line.amount) >= 0 ? '#0E7490' : '#B91C1C' }}>${Number(line.amount || 0).toFixed(2)}</p>
                            <StatusChip status={line.status} />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: '#191C1E' }}>Selected Line</h2>
              {!selectedLine ? (
                <p className="text-sm" style={{ color: '#64748B' }}>Select a statement line to match it or create an adjustment.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  <Info label="Date" value={selectedLine.statement_date} />
                  <Info label="Description" value={selectedLine.description} />
                  <Info label="Amount" value={`$${Number(selectedLine.amount || 0).toFixed(2)}`} />
                  <Info label="Status" value={selectedLine.status} />
                </div>
              )}
            </div>

            <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Candidate Matches</h2>
                <Bank size={18} style={{ color: '#0F2D5C' }} />
              </div>
              {!selectedLine ? (
                <p className="text-sm" style={{ color: '#64748B' }}>Choose a statement line first.</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm" style={{ color: '#64748B' }}>No exact candidates found. Use an adjustment if needed.</p>
              ) : (
                <div className="space-y-3">
                  {candidates.map((candidate) => (
                    <div key={`${candidate.record_type}-${candidate.record_id}`} className="rounded-xl p-3" style={{ background: '#F7F9FB' }}>
                      <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{candidate.summary}</p>
                      <p className="text-xs mt-1" style={{ color: '#64748B' }}>{candidate.record_type} • {candidate.date || '—'} • ${Number(candidate.amount || 0).toFixed(2)}</p>
                      <button onClick={() => handleMatch(candidate)} className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#0F2D5C' }}>
                        <CheckCircle size={14} className="inline mr-1" />
                        Match
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedLine && (
              <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <h2 className="text-sm font-semibold mb-3" style={{ color: '#191C1E' }}>Adjustment Entry</h2>
                <div className="space-y-3">
                  <input value={adjustment.account_code} onChange={(e) => setAdjustment({ ...adjustment, account_code: e.target.value })} placeholder="Account Code" className={fieldClass} style={fieldStyle} />
                  <input value={adjustment.account_name} onChange={(e) => setAdjustment({ ...adjustment, account_name: e.target.value })} placeholder="Account Name" className={fieldClass} style={fieldStyle} />
                  <input value={adjustment.description} onChange={(e) => setAdjustment({ ...adjustment, description: e.target.value })} placeholder="Description" className={fieldClass} style={fieldStyle} />
                  <input type="number" step="0.01" value={adjustment.amount} onChange={(e) => setAdjustment({ ...adjustment, amount: e.target.value })} placeholder="Amount" className={fieldClass} style={fieldStyle} />
                  <button onClick={handleAdjustment} className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#7C2D12' }}>
                    Create Adjustment Entry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(25,28,30,0.55)' }}>
            <div className="w-full max-w-2xl rounded-3xl p-6" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: '#191C1E', fontFamily: 'Manrope, sans-serif' }}>New Bank Account</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input value={accountForm.account_name} onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })} placeholder="Account Name" className={fieldClass} style={fieldStyle} />
                <select value={accountForm.account_type} onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })} className={fieldClass} style={fieldStyle}>
                  <option>Checking</option>
                  <option>Savings</option>
                  <option>Credit Card</option>
                </select>
                <input value={accountForm.account_number_last4} onChange={(e) => setAccountForm({ ...accountForm, account_number_last4: e.target.value })} placeholder="Last 4 Digits" className={fieldClass} style={fieldStyle} />
                <input value={accountForm.ledger_account_code} onChange={(e) => setAccountForm({ ...accountForm, ledger_account_code: e.target.value })} placeholder="Ledger Account Code" className={fieldClass} style={fieldStyle} />
                <input type="number" step="0.01" value={accountForm.opening_balance} onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })} placeholder="Opening Balance" className={fieldClass} style={fieldStyle} />
                <input type="number" step="0.01" value={accountForm.current_balance} onChange={(e) => setAccountForm({ ...accountForm, current_balance: e.target.value })} placeholder="Current Balance" className={fieldClass} style={fieldStyle} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowAccountModal(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: '#475569' }}>Cancel</button>
                <button onClick={handleCreateBankAccount} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Save Account</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ title, value, tone }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>{title}</p>
      <p className="text-2xl font-bold mt-2" style={{ color: tone, fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-sm mt-1" style={{ color: '#191C1E' }}>{value || '—'}</p>
    </div>
  );
}

function StatusChip({ status }) {
  const tones = {
    Unmatched: { bg: '#FEF2F2', color: '#B91C1C' },
    Matched: { bg: '#ECFDF3', color: '#166534' },
    Adjusted: { bg: '#EFF6FF', color: '#0F2D5C' },
  };
  const tone = tones[status] || tones.Unmatched;
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: tone.bg, color: tone.color }}>{status}</span>;
}

const fieldClass = 'w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1';
const fieldStyle = { background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#0F172A' };
