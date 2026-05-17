import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { getBills, createBill, payBill, deleteBill, getVendors } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Plus, MagnifyingGlass, CurrencyDollar, Trash, Export } from '@phosphor-icons/react';
import DateFilterPreset from '../components/DateFilterPreset';
import { useNavigate, useParams } from 'react-router-dom';
import { downloadCSV } from '../lib/exportUtils';

const STATUS_STYLES = { Open: { bg: '#dbeafe', color: '#0F2D5C' }, Partial: { bg: '#fef3c7', color: '#92400e' }, Paid: { bg: '#dcfce7', color: '#16a34a' }, Overdue: { bg: '#fef2f2', color: '#BA1A1A' } };
const todayLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

export default function BillsList() {
  const { selectedCompany, can } = useCompany();
  const navigate = useNavigate();
  const { billId } = useParams();
  const [bills, setBills] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [showPay, setShowPay] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, payment_date: todayLocal(), payment_method: 'Bank Transfer', reference: '', memo: '' });
  const [form, setForm] = useState({ vendor_id: '', vendor_name: '', bill_number: '', bill_date: todayLocal(), due_date: '', items: [{ account: '', description: '', amount: 0 }], notes: '', total: 0 });

  const load = () => { if (!selectedCompany) return; setLoading(true);
    Promise.all([getBills(selectedCompany.company_id), getVendors(selectedCompany.company_id)])
      .then(([b, v]) => { setBills(b.data); setVendors(v.data); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [selectedCompany]);

  useEffect(() => {
    if (!billId || loading) return;
    requestAnimationFrame(() => {
      const element = document.getElementById(billId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [billId, bills, loading]);

  const filtered = bills.filter(b => {
    const matchesSearch = b.vendor_name?.toLowerCase().includes(search.toLowerCase()) || b.bill_number?.toLowerCase().includes(search.toLowerCase());
    const matchesDate = !dateRange.start || !dateRange.end || 
      (b.bill_date >= dateRange.start && b.bill_date <= dateRange.end);
    return matchesSearch && matchesDate;
  });
  const totalAP = filtered.reduce((s, b) => s + (b.balance_due || 0), 0);

  const exportBills = () => {
    downloadCSV('bills.csv', filtered.map((bill) => ({
      bill_number: bill.bill_number || bill.bill_id || '',
      vendor_name: bill.vendor_name || '',
      bill_date: bill.bill_date || '',
      due_date: bill.due_date || '',
      status: bill.status || '',
      total: Number(bill.total || 0).toFixed(2),
      balance_due: Number(bill.balance_due || 0).toFixed(2),
    })), ['bill_number', 'vendor_name', 'bill_date', 'due_date', 'status', 'total', 'balance_due']);
  };

  const handleSave = async () => {
    const total = form.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    await createBill(selectedCompany.company_id, { ...form, total });
    setShowCreate(false); load();
  };

  const handlePay = async () => {
    if (!showPay) return;
    await payBill(selectedCompany.company_id, showPay.bill_id, payForm);
    setShowPay(null); load();
  };

  const handleDeleteBill = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBill(selectedCompany.company_id, deleteTarget.bill_id);
      setFeedback({ type: 'success', message: `${deleteTarget.bill_number || 'Bill'} was moved to deleted records.` });
      setDeleteTarget(null);
      load();
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Unable to delete this bill.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div data-testid="bills-list-page" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div><h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Bills</h1><p className="text-sm mt-1" style={{ color: '#434655' }}>Manage vendor bills and payments</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/recurring')} className="px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#EFF6FF', color: '#0F2D5C' }}>Recurring</button>
            <button onClick={() => navigate('/vendor-payments/new')} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#ECFDF3', color: '#166534' }}><CurrencyDollar size={16} weight="bold" /> Pay Bill</button>
            <button data-testid="create-bill-btn" onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}><Plus size={16} weight="bold" /> New Bill</button>
          </div>
        </div>
        {feedback && (
          <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48' }}>
            {feedback.message}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}><p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total AP</p><p className="text-2xl font-bold mt-1 tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>${totalAP.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p></div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}><p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Open Bills</p><p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{filtered.filter(b => b.status !== 'Paid').length}</p></div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}><p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Paid Bills</p><p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#16a34a' }}>{filtered.filter(b => b.status === 'Paid').length}</p></div>
        </div>
        <div className="space-y-3">
          <DateFilterPreset 
            onDateChange={(start, end) => setDateRange({ start, end })}
            storageKey="bills_date_filter"
            defaultPreset="this_month"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3"><div className="relative flex-1 max-w-xs"><MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} /><input type="text" placeholder="Search bills..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div><button onClick={exportBills} aria-label="Export bills" className="p-2 rounded-lg hover:bg-white w-fit" style={{ color: '#434655' }}><Export size={18} /></button></div>
        </div>
        <div className="hidden md:block rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div> : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead><tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Bill #</th><th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Vendor</th><th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Date</th><th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Due</th><th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Amount</th><th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Balance</th><th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Status</th><th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Actions</th>
              </tr></thead>
              <tbody>{filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No bills</td></tr> : filtered.map((b, i) => {
                const ss = STATUS_STYLES[b.status] || STATUS_STYLES.Open;
                return (<tr id={b.bill_id} key={b.bill_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{b.bill_number || b.bill_id?.slice(0, 10)}</td>
                  <td className="px-4 py-3" style={{ color: '#191C1E' }}>{b.vendor_name}</td>
                  <td className="px-4 py-3" style={{ color: '#434655' }}>{b.bill_date}</td>
                  <td className="px-4 py-3" style={{ color: '#434655' }}>{b.due_date}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(b.total || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: b.balance_due > 0 ? '#BA1A1A' : '#16a34a' }}>${(b.balance_due || 0).toFixed(2)}</td>
                  <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.color }}>{b.status}</span></td>
                  <td className="px-4 py-3 text-center"><div className="flex items-center justify-center gap-1">{b.status !== 'Paid' && <button onClick={() => { setShowPay(b); setPayForm({ amount: b.balance_due || 0, payment_date: todayLocal(), payment_method: 'Bank Transfer', reference: '', memo: '' }); }} className="text-xs font-medium px-2 py-1 rounded hover:bg-[#F2F4F6]" style={{ color: '#16a34a' }}><CurrencyDollar size={14} className="inline" /> Pay</button>}{can.admin && <button onClick={() => setDeleteTarget(b)} className="p-1 rounded hover:bg-[#fef2f2]" style={{ color: '#BA1A1A' }}><Trash size={14} /></button>}</div></td>
                </tr>);
              })}</tbody>
            </table>
            </div>
          )}
        </div>
        <div className="md:hidden space-y-3">
          {loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div> : filtered.length === 0 ? <div className="rounded-xl p-6 text-center text-sm" style={{ background: '#FFFFFF', color: '#434655' }}>No bills</div> : filtered.map((b) => {
            const ss = STATUS_STYLES[b.status] || STATUS_STYLES.Open;
            return <div key={b.bill_id} className="rounded-xl p-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ color: '#0F2D5C' }}>{b.bill_number || b.bill_id?.slice(0, 10)}</p>
                  <p className="text-sm truncate mt-1" style={{ color: '#191C1E' }}>{b.vendor_name}</p>
                  <p className="text-xs mt-1" style={{ color: '#434655' }}>{b.bill_date} • Due {b.due_date || '—'}</p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: ss.bg, color: ss.color }}>{b.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div><p style={{ color: '#64748B' }}>Amount</p><p className="font-semibold" style={{ color: '#191C1E' }}>${(b.total || 0).toFixed(2)}</p></div>
                <div className="text-right"><p style={{ color: '#64748B' }}>Balance</p><p className="font-semibold" style={{ color: (b.balance_due || 0) > 0 ? '#B91C1C' : '#166534' }}>${(b.balance_due || 0).toFixed(2)}</p></div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                {b.status !== 'Paid' && <button onClick={() => { setShowPay(b); setPayForm({ amount: b.balance_due || 0, payment_date: todayLocal(), payment_method: 'Bank Transfer', reference: '', memo: '' }); }} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#ECFDF3', color: '#166534' }}>Pay</button>}
                {can.admin && <button onClick={() => setDeleteTarget(b)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#FEF2F2', color: '#B91C1C' }}>Delete</button>}
              </div>
            </div>;
          })}
        </div>
        {/* Create Bill Modal */}
        {showCreate && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>New Bill</h3>
              <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Vendor</label><select value={form.vendor_id} onChange={(e) => { const v = vendors.find(x => x.vendor_id === e.target.value); setForm({ ...form, vendor_id: e.target.value, vendor_name: v?.name || '' }); }} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}><option value="">Select</option>{vendors.map(v => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Bill #</label><input type="text" value={form.bill_number} onChange={(e) => setForm({ ...form, bill_number: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Bill Date</label><input type="date" value={form.bill_date} onChange={(e) => setForm({ ...form, bill_date: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Due Date</label><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
              </div>
              <div className="space-y-2 mb-4">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 md:grid-cols-3"><input type="text" value={item.account} onChange={(e) => { const items = [...form.items]; items[idx].account = e.target.value; setForm({ ...form, items }); }} placeholder="Account" className="px-2 py-2 text-xs rounded-md" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} /><input type="text" value={item.description} onChange={(e) => { const items = [...form.items]; items[idx].description = e.target.value; setForm({ ...form, items }); }} placeholder="Description" className="px-2 py-2 text-xs rounded-md" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} /><input type="number" step="0.01" value={item.amount} onChange={(e) => { const items = [...form.items]; items[idx].amount = parseFloat(e.target.value) || 0; setForm({ ...form, items }); }} className="px-2 py-2 text-xs rounded-md text-right" style={{ boxShadow: '0 0 0 1px #C4C5D7' }} /></div>
                ))}
                <button onClick={() => setForm({ ...form, items: [...form.items, { account: '', description: '', amount: 0 }] })} className="text-xs font-medium" style={{ color: '#0F2D5C' }}><Plus size={12} className="inline" /> Add Line</button>
              </div>
              <div className="text-right text-sm font-bold mb-4">Total: ${form.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0).toFixed(2)}</div>
              <div className="flex justify-end gap-2"><button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button><button data-testid="save-bill-btn" onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Save Bill</button></div>
            </div>
          </div>
        )}
        <ConfirmDeleteModal open={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={handleDeleteBill} loading={deleting} />
        {/* Pay Bill Modal */}
        {showPay && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Pay Bill</h3>
              <p className="text-sm mb-4" style={{ color: '#434655' }}>{showPay.vendor_name} — Balance: <strong style={{ color: '#BA1A1A' }}>${(showPay.balance_due || 0).toFixed(2)}</strong></p>
              <div className="space-y-4">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Amount</label><input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Date</label><input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Method</label><select value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}><option>Bank Transfer</option><option>Check</option><option>Cash</option><option>ACH</option><option>Wire</option></select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Reference</label><input type="text" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-6"><button onClick={() => setShowPay(null)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button><button data-testid="submit-bill-payment" onClick={handlePay} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Pay Bill</button></div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
