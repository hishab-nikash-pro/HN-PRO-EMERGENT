import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import AppShell from '../components/layout/AppShell';
import { aiUploadGet, aiUploadConfirm, aiUploadProcess, aiUploadDelete } from '../lib/api';
import { ArrowLeft, FloppyDisk, CheckCircle, Trash, ArrowClockwise, Warning, Plus, X } from '@phosphor-icons/react';

const DESTINATIONS = [
  { value: 'invoice', label: 'Sales Invoice', hint: 'Money coming IN from a customer' },
  { value: 'bill', label: 'Vendor Bill', hint: 'Money owed to a vendor' },
  { value: 'expense', label: 'Expense', hint: 'Paid expense / receipt' },
  { value: 'stock_receipt', label: 'Stock Receipt', hint: 'Goods received into inventory' },
];

const DEFAULT_BY_DESTINATION = {
  invoice: () => ({
    customer_name: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    items: [{ description: '', quantity: 1, price: 0 }],
    subtotal: 0,
    tax: 0,
    total: 0,
    status: 'Draft',
  }),
  bill: () => ({
    vendor_name: '',
    bill_number: '',
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    items: [{ description: '', quantity: 1, cost: 0 }],
    total: 0,
  }),
  expense: () => ({
    vendor_name: '',
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    category: 'Other',
    payment_method: 'Cash',
    reference: '',
    memo: '',
  }),
  stock_receipt: () => ({
    vendor_name: '',
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    items: [{ description: '', quantity: 1, unit_cost: 0 }],
  }),
};

