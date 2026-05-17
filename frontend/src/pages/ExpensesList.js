import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { deleteExpense, getExpenses } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, Export, Receipt, Trash } from '@phosphor-icons/react';
import DateFilterPreset from '../components/DateFilterPreset';
import { downloadCSV } from '../lib/exportUtils';

export default function ExpensesList() {
  const { selectedCompany, can } = useCompany();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    setLoading(true);
    getExpenses(selectedCompany.company_id, categoryFilter || undefined)
      .then(res => setExpenses(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, categoryFilter]);

  const filtered = expenses.filter(e => {
    const matchesSearch = e.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase()) ||
      e.memo?.toLowerCase().includes(search.toLowerCase());
    
    const matchesDate = !dateRange.start || !dateRange.end || 
      (e.expense_date >= dateRange.start && e.expense_date <= dateRange.end);
    
    return matchesSearch && matchesDate;
  });

  const totalAmount = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))];
  const exportExpenses = () => {
    downloadCSV('expenses.csv', filtered.map((expense) => ({
      expense_date: expense.expense_date || '',
      vendor_name: expense.vendor_name || '',
      category: expense.category || '',
      payment_account: expense.payment_account || '',
      payment_method: expense.payment_method || '',
      reference_number: expense.reference_number || '',
      amount: Number(expense.amount || 0).toFixed(2),
      status: expense.status || '',
    })), ['expense_date', 'vendor_name', 'category', 'payment_account', 'payment_method', 'reference_number', 'amount', 'status']);
  };

  const reloadExpenses = async () => {
    if (!selectedCompany?.company_id) return;
    setLoading(true);
    try {
      const response = await getExpenses(selectedCompany.company_id, categoryFilter || undefined);
      setExpenses(response.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTarget || !selectedCompany?.company_id) return;
    setDeleting(true);
    try {
      await deleteExpense(selectedCompany.company_id, deleteTarget.expense_id);
      await reloadExpenses();
      setFeedback({ type: 'success', message: 'Expense moved to deleted records.' });
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Unable to delete this expense.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div data-testid="expenses-list-page" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Expenses</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Track and manage business expenses</p>
          </div>
          <button
            data-testid="add-expense-btn"
            onClick={() => navigate('/expenses/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
          >
            <Plus size={16} weight="bold" /> Add Expense
          </button>
        </div>

        {feedback && (
          <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48' }}>
            {feedback.message}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Expenses</p>
            <p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Expense Count</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{filtered.length}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Categories</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{categories.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <DateFilterPreset 
            onDateChange={(start, end) => setDateRange({ start, end })}
            storageKey="expenses_date_filter"
            defaultPreset="this_month"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
              <input data-testid="expenses-search" type="text" placeholder="Search expenses..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <select data-testid="expense-category-filter" value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
              <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={exportExpenses} aria-label="Export expenses" className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><Export size={18} /></button>
          </div>
        </div>

        {/* Table */}
        <div className="hidden md:block rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Vendor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Account</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Method</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Ref #</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No expenses found</td></tr>
                ) : filtered.map((e, i) => (
                  <tr key={e.expense_id} data-testid={`expense-row-${e.expense_id}`}
                    onClick={() => navigate(`/expenses/${e.expense_id}`)}
                    className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                    style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                    <td className="px-4 py-3" style={{ color: '#191C1E' }}>{e.expense_date}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#191C1E' }}>{e.vendor_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: '#434655' }}>{e.category}</span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{e.payment_account}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{e.payment_method}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{e.reference_number || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                      ${(e.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{e.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {can.admin ? (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(e);
                          }}
                          className="rounded-lg p-1.5 hover:bg-[#FEF2F2]"
                          style={{ color: '#B42318' }}
                        >
                          <Trash size={14} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-xl bg-white">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl p-6 text-center text-sm" style={{ background: '#FFFFFF', color: '#434655' }}>No expenses found</div>
          ) : filtered.map((expense) => (
            <button key={expense.expense_id} onClick={() => navigate(`/expenses/${expense.expense_id}`)} className="w-full rounded-xl p-4 text-left" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: '#191C1E' }}>{expense.vendor_name || expense.category || 'Expense'}</p>
                  <p className="mt-1 text-sm" style={{ color: '#64748B' }}>{expense.expense_date} • {expense.category || 'General'}</p>
                  <p className="mt-1 truncate text-xs" style={{ color: '#64748B' }}>{expense.payment_method || '—'} • Ref {expense.reference_number || '—'}</p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{expense.status}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span style={{ color: '#64748B' }}>Amount</span>
                <span className="font-semibold" style={{ color: '#191C1E' }}>${(expense.amount || 0).toFixed(2)}</span>
              </div>
              {can.admin && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(expense);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ background: '#FEF2F2', color: '#B42318' }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>
        <ConfirmDeleteModal open={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={handleDeleteExpense} loading={deleting} />
      </div>
    </AppShell>
  );
}
