import { useEffect, useMemo, useState } from 'react';
import { ArrowCounterClockwise, MagnifyingGlass, Plus, Printer, Receipt, Trash, X } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { useCompany } from '../contexts/CompanyContext';
import { createCreditMemo, deleteCreditMemo, getCreditMemos, getCustomers, getInvoices } from '../lib/api';

const emptyForm = {
  customer_id: '',
  customer_name: '',
  invoice_id: '',
  credit_date: new Date().toISOString().slice(0, 10),
  reason: '',
  notes: '',
  total: 0,
};

export default function CreditMemosList() {
  const { selectedCompany, can } = useCompany();
  const [memos, setMemos] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedMemoId, setSelectedMemoId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    if (!selectedCompany?.company_id) return;
    setLoading(true);
    try {
      const [memoRes, customerRes, invoiceRes] = await Promise.all([
        getCreditMemos(selectedCompany.company_id),
        getCustomers(selectedCompany.company_id),
        getInvoices(selectedCompany.company_id),
      ]);
      const rows = memoRes.data || [];
      setMemos(rows);
      setCustomers(customerRes.data || []);
      setInvoices(invoiceRes.data || []);
      if (!selectedMemoId && rows[0]) setSelectedMemoId(rows[0].credit_memo_id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompany?.company_id]);

  const filteredMemos = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    return memos.filter((memo) => {
      const matchesSearch = !needle
        || memo.credit_memo_number?.toLowerCase().includes(needle)
        || memo.customer_name?.toLowerCase().includes(needle)
        || memo.reason?.toLowerCase().includes(needle);
      const matchesDate = dateFilter === 'all' || (dateFilter === 'month' && memo.credit_date >= startOfMonth);
      return matchesSearch && matchesDate;
    });
  }, [memos, search, dateFilter]);

  const selectedMemo = useMemo(
    () => memos.find((memo) => memo.credit_memo_id === selectedMemoId) || filteredMemos[0] || null,
    [memos, selectedMemoId, filteredMemos],
  );

  const totalCredits = useMemo(
    () => filteredMemos.reduce((sum, memo) => sum + Number(memo.total || 0), 0),
    [filteredMemos],
  );

  const customerInvoices = invoices.filter((invoice) => !form.customer_id || invoice.customer_id === form.customer_id);
  const selectedInvoice = invoices.find((invoice) => invoice.invoice_id === form.invoice_id);

  const handleCreate = async () => {
    if (!selectedCompany?.company_id || !form.customer_id || Number(form.total || 0) <= 0) return;
    setSaving(true);
    try {
      await createCreditMemo(selectedCompany.company_id, { ...form, total: Number(form.total) || 0 });
      setShowCreate(false);
      setForm(emptyForm);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !selectedCompany?.company_id) return;
    setDeleting(true);
    try {
      await deleteCreditMemo(selectedCompany.company_id, deleteTarget.credit_memo_id);
      setDeleteTarget(null);
      setSelectedMemoId('');
      await load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-4" data-testid="credit-memos-page">
        <div className="rounded-lg bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: '#E6F3F5', color: '#0E7490' }}>
                <ArrowCounterClockwise size={22} weight="bold" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: '#64748B' }}>Sales Workspace</p>
                <h1 className="text-xl font-bold leading-tight" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Credit Memos</h1>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
              <SummaryTile label="Memos" value={filteredMemos.length} />
              <SummaryTile label="Credits" value={`$${totalCredits.toFixed(2)}`} />
              <IconButton title="Print register" onClick={() => window.print()}><Printer size={18} /></IconButton>
              {can.write && (
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: '#123461' }}>
                  <Plus size={16} weight="bold" />
                  New Memo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <div className="rounded-lg bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between" style={{ borderColor: '#E6E8EA' }}>
              <div className="relative max-w-md flex-1">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find memo, customer, or reason" className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none" style={fieldStyle} />
              </div>
              <div className="inline-flex rounded-lg p-1" style={{ background: '#F1F5F9' }}>
                {[
                  ['all', 'All'],
                  ['month', 'This Month'],
                ].map(([value, label]) => (
                  <button key={value} onClick={() => setDateFilter(value)} className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: dateFilter === value ? '#FFFFFF' : 'transparent', color: dateFilter === value ? '#0F2D5C' : '#64748B' }}>{label}</button>
                ))}
              </div>
            </div>

            <div className="max-h-[calc(100vh-270px)] overflow-auto">
              {loading ? (
                <LoadingState />
              ) : filteredMemos.length === 0 ? (
                <EmptyState text="No matching credit memos." />
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #D8DEE8' }}>
                      <HeaderCell>Memo #</HeaderCell>
                      <HeaderCell>Customer</HeaderCell>
                      <HeaderCell>Applied To</HeaderCell>
                      <HeaderCell>Date</HeaderCell>
                      <HeaderCell>Reason</HeaderCell>
                      <HeaderCell align="right">Credit</HeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMemos.map((memo, index) => {
                      const isActive = selectedMemo?.credit_memo_id === memo.credit_memo_id;
                      return (
                        <tr
                          key={memo.credit_memo_id}
                          onClick={() => setSelectedMemoId(memo.credit_memo_id)}
                          className="cursor-pointer"
                          style={{
                            borderBottom: '1px solid #EEF2F7',
                            background: isActive ? '#EAF2FF' : index % 2 === 0 ? '#FFFFFF' : '#F9FBFE',
                          }}
                        >
                          <td className="px-4 py-2.5 font-semibold" style={{ color: '#0F2D5C' }}>{memo.credit_memo_number}</td>
                          <td className="px-4 py-2.5" style={{ color: '#191C1E' }}>{memo.customer_name}</td>
                          <td className="px-4 py-2.5" style={{ color: '#475569' }}>{memo.invoice_number || memo.invoice_id || 'Direct credit'}</td>
                          <td className="px-4 py-2.5" style={{ color: '#475569' }}>{memo.credit_date}</td>
                          <td className="px-4 py-2.5" style={{ color: '#475569' }}>{memo.reason || 'Return / adjustment'}</td>
                          <td className="px-4 py-2.5 text-right font-bold" style={{ color: '#0E7490' }}>${Number(memo.total || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <aside className="rounded-lg bg-white shadow-sm">
            <div className="border-b px-4 py-3" style={{ borderColor: '#E6E8EA' }}>
              <h2 className="text-sm font-bold" style={{ color: '#191C1E' }}>Memo Detail</h2>
            </div>
            {!selectedMemo ? (
              <EmptyState text="Select a credit memo to review details." />
            ) : (
              <div className="space-y-4 p-4">
                <div className="rounded-lg p-4" style={{ background: '#123461', color: '#FFFFFF' }}>
                  <p className="text-xs uppercase tracking-[0.16em]" style={{ color: '#BFDBFE' }}>{selectedMemo.credit_memo_number}</p>
                  <p className="mt-2 text-3xl font-bold">${Number(selectedMemo.total || 0).toFixed(2)}</p>
                  <p className="mt-1 text-sm" style={{ color: '#DCEBFF' }}>{selectedMemo.customer_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Credit Date" value={selectedMemo.credit_date} />
                  <Info label="Applied To" value={selectedMemo.invoice_number || selectedMemo.invoice_id || 'Direct credit'} />
                  <Info label="Reason" value={selectedMemo.reason || 'Return / adjustment'} />
                  <Info label="Status" value={selectedMemo.status || 'Posted'} />
                </div>
                {can.admin && (
                  <button
                    onClick={() => setDeleteTarget(selectedMemo)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                    style={{ background: '#FEF2F2', color: '#B91C1C' }}
                  >
                    <Trash size={16} />
                    Delete Credit Memo
                  </button>
                )}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>Notes</p>
                  <p className="mt-2 min-h-20 rounded-lg p-3 text-sm" style={{ background: '#F8FAFC', color: '#334155' }}>{selectedMemo.notes || 'No notes recorded.'}</p>
                </div>
              </div>
            )}
          </aside>
        </div>

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: '#E6E8EA' }}>
                <div className="flex items-center gap-2">
                  <Receipt size={20} style={{ color: '#0E7490' }} />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: '#64748B' }}>Sales Return</p>
                    <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Create Credit Memo</h2>
                  </div>
                </div>
                <button onClick={() => setShowCreate(false)} className="rounded p-2 hover:bg-slate-100" title="Close"><X size={18} /></button>
              </div>

              <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1fr_300px]">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Customer">
                      <select value={form.customer_id} onChange={(event) => {
                        const customer = customers.find((entry) => entry.customer_id === event.target.value);
                        setForm((current) => ({ ...current, customer_id: event.target.value, customer_name: customer?.name || '', invoice_id: '' }));
                      }} className={fieldClass} style={fieldStyle}>
                        <option value="">Select customer</option>
                        {customers.map((customer) => <option key={customer.customer_id} value={customer.customer_id}>{customer.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Apply To Invoice">
                      <select value={form.invoice_id} onChange={(event) => setForm((current) => ({ ...current, invoice_id: event.target.value }))} className={fieldClass} style={fieldStyle}>
                        <option value="">Direct customer credit</option>
                        {customerInvoices.map((invoice) => <option key={invoice.invoice_id} value={invoice.invoice_id}>{invoice.invoice_number} - ${Number(invoice.balance_due || invoice.total || 0).toFixed(2)}</option>)}
                      </select>
                    </Field>
                    <Field label="Credit Date">
                      <input type="date" value={form.credit_date} onChange={(event) => setForm((current) => ({ ...current, credit_date: event.target.value }))} className={fieldClass} style={fieldStyle} />
                    </Field>
                    <Field label="Credit Amount">
                      <input type="number" step="0.01" value={form.total} onChange={(event) => setForm((current) => ({ ...current, total: event.target.value }))} className={fieldClass} style={fieldStyle} />
                    </Field>
                    <Field label="Reason" span>
                      <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Damaged goods, return, pricing adjustment..." className={fieldClass} style={fieldStyle} />
                    </Field>
                    <Field label="Internal Notes" span>
                      <textarea rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={fieldClass} style={fieldStyle} />
                    </Field>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg p-4" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>Posting Preview</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <Info label="Customer" value={form.customer_name || 'Unassigned'} />
                      <Info label="Invoice Balance" value={selectedInvoice ? `$${Number(selectedInvoice.balance_due || selectedInvoice.total || 0).toFixed(2)}` : 'Direct credit'} />
                      <Info label="Credit Total" value={`$${Number(form.total || 0).toFixed(2)}`} />
                    </div>
                  </div>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !form.customer_id || Number(form.total || 0) <= 0}
                    className="w-full rounded-lg px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: '#123461' }}
                  >
                    {saving ? 'Posting...' : 'Post Credit Memo'}
                  </button>
                  <button onClick={() => setShowCreate(false)} className="w-full rounded-lg px-4 py-2 text-sm font-semibold" style={{ color: '#475569' }}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
        <ConfirmDeleteModal open={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting} />
      </div>
    </AppShell>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-lg px-4 py-2 text-right" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', minWidth: 120 }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: '#191C1E' }}>{value}</p>
    </div>
  );
}

function IconButton({ children, title, onClick }) {
  return (
    <button onClick={onClick} title={title} className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ color: '#334155', border: '1px solid #CBD5E1' }}>
      {children}
    </button>
  );
}

function HeaderCell({ children, align = 'left' }) {
  return <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748B', textAlign: align }}>{children}</th>;
}

function Field({ label, children, span }) {
  return (
    <label className={`block ${span ? 'md:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#64748B' }}>{label}</p>
      <p className="mt-1 text-sm" style={{ color: '#191C1E' }}>{value || '-'}</p>
    </div>
  );
}

function LoadingState() {
  return <div className="flex h-44 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>;
}

function EmptyState({ text }) {
  return <div className="px-5 py-10 text-center text-sm" style={{ color: '#64748B' }}>{text}</div>;
}

const fieldClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1';
const fieldStyle = { background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1', color: '#191C1E' };