export default function AIImportReview() {
  const { uploadId } = useParams();
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  const [upload, setUpload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('expense');
  const [fields, setFields] = useState({});

  useEffect(() => {
    if (!selectedCompany) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, uploadId]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await aiUploadGet(selectedCompany.company_id, uploadId);
      const u = res.data;
      setUpload(u);

      // Pick initial destination from AI's detected type
      const detected = u.detected_type || 'expense';
      const mapped = ['invoice', 'bill', 'expense', 'stock_receipt'].includes(detected) ? detected : 'expense';
      setDestination(mapped);

      // Merge AI-extracted data into defaults for that destination
      const defaults = DEFAULT_BY_DESTINATION[mapped]();
      setFields({ ...defaults, ...(u.extracted_data || {}) });
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to load upload');
    } finally {
      setLoading(false);
    }
  };

  const changeDestination = (newDest) => {
    setDestination(newDest);
    const defaults = DEFAULT_BY_DESTINATION[newDest]();
    // Preserve any compatible fields from the current state
    const merged = { ...defaults };
    ['vendor_name', 'customer_name', 'reference', 'memo', 'total', 'amount'].forEach((k) => {
      if (fields[k] !== undefined && merged[k] !== undefined) merged[k] = fields[k];
    });
    // If switching to expense and we had a total, use it as amount
    if (newDest === 'expense' && !merged.amount && fields.total) merged.amount = fields.total;
    if (newDest !== 'expense' && !merged.total && fields.amount) merged.total = fields.amount;
    setFields(merged);
  };

  const setField = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  const setItemField = (idx, key, value) => {
    setFields((prev) => {
      const items = [...(prev.items || [])];
      items[idx] = { ...items[idx], [key]: value };
      const next = { ...prev, items };
      // Recompute totals for invoice / bill
      if (destination === 'invoice' || destination === 'bill') {
        const subtotal = items.reduce((s, it) => {
          const qty = parseFloat(it.quantity || 0) || 0;
          const unit = parseFloat(it.price ?? it.cost ?? 0) || 0;
          return s + qty * unit;
        }, 0);
        if (destination === 'invoice') {
          next.subtotal = +subtotal.toFixed(2);
          next.total = +(subtotal + (parseFloat(next.tax || 0) || 0)).toFixed(2);
        } else {
          next.total = +subtotal.toFixed(2);
        }
      }
      return next;
    });
  };

  const addItem = () => {
    setFields((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        destination === 'bill'
          ? { description: '', quantity: 1, cost: 0 }
          : destination === 'stock_receipt'
          ? { description: '', quantity: 1, unit_cost: 0 }
          : { description: '', quantity: 1, price: 0 },
      ],
    }));
  };

  const removeItem = (idx) => {
    setFields((prev) => {
      const items = [...(prev.items || [])];
      items.splice(idx, 1);
      return { ...prev, items };
    });
  };

  const confirmAndSave = async () => {
    if (!selectedCompany) return;
    setSaving(true);
    setError('');
    try {
      const res = await aiUploadConfirm(selectedCompany.company_id, uploadId, {
        destination,
        data: fields,
      });
      const { data } = res.data;
      // Navigate to the created record
      if (destination === 'invoice' && data?.invoice_id) {
        navigate(`/sales/${data.invoice_id}`);
      } else if (destination === 'bill') {
        navigate('/bills');
      } else if (destination === 'expense') {
        navigate('/expenses');
      } else if (destination === 'stock_receipt') {
        navigate('/inventory');
      } else {
        navigate('/ai-import');
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const reprocess = async () => {
    setReprocessing(true);
    setError('');
    try {
      await aiUploadProcess(selectedCompany.company_id, uploadId);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Re-process failed');
    } finally {
      setReprocessing(false);
    }
  };

  const cancelUpload = async () => {
    if (!window.confirm('Discard this upload? The file and extracted data will be deleted.')) return;
    try {
      await aiUploadDelete(selectedCompany.company_id, uploadId);
      navigate('/ai-import');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to delete');
    }
  };

  const filePreviewSrc = useMemo(() => {
    if (!upload?.file_base64) return null;
    if (upload.file_type?.startsWith('image/')) {
      return `data:${upload.file_type};base64,${upload.file_base64}`;
    }
    if (upload.file_type === 'application/pdf') {
      return `data:application/pdf;base64,${upload.file_base64}`;
    }
    return null;
  }, [upload]);

  const confidence = upload?.confidence || 0;
  const confidenceColor = confidence >= 0.8 ? '#16a34a' : confidence >= 0.5 ? '#eab308' : '#f97316';

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    );
  }

  if (!upload) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto p-8 text-center">
          <Warning size={48} style={{ color: '#f97316', margin: '0 auto' }} />
          <p className="mt-4" style={{ color: '#434655' }}>Upload not found.</p>
          <button onClick={() => navigate('/ai-import')} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#0F2D5C' }} data-testid="review-back-btn">
            Back to AI Import Center
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/ai-import')}
              className="p-2 rounded-lg hover:bg-[#F2F4F6]"
              data-testid="review-back-btn"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Review AI Extraction</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{upload.file_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: `${confidenceColor}22`, color: confidenceColor }}
              data-testid="review-confidence-badge"
            >
              AI confidence: {Math.round(confidence * 100)}%
            </span>
            <button
              onClick={reprocess}
              disabled={reprocessing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1"
              style={{ borderColor: '#C4C5D7', color: '#434655' }}
              data-testid="review-reprocess-btn"
            >
              <ArrowClockwise size={14} className={reprocessing ? 'animate-spin' : ''} />
              Re-extract
            </button>
            <button
              onClick={cancelUpload}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
              style={{ background: '#FEF2F2', color: '#BA1A1A' }}
              data-testid="review-cancel-btn"
            >
              <Trash size={14} /> Discard
            </button>
          </div>
        </div>

        {/* AI suggestions banner */}
        {upload.suggestions && upload.suggestions.length > 0 && (
          <div
            className="rounded-lg p-4 flex items-start gap-3"
            style={{ background: '#FEF3C7', border: '1px solid #F59E0B' }}
            data-testid="review-suggestions"
          >
            <Warning size={20} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400E' }}>AI has questions:</p>
              <ul className="mt-1 text-sm list-disc pl-5" style={{ color: '#92400E' }}>
                {upload.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg p-3 text-sm" style={{ background: '#FEF2F2', color: '#BA1A1A' }} data-testid="review-error">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Left: Editable form */}
          <div className="rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Save as</label>
              <select
                value={destination}
                onChange={(e) => changeDestination(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ border: '1px solid #C4C5D7' }}
                data-testid="review-destination-select"
              >
                {DESTINATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                {DESTINATIONS.find((d) => d.value === destination)?.hint}
              </p>
            </div>

            <div className="border-t pt-4" style={{ borderColor: '#F2F4F6' }}>
              {destination === 'invoice' && (
                <InvoiceForm fields={fields} setField={setField} setItemField={setItemField} addItem={addItem} removeItem={removeItem} />
              )}
              {destination === 'bill' && (
                <BillForm fields={fields} setField={setField} setItemField={setItemField} addItem={addItem} removeItem={removeItem} />
              )}
              {destination === 'expense' && (
                <ExpenseForm fields={fields} setField={setField} />
              )}
              {destination === 'stock_receipt' && (
                <StockReceiptForm fields={fields} setField={setField} setItemField={setItemField} addItem={addItem} removeItem={removeItem} />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t" style={{ borderColor: '#F2F4F6' }}>
              <button
                onClick={() => navigate('/ai-import')}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid #C4C5D7', color: '#434655' }}
                data-testid="review-back-list-btn"
              >
                Back to list
              </button>
              <button
                onClick={confirmAndSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)', opacity: saving ? 0.6 : 1 }}
                data-testid="review-confirm-btn"
              >
                {saving ? <FloppyDisk size={16} /> : <CheckCircle size={16} weight="bold" />}
                {saving ? 'Saving…' : 'Confirm & Save'}
              </button>
            </div>
          </div>

          {/* Right: File preview */}
          <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#191C1E' }}>Original file</h2>
            <div className="rounded-lg overflow-hidden" style={{ background: '#F7F9FB', minHeight: 400, maxHeight: 700 }} data-testid="review-file-preview">
              {filePreviewSrc && upload.file_type?.startsWith('image/') ? (
                <img src={filePreviewSrc} alt={upload.file_name} className="w-full h-auto" style={{ maxHeight: 700, objectFit: 'contain' }} />
              ) : filePreviewSrc && upload.file_type === 'application/pdf' ? (
                <iframe src={filePreviewSrc} title="pdf-preview" className="w-full" style={{ minHeight: 600, border: 0 }} />
              ) : (
                <div className="flex items-center justify-center p-8" style={{ color: '#434655' }}>
                  <div className="text-center">
                    <Warning size={40} style={{ color: '#CBD5E1', margin: '0 auto' }} />
                    <p className="mt-2 text-sm">Preview not available for this file type ({upload.file_type}).</p>
                    <p className="text-xs mt-1">{upload.file_name} · {(upload.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Form subcomponents ───

const labelCls = 'block text-xs font-medium mb-1.5';
const inputCls = 'w-full px-3 py-2 rounded-lg text-sm';
const inputStyle = { border: '1px solid #C4C5D7' };
const labelStyle = { color: '#434655' };

function TextField({ label, value, onChange, type = 'text', testId }) {
  return (
    <div>
      <label className={labelCls} style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
        className={inputCls}
        style={inputStyle}
        data-testid={testId}
      />
    </div>
  );
}

function InvoiceForm({ fields, setField, setItemField, addItem, removeItem }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Customer name" value={fields.customer_name} onChange={(v) => setField('customer_name', v)} testId="field-customer-name" />
        <TextField label="Invoice number" value={fields.invoice_number} onChange={(v) => setField('invoice_number', v)} testId="field-invoice-number" />
        <TextField label="Invoice date" type="date" value={fields.invoice_date} onChange={(v) => setField('invoice_date', v)} testId="field-invoice-date" />
        <TextField label="Due date" type="date" value={fields.due_date} onChange={(v) => setField('due_date', v)} testId="field-due-date" />
      </div>
      <ItemsTable
        items={fields.items || []}
        columns={[
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'quantity', label: 'Qty', type: 'number' },
          { key: 'price', label: 'Price', type: 'number' },
        ]}
        setItemField={setItemField}
        addItem={addItem}
        removeItem={removeItem}
      />
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Subtotal" type="number" value={fields.subtotal} onChange={(v) => setField('subtotal', v)} testId="field-subtotal" />
        <TextField label="Tax" type="number" value={fields.tax} onChange={(v) => setField('tax', v)} testId="field-tax" />
        <TextField label="Total" type="number" value={fields.total} onChange={(v) => setField('total', v)} testId="field-total" />
      </div>
    </div>
  );
}

function BillForm({ fields, setField, setItemField, addItem, removeItem }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Vendor name" value={fields.vendor_name} onChange={(v) => setField('vendor_name', v)} testId="field-vendor-name" />
        <TextField label="Bill number" value={fields.bill_number} onChange={(v) => setField('bill_number', v)} testId="field-bill-number" />
        <TextField label="Bill date" type="date" value={fields.bill_date} onChange={(v) => setField('bill_date', v)} testId="field-bill-date" />
        <TextField label="Due date" type="date" value={fields.due_date} onChange={(v) => setField('due_date', v)} testId="field-due-date" />
      </div>
      <ItemsTable
        items={fields.items || []}
        columns={[
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'quantity', label: 'Qty', type: 'number' },
          { key: 'cost', label: 'Cost', type: 'number' },
        ]}
        setItemField={setItemField}
        addItem={addItem}
        removeItem={removeItem}
      />
      <TextField label="Total" type="number" value={fields.total} onChange={(v) => setField('total', v)} testId="field-total" />
    </div>
  );
}

function ExpenseForm({ fields, setField }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField label="Vendor name" value={fields.vendor_name} onChange={(v) => setField('vendor_name', v)} testId="field-vendor-name" />
      <TextField label="Date" type="date" value={fields.date} onChange={(v) => setField('date', v)} testId="field-date" />
      <TextField label="Amount" type="number" value={fields.amount} onChange={(v) => setField('amount', v)} testId="field-amount" />
      <TextField label="Category" value={fields.category} onChange={(v) => setField('category', v)} testId="field-category" />
      <TextField label="Payment method" value={fields.payment_method} onChange={(v) => setField('payment_method', v)} testId="field-payment-method" />
      <TextField label="Reference" value={fields.reference} onChange={(v) => setField('reference', v)} testId="field-reference" />
      <div className="col-span-2">
        <label className={labelCls} style={labelStyle}>Memo</label>
        <textarea
          value={fields.memo || ''}
          onChange={(e) => setField('memo', e.target.value)}
          rows={3}
          className={inputCls}
          style={inputStyle}
          data-testid="field-memo"
        />
      </div>
    </div>
  );
}

function StockReceiptForm({ fields, setField, setItemField, addItem, removeItem }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Vendor name" value={fields.vendor_name} onChange={(v) => setField('vendor_name', v)} testId="field-vendor-name" />
        <TextField label="Receive date" type="date" value={fields.date} onChange={(v) => setField('date', v)} testId="field-date" />
        <div className="col-span-2">
          <TextField label="Reference" value={fields.reference} onChange={(v) => setField('reference', v)} testId="field-reference" />
        </div>
      </div>
      <ItemsTable
        items={fields.items || []}
        columns={[
          { key: 'description', label: 'Product', type: 'text' },
          { key: 'quantity', label: 'Cases', type: 'number' },
          { key: 'unit_cost', label: 'Unit cost', type: 'number' },
        ]}
        setItemField={setItemField}
        addItem={addItem}
        removeItem={removeItem}
      />
    </div>
  );
}

function ItemsTable({ items, columns, setItemField, addItem, removeItem }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={labelCls} style={labelStyle}>Line items</label>
        <button
          onClick={addItem}
          type="button"
          className="text-xs flex items-center gap-1 px-2 py-1 rounded"
          style={{ color: '#0E7490' }}
          data-testid="review-add-item-btn"
        >
          <Plus size={12} /> Add item
        </button>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #F2F4F6' }}>
        <table className="w-full text-xs">
          <thead style={{ background: '#F7F9FB' }}>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left px-2 py-1.5 font-medium" style={{ color: '#434655' }}>{c.label}</th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-2 py-3 text-center" style={{ color: '#6B7280' }}>No items yet.</td>
              </tr>
            )}
            {items.map((it, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid #F2F4F6' }}>
                {columns.map((c) => (
                  <td key={c.key} className="px-1 py-1">
                    <input
                      type={c.type}
                      value={it[c.key] ?? ''}
                      onChange={(e) => setItemField(idx, c.key, c.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value)}
                      className="w-full px-2 py-1 rounded"
                      style={{ border: '1px solid transparent' }}
                      onFocus={(e) => (e.target.style.borderColor = '#C4C5D7')}
                      onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                      data-testid={`item-${idx}-${c.key}`}
                    />
                  </td>
                ))}
                <td className="px-1 py-1 text-right">
                  <button
                    onClick={() => removeItem(idx)}
                    type="button"
                    className="p-1 rounded hover:bg-[#FEF2F2]"
                    style={{ color: '#BA1A1A' }}
                    data-testid={`review-remove-item-${idx}`}
                  >
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
