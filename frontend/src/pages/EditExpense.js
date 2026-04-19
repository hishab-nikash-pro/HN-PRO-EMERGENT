import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getVendors, getExpenses, updateExpense } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FloppyDisk, Trash } from '@phosphor-icons/react';

const CATEGORIES = ['Shipping & Freight', 'Warehouse Rent', 'Utilities', 'Equipment Maintenance', 'Insurance',
  'Packaging Supplies', 'Cold Storage', 'Transportation', 'Office Supplies', 'Marketing', 'Payroll', 'Legal & Professional', 'Other'];

export default function EditExpense() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const { expenseId } = useParams();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor_id: '', vendor_name: '', category: '', payment_account: 'Operating Account',
    payment_method: 'Bank Transfer', reference_number: '', expense_date: new Date().toISOString().split('T')[0],
    memo: '', amount: 0, status: 'Recorded'
  });

  useEffect(() => {
    if (!selectedCompany || !expenseId) return;
    Promise.all([
      getVendors(selectedCompany.company_id),
      getExpenses(selectedCompany.company_id)
    ]).then(([vendorsRes, expensesRes]) => {
      setVendors(vendorsRes.data);
      const expense = (expensesRes.data || []).find(e => e.expense_id === expenseId);
      if (expense) {
        setForm({
          vendor_id: expense.vendor_id || '',
          vendor_name: expense.vendor_name || '',
          category: expense.category || '',
          payment_account: expense.payment_account || 'Operating Account',
          payment_method: expense.payment_method || 'Bank Transfer',
          reference_number: expense.reference_number || '',
          expense_date: expense.expense_date || new Date().toISOString().split('T')[0],
          memo: expense.memo || '',
          amount: expense.amount || 0,
          status: expense.status || 'Recorded'
        });
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [selectedCompany, expenseId]);

  const handleVendorChange = (vendorId) => {
    const v = vendors.find(x => x.vendor_id === vendorId);
    setForm({ ...form, vendor_id: vendorId, vendor_name: v?.name || '' });
  };

  const handleSave = async () => {
    if (!form.category || !form.amount) return;
    setSaving(true);
    try {
      await updateExpense(selectedCompany.company_id, expenseId, form);
      navigate('/expenses');
    } catch (err) { console.error(err); alert('Failed to update expense'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div data-testid="edit-expense-page" className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/expenses')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Edit Expense</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>Update expense details</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Vendor</label>
              <select value={form.vendor_id} onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                <option value="">Select vendor...</option>
                {vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Expense Date *</label>
              <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Amount *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Payment Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                <option>Bank Transfer</option>
                <option>Cash</option>
                <option>Check</option>
                <option>Credit Card</option>
                <option>Debit Card</option>
                <option>ACH</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Payment Account</label>
              <input type="text" value={form.payment_account} onChange={(e) => setForm({ ...form, payment_account: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Reference Number</label>
              <input type="text" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                <option>Recorded</option>
                <option>Pending</option>
                <option>Paid</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Memo</label>
              <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })}
                rows={3} className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button onClick={handleSave} disabled={saving || !form.category || !form.amount}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <FloppyDisk size={16} weight="fill" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => navigate('/expenses')}
              className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#F2F4F6', color: '#434655' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
