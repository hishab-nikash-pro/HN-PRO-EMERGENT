import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getCustomers, getProducts, createInvoice } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash, FloppyDisk } from '@phosphor-icons/react';

const emptyItem = { product: '', description: '', quantity: 1, unit: 'pcs', rate: 0, discount: 0, tax: 0, amount: 0 };

export default function CreateInvoice() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    customer_id: '', customer_name: '', invoice_date: new Date().toISOString().split('T')[0],
    due_date: '', sales_rep: '', warehouse: 'Main Warehouse', notes: '', terms: 'Net 30',
  });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedCompany) return;
    getCustomers(selectedCompany.company_id).then(res => setCustomers(res.data)).catch(() => {});
    getProducts(selectedCompany.company_id).then(res => setProducts(res.data)).catch(() => {});
  }, [selectedCompany]);

  // Load extracted data from AI if available
  useEffect(() => {
    const ext = location.state?.extractedData;
    if (ext) {
      setForm(prev => ({
        ...prev,
        customer_name: ext.customer_name || '',
        invoice_date: ext.invoice_date || prev.invoice_date,
        due_date: ext.due_date || '',
        notes: ext.notes || '',
      }));
      if (ext.items?.length) {
        setItems(ext.items.map(it => ({
          product: it.product || '', description: it.description || '',
          quantity: it.quantity || 1, unit: it.unit || 'pcs',
          rate: it.rate || 0, discount: 0, tax: (it.amount || 0) * 0.08,
          amount: it.amount || 0,
        })));
      }
    }
  }, [location.state]);

  const updateItem = (idx, field, value) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'quantity' || field === 'rate' || field === 'discount') {
      const q = parseFloat(updated[idx].quantity) || 0;
      const r = parseFloat(updated[idx].rate) || 0;
      const d = parseFloat(updated[idx].discount) || 0;
      updated[idx].amount = q * r - d;
      updated[idx].tax = (q * r - d) * 0.08;
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (idx) => { if (items.length > 1) setItems(items.filter((_, i) => i !== idx)); };

  const subtotal = items.reduce((s, it) => s + (it.amount || 0), 0);
  const taxTotal = items.reduce((s, it) => s + (it.tax || 0), 0);
  const discountTotal = items.reduce((s, it) => s + (parseFloat(it.discount) || 0), 0);
  const total = subtotal + taxTotal;

  const handleSave = async (status = 'Draft') => {
    if (!form.customer_id) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        items,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_total: Math.round(taxTotal * 100) / 100,
        discount_total: Math.round(discountTotal * 100) / 100,
        total: Math.round(total * 100) / 100,
        status,
        payment_status: 'Unpaid',
        amount_paid: 0,
      };
      const res = await createInvoice(selectedCompany.company_id, payload);
      navigate(`/sales/${res.data.invoice_id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCustomerChange = (custId) => {
    const c = customers.find(x => x.customer_id === custId);
    setForm({ ...form, customer_id: custId, customer_name: c?.name || '' });
  };

  return (
    <AppShell>
      <div data-testid="create-invoice-page" className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/sales')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Create Invoice</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>New sales invoice for {selectedCompany?.short_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="save-draft-btn"
              onClick={() => handleSave('Draft')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
              style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
            >
              <FloppyDisk size={16} /> Save Draft
            </button>
            <button
              data-testid="send-invoice-btn"
              onClick={() => handleSave('Sent')}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
            >
              Send Invoice
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Invoice Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Customer</label>
                  <select
                    data-testid="invoice-customer-select"
                    value={form.customer_id}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Invoice Date</label>
                  <input
                    data-testid="invoice-date"
                    type="date"
                    value={form.invoice_date}
                    onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Due Date</label>
                  <input
                    data-testid="invoice-due-date"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Sales Rep</label>
                  <input
                    data-testid="invoice-sales-rep"
                    type="text"
                    value={form.sales_rep}
                    onChange={(e) => setForm({ ...form, sales_rep: e.target.value })}
                    placeholder="Sales representative"
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Warehouse</label>
                  <select
                    data-testid="invoice-warehouse"
                    value={form.warehouse}
                    onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                  >
                    <option>Main Warehouse</option>
                    <option>Cold Storage A</option>
                    <option>Distribution Center</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Line Items</h3>
                <button data-testid="add-line-item-btn" onClick={addItem} className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0F2D5C' }}>
                  <Plus size={14} /> Add Item
                </button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg" style={{ background: '#F7F9FB' }}>
                    <div className="col-span-3">
                      {idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Product</label>}
                      <select
                        data-testid={`item-product-${idx}`}
                        value={item.product}
                        onChange={(e) => {
                          const selected = products.find(p => p.name === e.target.value);
                          if (selected) {
                            updateItem(idx, 'product', selected.name);
                            const updated = [...items];
                            updated[idx] = { ...updated[idx], product: selected.name, description: selected.description || selected.weight_info || '', rate: selected.selling_price || 0, unit: selected.unit || 'pcs' };
                            const q = parseFloat(updated[idx].quantity) || 0;
                            const r = selected.selling_price || 0;
                            updated[idx].amount = q * r;
                            updated[idx].tax = (q * r) * 0.08;
                            setItems(updated);
                          } else {
                            updateItem(idx, 'product', e.target.value);
                          }
                        }}
                        className="w-full px-2 py-2 text-xs rounded-md focus:outline-none focus:ring-1"
                        style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                      >
                        <option value="">Select product...</option>
                        {products.map(p => <option key={p.product_id} value={p.name}>{p.name} (${p.selling_price})</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Description</label>}
                      <input
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        placeholder="Description"
                        className="w-full px-2 py-2 text-xs rounded-md focus:outline-none focus:ring-1"
                        style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                      />
                    </div>
                    <div className="col-span-1">
                      {idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Qty</label>}
                      <input
                        data-testid={`item-qty-${idx}`}
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-2 text-xs rounded-md text-right focus:outline-none focus:ring-1"
                        style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                      />
                    </div>
                    <div className="col-span-1">
                      {idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Unit</label>}
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className="w-full px-1 py-2 text-xs rounded-md focus:outline-none focus:ring-1"
                        style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                      >
                        <option>pcs</option><option>kg</option><option>lb</option><option>box</option><option>case</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Rate</label>}
                      <input
                        data-testid={`item-rate-${idx}`}
                        type="number"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateItem(idx, 'rate', e.target.value)}
                        className="w-full px-2 py-2 text-xs rounded-md text-right focus:outline-none focus:ring-1"
                        style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                      />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <label className="block text-[10px] font-medium mb-1" style={{ color: '#434655' }}>Amount</label>}
                      <div className="px-2 py-2 text-xs text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                        ${(item.amount || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="p-1.5 rounded hover:bg-[#fef2f2] transition-colors" style={{ color: '#BA1A1A' }}>
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Summary */}
          <div className="space-y-6">
            <div className="rounded-2xl p-6 sticky top-24" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#434655' }}>Subtotal</span>
                  <span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#434655' }}>Tax (8%)</span>
                  <span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${taxTotal.toFixed(2)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: '#434655' }}>Discount</span>
                    <span className="font-medium tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>-${discountTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-3 flex justify-between" style={{ borderTop: '1px solid #E6E8EA' }}>
                  <span className="text-sm font-semibold" style={{ color: '#191C1E' }}>Total</span>
                  <span className="text-lg font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Terms</label>
                <select
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                  style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                >
                  <option>Net 30</option><option>Net 15</option><option>Net 60</option><option>Due on Receipt</option>
                </select>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Notes</label>
                <textarea
                  data-testid="invoice-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Internal notes..."
                  className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1 resize-none"
                  style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
