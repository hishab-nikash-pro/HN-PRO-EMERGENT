import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Export, MagnifyingGlass, Plus, Printer, Trash } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import DateFilterPreset from '../components/DateFilterPreset';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { useCompany } from '../contexts/CompanyContext';
import { createSalesOrder, deleteSalesOrder, getCustomers, getSalesOrders, getProducts } from '../lib/api';
import { downloadCSV, printReport } from '../lib/exportUtils';

const STATUS_STYLES = {
  Draft: { bg: '#F2F4F6', color: '#434655' },
  Confirmed: { bg: '#dbeafe', color: '#0F2D5C' },
  'Partially Fulfilled': { bg: '#fef3c7', color: '#92400e' },
  Fulfilled: { bg: '#dcfce7', color: '#166534' },
  Cancelled: { bg: '#fef2f2', color: '#BA1A1A' },
};

const emptyLine = { product_id: '', product_name: '', description: '', quantity: 1, unit: 'pcs', rate: 0, amount: 0 };

export default function SalesOrdersList() {
  const { selectedCompany, can } = useCompany();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [form, setForm] = useState({
    customer_id: '',
    customer_name: '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_date: '',
    reference: '',
    shipping_address: '',
    notes: '',
    status: 'Draft',
    items: [{ ...emptyLine }],
  });

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const [orderRes, customerRes, productRes] = await Promise.all([
        getSalesOrders(selectedCompany.company_id, statusFilter ? { status: statusFilter } : undefined),
        getCustomers(selectedCompany.company_id),
        getProducts(selectedCompany.company_id),
      ]);
      setOrders(orderRes.data);
      setCustomers(customerRes.data);
      setProducts(productRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedCompany, statusFilter]);

  const filtered = orders.filter((order) => {
    const needle = search.toLowerCase();
    const matchesSearch = !needle || order.sales_order_number?.toLowerCase().includes(needle) || order.customer_name?.toLowerCase().includes(needle) || order.reference?.toLowerCase().includes(needle);
    const matchesDate = !dateRange.start || !dateRange.end || (order.order_date >= dateRange.start && order.order_date <= dateRange.end);
    return matchesSearch && matchesDate;
  });

  const recompute = (items) => {
    const nextItems = items.map((item) => ({ ...item, amount: (Number(item.quantity) || 0) * (Number(item.rate) || 0) }));
    const subtotal = nextItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return { items: nextItems, subtotal, total: subtotal, tax_total: 0, discount_total: 0 };
  };

  const handleCreate = async () => {
    const totals = recompute(form.items);
    await createSalesOrder(selectedCompany.company_id, { ...form, ...totals });
    setShowCreate(false);
    setForm({
      customer_id: '',
      customer_name: '',
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: '',
      reference: '',
      shipping_address: '',
      notes: '',
      status: 'Draft',
      items: [{ ...emptyLine }],
    });
    load();
  };

  const handleDeleteSalesOrder = async () => {
    if (!deleteTarget || !selectedCompany?.company_id) return;
    setDeleting(true);
    try {
      await deleteSalesOrder(selectedCompany.company_id, deleteTarget.sales_order_id);
      await load();
      setFeedback({ type: 'success', message: `${deleteTarget.sales_order_number} was moved to deleted records.` });
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Unable to delete this sales order.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6" data-testid="sales-orders-page">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Sales Orders</h1>
            <p className="text-sm mt-1" style={{ color: '#475569' }}>Track customer orders before invoicing and fulfillment.</p>
          </div>
          {can.write && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <Plus size={16} weight="bold" /> New Sales Order
            </button>
          )}
        </div>

        {feedback && (
          <div className="rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48' }}>
            {feedback.message}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders..." className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1' }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1" style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #CBD5E1' }}>
            <option value="">All Statuses</option>
            <option>Draft</option>
            <option>Confirmed</option>
            <option>Partially Fulfilled</option>
            <option>Fulfilled</option>
            <option>Cancelled</option>
          </select>
          <button onClick={() => downloadCSV('sales-orders.csv', filtered, ['sales_order_number', 'customer_name', 'order_date', 'expected_date', 'status', 'total'])} className="p-2 rounded-lg hover:bg-white" style={{ color: '#475569' }}><Export size={18} /></button>
          <button onClick={printReport} className="p-2 rounded-lg hover:bg-white" style={{ color: '#475569' }}><Printer size={18} /></button>
        </div>

        <DateFilterPreset onDateChange={(start, end) => setDateRange({ start, end })} storageKey="sales_orders_date_filter" defaultPreset="this_month" />

        <div className="hidden md:block rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Order #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Order Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Expected</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10" style={{ color: '#64748B' }}>No sales orders found.</td></tr>
                ) : filtered.map((order, index) => {
                  const style = STATUS_STYLES[order.status] || STATUS_STYLES.Draft;
                  return (
                    <tr key={order.sales_order_id} onClick={() => navigate(`/sales-orders/${order.sales_order_id}`)} className="cursor-pointer hover:bg-[#F8FAFC]" style={{ borderBottom: '1px solid #F1F5F9', background: index % 2 === 0 ? '#FFFFFF' : '#FCFDFE' }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{order.sales_order_number}</td>
                      <td className="px-4 py-3" style={{ color: '#191C1E' }}>{order.customer_name}</td>
                      <td className="px-4 py-3" style={{ color: '#475569' }}>{order.order_date}</td>
                      <td className="px-4 py-3" style={{ color: '#475569' }}>{order.expected_date || '—'}</td>
                      <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: style.bg, color: style.color }}>{order.status}</span></td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: '#191C1E' }}>${Number(order.total || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {can.admin ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(order);
                            }}
                            className="rounded-lg p-1.5 hover:bg-[#FEF2F2]"
                            style={{ color: '#B42318' }}
                          >
                            <Trash size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 rounded-xl bg-white">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl p-6 text-center text-sm" style={{ background: '#FFFFFF', color: '#64748B' }}>No sales orders found.</div>
          ) : filtered.map((order) => {
            const style = STATUS_STYLES[order.status] || STATUS_STYLES.Draft;
            return (
              <button key={order.sales_order_id} onClick={() => navigate(`/sales-orders/${order.sales_order_id}`)} className="w-full rounded-xl p-4 text-left" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: '#0F2D5C' }}>{order.sales_order_number}</p>
                    <p className="mt-1 truncate text-sm" style={{ color: '#191C1E' }}>{order.customer_name}</p>
                    <p className="mt-1 text-xs" style={{ color: '#64748B' }}>{order.order_date} • Expected {order.expected_date || '—'}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: style.bg, color: style.color }}>{order.status}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span style={{ color: '#64748B' }}>Total</span>
                  <span className="font-semibold" style={{ color: '#191C1E' }}>${Number(order.total || 0).toFixed(2)}</span>
                </div>
                {can.admin && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(order);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: '#FEF2F2', color: '#B42318' }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="w-full max-w-4xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF' }}>
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>New Sales Order</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Customer">
                  <select value={form.customer_id} onChange={(e) => {
                    const customer = customers.find((item) => item.customer_id === e.target.value);
                    setForm((prev) => ({ ...prev, customer_id: e.target.value, customer_name: customer?.name || '', shipping_address: customer?.address || '' }));
                  }} className={inputClass}>
                    <option value="">Select customer</option>
                    {customers.map((customer) => <option key={customer.customer_id} value={customer.customer_id}>{customer.name}</option>)}
                  </select>
                </Field>
                <Field label="Reference"><input value={form.reference} onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))} className={inputClass} /></Field>
                <Field label="Order Date"><input type="date" value={form.order_date} onChange={(e) => setForm((prev) => ({ ...prev, order_date: e.target.value }))} className={inputClass} /></Field>
                <Field label="Expected Date"><input type="date" value={form.expected_date} onChange={(e) => setForm((prev) => ({ ...prev, expected_date: e.target.value }))} className={inputClass} /></Field>
                <Field label="Shipping Address"><textarea value={form.shipping_address} onChange={(e) => setForm((prev) => ({ ...prev, shipping_address: e.target.value }))} className={inputClass} rows={2} /></Field>
                <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className={inputClass} rows={2} /></Field>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Line Items</h3>
                  <button onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyLine }] }))} className="text-sm font-medium" style={{ color: '#0E7490' }}>+ Add line</button>
                </div>
                {form.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <select value={item.product_id} onChange={(e) => {
                      const product = products.find((entry) => entry.product_id === e.target.value);
                      const items = [...form.items];
                      items[index] = { ...items[index], product_id: e.target.value, product_name: product?.name || '', description: product?.description || '', rate: product?.selling_price || 0 };
                      setForm((prev) => ({ ...prev, ...recompute(items) }));
                    }} className={`${inputClass} col-span-3`}>
                      <option value="">Product</option>
                      {products.map((product) => <option key={product.product_id} value={product.product_id}>{product.name}</option>)}
                    </select>
                    <input value={item.description} onChange={(e) => {
                      const items = [...form.items];
                      items[index].description = e.target.value;
                      setForm((prev) => ({ ...prev, items }));
                    }} placeholder="Description" className={`${inputClass} col-span-4`} />
                    <input type="number" value={item.quantity} onChange={(e) => {
                      const items = [...form.items];
                      items[index].quantity = Number(e.target.value) || 0;
                      setForm((prev) => ({ ...prev, ...recompute(items) }));
                    }} className={`${inputClass} col-span-2`} />
                    <input type="number" value={item.rate} onChange={(e) => {
                      const items = [...form.items];
                      items[index].rate = Number(e.target.value) || 0;
                      setForm((prev) => ({ ...prev, ...recompute(items) }));
                    }} className={`${inputClass} col-span-2`} />
                    <div className="col-span-1 flex items-center justify-end text-sm font-semibold" style={{ color: '#191C1E' }}>${Number(item.amount || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm" style={{ color: '#64748B' }}>Subtotal: <strong style={{ color: '#191C1E' }}>${Number(recompute(form.items).subtotal || 0).toFixed(2)}</strong></div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#475569' }}>Cancel</button>
                  <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>Save Sales Order</button>
                </div>
              </div>
            </div>
          </div>
        )}
        <ConfirmDeleteModal open={Boolean(deleteTarget)} onCancel={() => setDeleteTarget(null)} onConfirm={handleDeleteSalesOrder} loading={deleting} />
      </div>
    </AppShell>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1';
