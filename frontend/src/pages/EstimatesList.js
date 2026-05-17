import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { getEstimates, createEstimate, convertEstimateToInvoice, deleteEstimate, getCustomers, getProducts } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, ArrowsClockwise, Trash, Export, Eye } from '@phosphor-icons/react';
import { downloadCSV } from '../lib/exportUtils';

const STATUS_STYLES = { Draft: { bg: '#F2F4F6', color: '#434655' }, Sent: { bg: '#dbeafe', color: '#0F2D5C' }, Accepted: { bg: '#dcfce7', color: '#16a34a' }, Declined: { bg: '#fef2f2', color: '#BA1A1A' }, Expired: { bg: '#F2F4F6', color: '#434655' }, Converted: { bg: '#dbeafe', color: '#0E7490' } };

export default function EstimatesList() {
  const { selectedCompany, can } = useCompany();
  const [estimates, setEstimates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isCreateDirty, setIsCreateDirty] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [form, setForm] = useState({ customer_id: '', customer_name: '', estimate_date: new Date().toISOString().split('T')[0], expiry_date: '', items: [{ product: '', description: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 }], notes: '', subtotal: 0, tax_total: 0, total: 0, status: 'Draft' });
  const navigate = useNavigate();
  const location = useLocation();

  const createBlankForm = () => ({ customer_id: '', customer_name: '', estimate_date: new Date().toISOString().split('T')[0], expiry_date: '', items: [{ product: '', description: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 }], notes: '', subtotal: 0, tax_total: 0, total: 0, status: 'Draft' });
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };
  const openCreate = () => {
    setForm(createBlankForm());
    setIsCreateDirty(false);
    setShowCreate(true);
  };
  const requestCloseCreate = () => {
    if (isCreateDirty) setShowUnsavedConfirm(true);
    else setShowCreate(false);
  };
  const leaveCreate = () => {
    setShowUnsavedConfirm(false);
    setShowCreate(false);
    setIsCreateDirty(false);
    setForm(createBlankForm());
  };
  const patchForm = (patch) => {
    setIsCreateDirty(true);
    setForm((current) => ({ ...current, ...patch }));
  };

  const load = () => { if (!selectedCompany) return; setLoading(true);
    Promise.all([getEstimates(selectedCompany.company_id), getCustomers(selectedCompany.company_id), getProducts(selectedCompany.company_id)])
      .then(([e, c, p]) => { setEstimates(e.data); setCustomers(c.data); setProducts(p.data); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [selectedCompany]);
  useEffect(() => {
    if (location.pathname === '/estimates/new') openCreate();
  }, [location.pathname]);

  const filtered = estimates.filter(e => e.estimate_number?.toLowerCase().includes(search.toLowerCase()) || e.customer_name?.toLowerCase().includes(search.toLowerCase()));
  const exportEstimates = () => {
    downloadCSV('estimates.csv', filtered.map((estimate) => ({
      estimate_number: estimate.estimate_number || '',
      customer_name: estimate.customer_name || '',
      estimate_date: estimate.estimate_date || '',
      expiry_date: estimate.expiry_date || '',
      status: estimate.status || '',
      total: Number(estimate.total || 0).toFixed(2),
    })), ['estimate_number', 'customer_name', 'estimate_date', 'expiry_date', 'status', 'total']);
  };

  const handleConvert = async (id) => {
    try { const res = await convertEstimateToInvoice(selectedCompany.company_id, id); navigate(`/sales/${res.data.invoice_id}`); } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEstimate(selectedCompany.company_id, deleteTarget.estimate_id);
      setFeedback({ type: 'success', message: `${deleteTarget.estimate_number} was moved to deleted records.` });
      setDeleteTarget(null);
      load();
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Unable to delete this estimate.' });
    } finally {
      setDeleting(false);
    }
  };

  const updateItem = (idx, field, value) => {
    setIsCreateDirty(true);
    const items = [...form.items]; items[idx] = { ...items[idx], [field]: value };
    if (field === 'quantity' || field === 'rate') { items[idx].amount = (parseFloat(items[idx].quantity) || 0) * (parseFloat(items[idx].rate) || 0); }
    if (field === 'product') { const p = products.find(x => x.name === value); if (p) { items[idx] = { ...items[idx], product: p.name, description: p.description, rate: p.selling_price, unit: p.unit, amount: (parseFloat(items[idx].quantity) || 1) * p.selling_price }; } }
    const sub = items.reduce((s, i) => s + (i.amount || 0), 0);
    setForm({ ...form, items, subtotal: sub, tax_total: sub * 0.08, total: sub * 1.08 });
  };

  const handleSave = async () => {
    if (!form.customer_id) return;
    await createEstimate(selectedCompany.company_id, form);
    setShowCreate(false); setIsCreateDirty(false); load();
  };

  return (
    <AppShell>
      <div data-testid="estimates-list-page" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleBack} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#FFFFFF', color: '#0F2D5C', boxShadow: '0 0 0 1px #C4C5D7' }}>Back</button>
              <button type="button" onClick={() => navigate('/dashboard')} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#FFFFFF', color: '#434655', boxShadow: '0 0 0 1px #C4C5D7' }}>Cancel</button>
            </div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Estimates</h1><p className="text-sm mt-1" style={{ color: '#434655' }}>Quotes and proposals for customers</p>
          </div>
          <button data-testid="create-estimate-btn" onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}><Plus size={16} weight="bold" /> New Estimate</button>
        </div>
        {feedback && (
          <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48' }}>
            {feedback.message}
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1 max-w-xs"><MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} /><input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div><button onClick={exportEstimates} aria-label="Export estimates" className="p-2 rounded-lg hover:bg-white w-fit" style={{ color: '#434655' }}><Export size={18} /></button></div>
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div> : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead><tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Estimate #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Expiry</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Actions</th>
              </tr></thead>
              <tbody>{filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No estimates</td></tr> : filtered.map((e, i) => {
                const ss = STATUS_STYLES[e.status] || STATUS_STYLES.Draft;
                return (
                  <tr key={e.estimate_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{e.estimate_number}</td>
                    <td className="px-4 py-3" style={{ color: '#191C1E' }}>{e.customer_name}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{e.estimate_date}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{e.expiry_date || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(e.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.color }}>{e.status}</span></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {e.status !== 'Converted' && (
                          <button
                            onClick={() => handleConvert(e.estimate_id)}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold hover:bg-[#F2F4F6]"
                            style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #C4C5D7' }}
                            title="Convert to Invoice"
                          >
                            <ArrowsClockwise size={14} /> Convert to Invoice
                          </button>
                        )}
                        {can.admin && <button onClick={() => setDeleteTarget(e)} className="p-1 rounded hover:bg-[#fef2f2]" style={{ color: '#BA1A1A' }}><Trash size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
            </div>
          )}
        </div>

        {showCreate && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 py-8" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>New Estimate</h3>
              <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-3">
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Customer</label>
                  <select value={form.customer_id} onChange={(e) => { const c = customers.find(x => x.customer_id === e.target.value); patchForm({ customer_id: e.target.value, customer_name: c?.name || '' }); }} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                    <option value="">Select</option>{customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Date</label>
                  <input type="date" value={form.estimate_date} onChange={(e) => patchForm({ estimate_date: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Expiry Date</label>
                  <input type="date" value={form.expiry_date} onChange={(e) => patchForm({ expiry_date: e.target.value })} className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} /></div>
              </div>
              <div className="space-y-2 mb-4">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 items-center sm:grid-cols-6">
                    <select value={item.product} onChange={(e) => updateItem(idx, 'product', e.target.value)} className="col-span-2 px-2 py-2 text-xs rounded-md" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7' }}>
                      <option value="">Product</option>{products.map(p => <option key={p.product_id} value={p.name}>{p.name}</option>)}</select>
                    <input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="px-2 py-2 text-xs rounded-md text-right" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7' }} />
                    <input type="number" step="0.01" value={item.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} className="px-2 py-2 text-xs rounded-md text-right" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7' }} />
                    <div className="text-xs text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif' }}>${(item.amount || 0).toFixed(2)}</div>
                    <button onClick={() => { if (form.items.length > 1) { setIsCreateDirty(true); setForm({ ...form, items: form.items.filter((_, i) => i !== idx) }); } }} className="p-1" style={{ color: '#BA1A1A' }}><Trash size={12} /></button>
                  </div>
                ))}
                <button onClick={() => { setIsCreateDirty(true); setForm({ ...form, items: [...form.items, { product: '', description: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 }] }); }} className="text-xs font-medium" style={{ color: '#0F2D5C' }}><Plus size={12} className="inline" /> Add Line</button>
              </div>
              <div className="text-right space-y-1 text-sm mb-4">
                <div>Subtotal: <strong>${form.subtotal.toFixed(2)}</strong></div>
                <div>Tax (8%): <strong>${form.tax_total.toFixed(2)}</strong></div>
                <div className="text-base font-bold">Total: ${form.total.toFixed(2)}</div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={requestCloseCreate} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button data-testid="save-estimate-btn" onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Save Estimate</button>
              </div>
            </div>
          </div>
        )}
        {showUnsavedConfirm && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(25,28,30,0.48)' }}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold" style={{ color: '#191C1E' }}>Unsaved changes</h3>
              <p className="mt-2 text-sm" style={{ color: '#475569' }}>You have unsaved changes. Do you want to leave?</p>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setShowUnsavedConfirm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ color: '#0F2D5C', boxShadow: '0 0 0 1px #C4C5D7' }}>Stay</button>
                <button type="button" onClick={leaveCreate} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: '#BA1A1A' }}>Leave</button>
              </div>
            </div>
          </div>
        )}
        <ConfirmDeleteModal open={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} />
      </div>
    </AppShell>
  );
}
