import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getVendors, createExpense } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FloppyDisk } from '@phosphor-icons/react';

const CATEGORIES = ['Shipping & Freight', 'Warehouse Rent', 'Utilities', 'Equipment Maintenance', 'Insurance',
  'Packaging Supplies', 'Cold Storage', 'Transportation', 'Office Supplies', 'Marketing', 'Payroll', 'Legal & Professional', 'Other'];

export default function AddExpense() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor_id: '', vendor_name: '', category: '', payment_account: 'Operating Account',
    payment_method: 'Bank Transfer', reference_number: '', expense_date: new Date().toISOString().split('T')[0],
    memo: '', amount: 0, status: 'Recorded'
  });

  useEffect(() => {
    if (!selectedCompany) return;
    getVendors(selectedCompany.company_id).then(res => setVendors(res.data)).catch(() => {});
  }, [selectedCompany]);

  const handleVendorChange = (vendorId) => {
    const v = vendors.find(x => x.vendor_id === vendorId);
    setForm({ ...form, vendor_id: vendorId, vendor_name: v?.name || '' });
  };

  const handleSave = async () => {
    if (!form.category || !form.amount) return;
    setSaving(true);
    try {
      await createExpense(selectedCompany.company_id, form);
      navigate('/expenses');
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <AppShell>
      <div data-testid="add-expense-page" className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/expenses')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Add Expense</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>Record a new business expense</p>
            </div>
          </div>
          <button data-testid="save-expense-btn" onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            <FloppyDisk size={16} /> Save Expense
          </button>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Vendor</label>
              <select data-testid="expense-vendor" value={form.vendor_id} onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                <option value="">Select vendor (optional)</option>
                {vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Category</label>
              <select data-testid="expense-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Amount</label>
              <input data-testid="expense-amount" type="number" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Date</label>
              <input data-testid="expense-date" type="date" value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Payment Account</label>
              <select value={form.payment_account} onChange={(e) => setForm({ ...form, payment_account: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                <option>Operating Account</option><option>Business Checking</option><option>Petty Cash</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Payment Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                <option>Bank Transfer</option><option>Check</option><option>Cash</option><option>Credit Card</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Reference Number</label>
              <input type="text" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
                placeholder="Check #, Ref #..."
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Memo</label>
              <textarea data-testid="expense-memo" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })}
                rows={3} placeholder="Expense description..."
                className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1 resize-none"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
