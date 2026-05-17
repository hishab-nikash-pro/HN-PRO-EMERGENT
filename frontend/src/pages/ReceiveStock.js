import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getStockReceipts, createStockReceipt, postStockReceipt, getVendors, getProducts } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { Plus, X, CheckCircle, Warning, UploadSimple } from '@phosphor-icons/react';

const money = (v) => `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};
const emptyRow = () => ({ product_id: '', product_name: '', quantity: '', unit_cost: '' });
const emptyForm = () => ({
  vendor_id: '',
  vendor_name: '',
  supplier_name: '',
  reference: '',
  invoice_number: '',
  container_number: '',
  shipment_date: '',
  eta: '',
  receive_date: todayLocal(),
  warehouse: 'Main Warehouse',
  items: [emptyRow()],
  notes: '',
});

const sectionBorder = { borderColor: '#D5E1EC' };
const fieldStyle = {
  background: '#FFFFFF',
  border: '1px solid #B9C7D5',
  borderRadius: '3px',
  boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.08)',
  color: '#21384F',
  fontSize: '12px',
  minHeight: '25px',
  padding: '2px 6px',
};

function ReceiptCell({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-[9px] font-bold uppercase tracking-wide" style={{ color: '#526A84' }}>{label}</label>
      {children}
    </div>
  );
}

export default function ReceiveStock() {
  const navigate = useNavigate();
  const { receiptId } = useParams();
  const { selectedCompany } = useCompany();
  const [receipts, setReceipts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [postingId, setPostingId] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    if (!selectedCompany?.company_id) return;
    setLoading(true);
    try {
      const [receiptRes, vendorRes, productRes] = await Promise.all([
        getStockReceipts(selectedCompany.company_id),
        getVendors(selectedCompany.company_id),
        getProducts(selectedCompany.company_id),
      ]);
      setReceipts(Array.isArray(receiptRes.data) ? receiptRes.data : []);
      setVendors(Array.isArray(vendorRes.data) ? vendorRes.data : []);
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load receive stock data.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!receiptId || loading) return;
    requestAnimationFrame(() => {
      const element = document.getElementById(receiptId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [receiptId, receipts, loading]);

  const totalCost = useMemo(
    () => form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0), 0),
    [form.items],
  );

  const selectedVendor = useMemo(
    () => vendors.find((entry) => entry.vendor_id === form.vendor_id),
    [form.vendor_id, vendors]
  );

  const updateItem = (index, field, value) => {
    const nextItems = [...form.items];
    nextItems[index] = { ...nextItems[index], [field]: value };
    if (field === 'product_id') {
      const product = products.find((entry) => entry.product_id === value);
      nextItems[index].product_name = product?.name || nextItems[index].product_name;
      if (!nextItems[index].unit_cost && product?.cost_price) {
        nextItems[index].unit_cost = product.cost_price;
      }
    }
    setForm((current) => ({ ...current, items: nextItems }));
  };

  const addRow = () => setForm((current) => ({ ...current, items: [...current.items, emptyRow()] }));
  const removeRow = (index) => {
    const nextItems = form.items.filter((_, itemIndex) => itemIndex !== index);
    setForm((current) => ({ ...current, items: nextItems.length ? nextItems : [emptyRow()] }));
  };

  const validItems = form.items
    .map((item) => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      unit_cost: Number(item.unit_cost) || 0,
    }))
    .filter((item) => item.product_name.trim() && item.quantity > 0);

  const canSave = form.vendor_name.trim() && validItems.length > 0 && !saving;

  const handleSave = async (keepOpen = false) => {
    if (!canSave || !selectedCompany?.company_id) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        supplier_name: selectedVendor?.company_name || form.supplier_name || form.vendor_name,
        status: 'Draft',
        items: validItems,
        total_cost: Number(totalCost.toFixed(2)),
      };
      await createStockReceipt(selectedCompany.company_id, payload);
      setSuccessMsg('Draft stock receipt saved. Review it, then post to inventory when ready.');
      setForm(emptyForm());
      setShowCreate(true);
      await load();
      if (!keepOpen) {
        setShowCreate(false);
      }
    } catch (saveError) {
      console.error(saveError);
      setError(saveError?.response?.data?.detail || 'Failed to save draft receipt.');
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async (receiptId) => {
    if (!selectedCompany?.company_id || !receiptId) return;
    setPostingId(receiptId);
    setError('');
    try {
      await postStockReceipt(selectedCompany.company_id, receiptId);
      setSuccessMsg('Stock receipt posted. Inventory and product stock were updated.');
      await load();
    } catch (postError) {
      console.error(postError);
      setError(postError?.response?.data?.detail || 'Failed to post stock receipt.');
    } finally {
      setPostingId('');
    }
  };

  const openNew = () => {
    setForm(emptyForm());
    setError('');
    setShowCreate(true);
  };

  const receiptBadge = (receipt) => {
    const hasDraftProducts = (receipt.items || []).some((item) => item.match_status === 'draft_product');
    if (receipt.status === 'Posted') return { text: 'Posted', background: '#DCFCE7', color: '#166534' };
    if (hasDraftProducts) return { text: 'Needs Match', background: '#FFF7ED', color: '#C2410C' };
    return { text: 'Draft', background: '#DBEAFE', color: '#1D4ED8' };
  };

  return (
    <AppShell>
      <div data-testid="receive-stock-page" className="space-y-4">
        <div className="rounded-[18px] border bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,45,92,0.06)]" style={sectionBorder}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-[18px] font-bold" style={{ color: '#202020' }}>Receiving Inventory with Bill</h1>
              <p className="mt-1 text-[12px]" style={{ color: '#5B6F85' }}>Legacy bill-style entry screen backed by the current draft receipt and posting workflow.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate('/ai-import')}
                className="flex items-center gap-2 rounded px-3 py-2 text-[12px] font-bold"
                style={{ background: '#FFFFFF', color: '#2B415A', border: '1px solid #B7C7D9' }}
              >
                <UploadSimple size={15} weight="bold" /> Upload Packing List
              </button>
              <button
                data-testid="new-stock-receipt-btn"
                onClick={openNew}
                className="flex items-center gap-2 rounded px-3 py-2 text-[12px] font-bold text-white"
                style={{ background: 'linear-gradient(180deg, #0F68C8 0%, #0B4D96 100%)', border: '1px solid #0B4D96' }}
              >
                <Plus size={15} weight="bold" /> New Draft Receipt
              </button>
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm" style={{ background: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
            <CheckCircle size={18} weight="fill" /> {successMsg}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded border px-3 py-2 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' }}>
            <Warning size={16} weight="fill" /> {error}
          </div>
        )}

        {showCreate && (
          <div className="rounded-[18px] border bg-white p-3 shadow-[0_8px_20px_rgba(15,45,92,0.05)]" style={sectionBorder}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wide" style={{ color: '#5A7088' }}>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1"><input type="radio" checked readOnly /> Bill</label>
                <label className="flex items-center gap-1"><input type="radio" readOnly /> Credit</label>
              </div>
              <label className="flex items-center gap-1"><input type="checkbox" checked={validItems.length > 0} readOnly /> Bill Received</label>
            </div>

            <div className="rounded-md border p-2" style={{ ...sectionBorder, background: '#F7FBFF' }}>
              <div className="grid gap-3 xl:grid-cols-[430px_minmax(0,1fr)]">
                <div className="rounded border p-3" style={{ borderColor: '#DCE6F1', background: 'linear-gradient(180deg, #F8FBFF 0%, #EEF5FC 100%)' }}>
                  <div className="mb-2 text-[20px] leading-none" style={{ color: '#3C4C61' }}>Bill</div>
                  <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-2">
                      <ReceiptCell label="Vendor">
                        <select
                          value={form.vendor_id}
                          onChange={(event) => {
                            const vendor = vendors.find((entry) => entry.vendor_id === event.target.value);
                            setForm((current) => ({
                              ...current,
                              vendor_id: event.target.value,
                              vendor_name: vendor?.name || '',
                              supplier_name: vendor?.company_name || vendor?.name || '',
                            }));
                          }}
                          style={fieldStyle}
                        >
                          <option value="">Select vendor...</option>
                          {vendors.map((vendor) => <option key={vendor.vendor_id} value={vendor.vendor_id}>{vendor.name}</option>)}
                        </select>
                      </ReceiptCell>
                      <ReceiptCell label="Address">
                        <div className="min-h-[74px] rounded border px-2 py-2 text-[11px]" style={{ borderColor: '#C6D3E0', background: '#FFFFFF', color: '#334A63' }}>
                          {selectedVendor?.address || form.supplier_name || form.vendor_name || ''}
                        </div>
                      </ReceiptCell>
                      <div className="grid gap-2 md:grid-cols-[0.8fr_1.2fr]">
                        <ReceiptCell label="Terms">
                          <input value="Consign..." readOnly style={fieldStyle} />
                        </ReceiptCell>
                        <ReceiptCell label="Memo">
                          <input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} style={fieldStyle} />
                        </ReceiptCell>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <ReceiptCell label="Date">
                        <input type="date" value={form.receive_date} onChange={(event) => setForm((current) => ({ ...current, receive_date: event.target.value }))} style={fieldStyle} />
                      </ReceiptCell>
                      <ReceiptCell label="Ref. No.">
                        <input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} style={fieldStyle} />
                      </ReceiptCell>
                      <ReceiptCell label="Amount Due">
                        <input value={money(totalCost)} readOnly style={fieldStyle} />
                      </ReceiptCell>
                      <ReceiptCell label="Bill Due">
                        <input type="date" value={form.eta} onChange={(event) => setForm((current) => ({ ...current, eta: event.target.value }))} style={fieldStyle} />
                      </ReceiptCell>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <ReceiptCell label="Invoice No.">
                    <input value={form.invoice_number} onChange={(event) => setForm((current) => ({ ...current, invoice_number: event.target.value }))} style={fieldStyle} />
                  </ReceiptCell>
                  <ReceiptCell label="Container No.">
                    <input value={form.container_number} onChange={(event) => setForm((current) => ({ ...current, container_number: event.target.value }))} style={fieldStyle} />
                  </ReceiptCell>
                  <ReceiptCell label="Warehouse">
                    <input value={form.warehouse} onChange={(event) => setForm((current) => ({ ...current, warehouse: event.target.value }))} style={fieldStyle} />
                  </ReceiptCell>
                  <ReceiptCell label="Shipment Date">
                    <input type="date" value={form.shipment_date} onChange={(event) => setForm((current) => ({ ...current, shipment_date: event.target.value }))} style={fieldStyle} />
                  </ReceiptCell>
                  <ReceiptCell label="ETA">
                    <input type="date" value={form.eta} onChange={(event) => setForm((current) => ({ ...current, eta: event.target.value }))} style={fieldStyle} />
                  </ReceiptCell>
                  <ReceiptCell label="Supplier">
                    <input value={form.supplier_name} onChange={(event) => setForm((current) => ({ ...current, supplier_name: event.target.value }))} style={fieldStyle} />
                  </ReceiptCell>
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-6 border-b px-2 pb-1 text-[11px] font-bold" style={{ borderColor: '#D5E1EC', color: '#50657D' }}>
              <span>Expenses</span>
              <span style={{ color: '#2B415A' }}>{money(0)}</span>
              <span>Items</span>
              <span style={{ color: '#2B415A' }}>{money(totalCost)}</span>
            </div>

            <div className="mt-2 overflow-x-auto rounded border" style={{ borderColor: '#D5E1EC' }}>
              <table className="w-full min-w-[980px] text-[12px]">
                <thead>
                  <tr style={{ background: '#FBFDFF', borderBottom: '1px solid #D5E1EC' }}>
                    <th className="px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Item</th>
                    <th className="px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Description</th>
                    <th className="px-2 py-1 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Qty</th>
                    <th className="px-2 py-1 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Cost</th>
                    <th className="px-2 py-1 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Amount</th>
                    <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>U/M</th>
                    <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Customer:Job</th>
                    <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Billable?</th>
                    <th className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>X</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => {
                    const product = products.find((entry) => entry.product_id === item.product_id);
                    return (
                      <tr key={index} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#EAF3FF', borderBottom: '1px solid #DCE6F2' }}>
                        <td className="px-2 py-1.5 align-top">
                          <select value={item.product_id} onChange={(event) => updateItem(index, 'product_id', event.target.value)} style={fieldStyle}>
                            <option value="">Select product...</option>
                            {products.map((entry) => (
                              <option key={entry.product_id} value={entry.product_id}>
                                {entry.name}{entry.sku ? ` (${entry.sku})` : ''}
                              </option>
                            ))}
                          </select>
                          <input className="mt-1 w-full" value={item.product_name} onChange={(event) => updateItem(index, 'product_name', event.target.value)} placeholder="Manual item name" style={fieldStyle} />
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <div className="min-h-[52px] rounded border px-2 py-1 text-[11px]" style={{ borderColor: '#C6D3E0', background: '#FFFFFF', color: '#2C435B' }}>
                            {product?.packing_text || product?.description || item.product_name || ''}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className="w-full text-right" style={fieldStyle} />
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => updateItem(index, 'unit_cost', event.target.value)} className="w-full text-right" style={fieldStyle} />
                        </td>
                        <td className="px-2 py-1.5 text-right align-top font-semibold tabular-nums" style={{ color: '#20384F' }}>
                          {money((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0))}
                        </td>
                        <td className="px-2 py-1.5 text-center align-top" style={{ color: '#20384F' }}>{String(product?.unit_label || product?.unit_type || 'PCS').toUpperCase()}</td>
                        <td className="px-2 py-1.5 text-center align-top" style={{ color: '#73889C' }}>-</td>
                        <td className="px-2 py-1.5 text-center align-top" style={{ color: '#73889C' }}>-</td>
                        <td className="px-2 py-1.5 text-center align-top">
                          <button onClick={() => removeRow(index)} className="rounded p-1" style={{ color: '#B42318' }}>
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <button onClick={addRow} className="flex items-center gap-1 rounded px-2 py-1 text-[12px] font-bold" style={{ color: '#0F4D96', border: '1px solid #B7C7D9', background: '#FFFFFF' }}>
                <Plus size={12} /> Add Line
              </button>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#657B92' }}>Estimated Total Cost</div>
                <div className="text-[20px] font-bold tabular-nums" style={{ color: '#1E3650' }}>{money(totalCost)}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3" style={{ borderColor: '#D5E1EC' }}>
              <button onClick={() => { handleSave(false); }} disabled={!canSave} className="rounded px-4 py-1.5 text-[12px] font-bold" style={{ background: '#F3F6FA', color: '#40556D', border: '1px solid #C8D4E1', opacity: canSave ? 1 : 0.6 }}>
                {saving ? 'Saving...' : 'Save & Close'}
              </button>
              <button onClick={() => { handleSave(true); }} disabled={!canSave} className="rounded px-4 py-1.5 text-[12px] font-bold text-white" style={{ background: 'linear-gradient(180deg, #6793D4 0%, #2E66B4 100%)', border: '1px solid #2E66B4', opacity: canSave ? 1 : 0.6 }}>
                {saving ? 'Saving...' : 'Save & New'}
              </button>
              <button onClick={() => setForm(emptyForm())} className="rounded px-4 py-1.5 text-[12px] font-bold" style={{ background: '#F3F6FA', color: '#40556D', border: '1px solid #C8D4E1' }}>
                Revert
              </button>
            </div>
          </div>
        )}

        <div className="rounded-[18px] border bg-white p-3 shadow-[0_6px_18px_rgba(15,45,92,0.04)]" style={sectionBorder}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-bold" style={{ color: '#22384F' }}>Recent Receipts</h2>
              <p className="text-[11px]" style={{ color: '#5B7087' }}>Draft and posted receipts remain available below for review and posting.</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="overflow-x-auto rounded border" style={{ borderColor: '#D5E1EC' }}>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ background: '#FBFDFF', borderBottom: '1px solid #D5E1EC' }}>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Date</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Vendor</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Reference / Container</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Status</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Lines</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Total Cost</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: '#70859A' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm" style={{ color: '#475569' }}>
                        No stock receipts yet. Upload a packing list or create a manual draft.
                      </td>
                    </tr>
                  ) : receipts.map((receipt, index) => {
                    const badge = receiptBadge(receipt);
                    return (
                      <tr id={receipt.receipt_id} key={receipt.receipt_id} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#EDF5FF', borderBottom: '1px solid #DCE6F2' }}>
                        <td className="px-3 py-2" style={{ color: '#20384F' }}>{receipt.receive_date || '-'}</td>
                        <td className="px-3 py-2 font-semibold" style={{ color: '#20384F' }}>{receipt.vendor_name || '-'}</td>
                        <td className="px-3 py-2" style={{ color: '#50657D' }}>
                          <div>{receipt.reference || '-'}</div>
                          {receipt.container_number ? <div className="text-[11px]">{receipt.container_number}</div> : null}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: badge.background, color: badge.color }}>
                            {badge.text}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums" style={{ color: '#20384F' }}>{(receipt.items || []).length}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ color: '#0F2D5C' }}>{money(receipt.total_cost)}</td>
                        <td className="px-3 py-2 text-right">
                          {receipt.status === 'Posted' ? (
                            <span className="text-[11px] font-semibold" style={{ color: '#166534' }}>Posted</span>
                          ) : (
                            <button
                              onClick={() => handlePost(receipt.receipt_id)}
                              disabled={postingId === receipt.receipt_id}
                              className="rounded px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                              style={{ background: '#0F2D5C', border: '1px solid #0F2D5C' }}
                            >
                              {postingId === receipt.receipt_id ? 'Posting...' : 'Post to Inventory'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
