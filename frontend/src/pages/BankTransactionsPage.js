import { useEffect, useMemo, useState } from 'react';
import { Bank, Plus } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import {
  createManualBankTransaction,
  getBankAccounts,
  getManualBankTransactions,
} from '../lib/api';

const initialForm = {
  transaction_date: new Date().toISOString().slice(0, 10),
  transaction_type: 'Deposit',
  amount: '',
  reference: '',
  description: '',
  payee_name: '',
  notes: '',
};

export default function BankTransactionsPage() {
  const { selectedCompany, can } = useCompany();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadAccounts = async () => {
    if (!selectedCompany) return;
    const res = await getBankAccounts(selectedCompany.company_id);
    const rows = res.data || [];
    setAccounts(rows);
    if (!selectedAccountId && rows[0]) {
      setSelectedAccountId(rows[0].bank_account_id);
    }
  };

  const loadTransactions = async () => {
    if (!selectedCompany || !selectedAccountId) return;
    setLoading(true);
    try {
      const res = await getManualBankTransactions(selectedCompany.company_id, selectedAccountId);
      setTransactions(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [selectedCompany]);

  useEffect(() => {
    loadTransactions();
  }, [selectedCompany, selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.bank_account_id === selectedAccountId) || null,
    [accounts, selectedAccountId],
  );

  const runningBalance = useMemo(
    () => transactions.reduce((sum, entry) => sum + Number(entry.signed_amount || entry.amount || 0), 0),
    [transactions],
  );

  const handleCreate = async () => {
    if (!selectedCompany || !selectedAccountId) return;
    setSaving(true);
    try {
      await createManualBankTransaction(selectedCompany.company_id, selectedAccountId, {
        ...form,
        amount: Number(form.amount) || 0,
      });
      setShowModal(false);
      setForm(initialForm);
      setMessage('Manual bank transaction recorded.');
      await Promise.all([loadAccounts(), loadTransactions()]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6" data-testid="bank-transactions-page">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Manual Bank Transactions</h1>
            <p className="text-sm mt-1" style={{ color: '#475569' }}>Post deposits, withdrawals, fees, and adjustments directly into a bank register.</p>
          </div>
          {can.write && (
            <button onClick={() => setShowModal(true)} className="px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <Plus size={16} className="inline mr-1" />
              New Transaction
            </button>
          )}
        </div>

        {message && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#ECFDF3', color: '#166534' }}>{message}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Bank Accounts" value={accounts.length} accent="#0F2D5C" />
          <MetricCard title="Entries" value={transactions.length} accent="#0E7490" />
          <MetricCard title="Register Change" value={`$${runningBalance.toFixed(2)}`} accent="#7C2D12" />
          <MetricCard title="Account Balance" value={`$${Number(selectedAccount?.current_balance || 0).toFixed(2)}`} accent="#166534" />
        </div>

        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Bank Account</label>
          <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className={fieldClass}>
            <option value="">Select bank account</option>
            {accounts.map((account) => (
              <option key={account.bank_account_id} value={account.bank_account_id}>
                {account.account_name} • {account.account_number_last4 || '----'}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E6E8EA' }}>
            <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Register Entries</h2>
            <Bank size={18} style={{ color: '#0F2D5C' }} />
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>
          ) : transactions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: '#64748B' }}>No manual transactions recorded for this account yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #E6E8EA' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Reference</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((entry, index) => (
                    <tr key={entry.transaction_id} style={{ borderBottom: '1px solid #F2F4F6', background: index % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                      <td className="px-4 py-3">{entry.transaction_date}</td>
                      <td className="px-4 py-3">{entry.transaction_type}</td>
                      <td className="px-4 py-3">{entry.reference || '—'}</td>
                      <td className="px-4 py-3">{entry.description || entry.notes || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: Number(entry.signed_amount || 0) >= 0 ? '#0E7490' : '#B91C1C' }}>
                        ${Number(entry.signed_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-3xl p-6" style={{ background: '#FFFFFF' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Manual Bank Transaction</h3>
                <button onClick={() => setShowModal(false)} className="text-sm font-medium" style={{ color: '#475569' }}>Close</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Date"><input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} className={fieldClass} /></Field>
                <Field label="Type">
                  <select value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })} className={fieldClass}>
                    <option>Deposit</option>
                    <option>Withdrawal</option>
                    <option>Fee</option>
                    <option>Credit</option>
                    <option>Adjustment</option>
                  </select>
                </Field>
                <Field label="Amount"><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={fieldClass} /></Field>
                <Field label="Reference"><input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={fieldClass} /></Field>
                <Field label="Payee / Source"><input value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value })} className={fieldClass} /></Field>
                <Field label="Description"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={fieldClass} /></Field>
                <div className="md:col-span-2">
                  <Field label="Notes"><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fieldClass} /></Field>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#475569' }}>Cancel</button>
                <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>{saving ? 'Saving...' : 'Save Transaction'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MetricCard({ title, value, accent }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>{title}</p>
      <p className="text-2xl font-bold mt-2" style={{ color: accent, fontFamily: 'Manrope, sans-serif' }}>{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>{label}</span>
      {children}
    </label>
  );
}

const fieldClass = 'w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1';
