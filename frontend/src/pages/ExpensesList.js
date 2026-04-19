import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getExpenses } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, Export, Receipt } from '@phosphor-icons/react';

export default function ExpensesList() {
  const { selectedCompany } = useCompany();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    setLoading(true);
    getExpenses(selectedCompany.company_id, categoryFilter || undefined)
      .then(res => setExpenses(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, categoryFilter]);

  const filtered = expenses.filter(e =>
    e.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.category?.toLowerCase().includes(search.toLowerCase()) ||
    e.memo?.toLowerCase().includes(search.toLowerCase())
  );

  const totalAmount = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const categories = [...new Set(expenses.map(e => e.category).filter(Boolean))];

  return (
    <AppShell>
      <div data-testid="expenses-list-page" className="space-y-6">
        <div className="flex items-center justify-between">
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

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
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
        <div className="flex items-center gap-3 flex-wrap">
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
          <button className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><Export size={18} /></button>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <table className="w-full text-sm">
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
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No expenses found</td></tr>
                ) : filtered.map((e, i) => (
                  <tr key={e.expense_id} data-testid={`expense-row-${e.expense_id}`}
                    className="transition-colors hover:bg-[#F7F9FB]"
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
