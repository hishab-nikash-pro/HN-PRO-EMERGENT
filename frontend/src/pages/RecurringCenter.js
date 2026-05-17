import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import {
  createRecurringTemplate,
  getCustomers,
  getRecurringTemplates,
  getReminders,
  getVendors,
  runDueRecurringTemplates,
  runRecurringTemplate,
} from '../lib/api';
import { ArrowsClockwise, Bell, CalendarDots, Plus, ArrowLeft } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

const initialForm = {
  name: '',
  template_type: 'invoice',
  status: 'Active',
  frequency: 'monthly',
  interval: 1,
  day_of_month: new Date().getDate(),
  start_date: new Date().toISOString().split('T')[0],
  auto_run: true,
  reminder_days_before: 3,
  overdue_days_after: 1,
  template_payload: {
    customer_id: '',
    customer_name: '',
    vendor_id: '',
    vendor_name: '',
    terms: 'Net 30',
    warehouse: 'Main Warehouse',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    notes: '',
    total: 0,
    subtotal: 0,
    tax_total: 0,
    discount_total: 0,
  },
  notes: '',
};

function computeTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || (Number(item.quantity) || 0) * (Number(item.rate) || 0)), 0);
  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax_total: 0,
    discount_total: 0,
    total: Number(subtotal.toFixed(2)),
  };
}

export default function RecurringCenter() {
  const { selectedCompany } = useCompany();
  const [templates, setTemplates] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [resultMessage, setResultMessage] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const [templateRes, reminderRes, customerRes, vendorRes] = await Promise.all([
        getRecurringTemplates(selectedCompany.company_id),
        getReminders(selectedCompany.company_id),
        getCustomers(selectedCompany.company_id),
        getVendors(selectedCompany.company_id),
      ]);
      setTemplates(templateRes.data || []);
      setReminders(reminderRes.data || []);
      setCustomers(customerRes.data || []);
      setVendors(vendorRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedCompany]);

  const summary = useMemo(() => ({
    active: templates.filter((template) => template.status === 'Active').length,
    dueSoon: reminders.filter((item) => item.reminder_kind === 'due_soon').length,
    overdue: reminders.filter((item) => item.reminder_kind === 'overdue').length,
  }), [templates, reminders]);

  const updatePayload = (changes) => {
    setForm((prev) => ({ ...prev, template_payload: { ...prev.template_payload, ...changes } }));
  };

  const updateLineItem = (index, field, value) => {
    const nextItems = [...form.template_payload.items];
    nextItems[index] = { ...nextItems[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      nextItems[index].amount = (Number(nextItems[index].quantity) || 0) * (Number(nextItems[index].rate) || 0);
    }
    updatePayload({ items: nextItems, ...computeTotals(nextItems) });
  };

  const handleTemplateTypeChange = (templateType) => {
    setForm((prev) => ({
      ...prev,
      template_type: templateType,
      name: '',
      template_payload: {
        ...prev.template_payload,
        customer_id: '',
        customer_name: '',
        vendor_id: '',
        vendor_name: '',
      },
    }));
  };

  const handleCreate = async () => {
    const payload = {
      ...form,
      interval: Number(form.interval) || 1,
      day_of_month: Number(form.day_of_month) || 1,
      reminder_days_before: Number(form.reminder_days_before) || 3,
      overdue_days_after: Number(form.overdue_days_after) || 1,
      template_payload: {
        ...form.template_payload,
        ...computeTotals(form.template_payload.items),
        status: form.template_type === 'invoice' ? 'Draft' : 'Open',
      },
    };
    await createRecurringTemplate(selectedCompany.company_id, payload);
    setResultMessage(`Recurring ${form.template_type} template created.`);
    setShowCreate(false);
    setForm(initialForm);
    await load();
  };

  const handleRunSchedule = async () => {
    setRunning(true);
    try {
      const res = await runDueRecurringTemplates(selectedCompany.company_id);
      const generatedCount = (res.data?.generated || []).length;
      setResultMessage(generatedCount ? `Generated ${generatedCount} scheduled record(s).` : 'No schedules were due today.');
      await load();
    } finally {
      setRunning(false);
    }
  };

  const handleRunTemplate = async (templateId) => {
    await runRecurringTemplate(selectedCompany.company_id, templateId);
    setResultMessage('Template run completed.');
    await load();
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Recurring & Reminders</h1>
              <p className="text-sm mt-1" style={{ color: '#434655' }}>Recurring invoices, recurring bills, and due follow-up visibility for {selectedCompany?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRunSchedule} disabled={running} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#EFF6FF', color: '#0F2D5C' }}>
              <ArrowsClockwise size={16} className={running ? 'animate-spin' : ''} />
              {running ? 'Running...' : 'Run Due Schedules'}
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <Plus size={16} />
              New Recurring Template
            </button>
          </div>
        </div>

        {resultMessage && (
          <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: '#ECFDF3', color: '#166534' }}>
            {resultMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard title="Active Templates" value={summary.active} icon={CalendarDots} tone="#0F2D5C" />
          <SummaryCard title="Due Soon Reminders" value={summary.dueSoon} icon={Bell} tone="#0E7490" />
          <SummaryCard title="Overdue Reminders" value={summary.overdue} icon={Bell} tone="#BA1A1A" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Recurring Templates</h2>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
              </div>
            ) : templates.length === 0 ? (
              <div className="px-5 py-12 text-sm text-center" style={{ color: '#64748B' }}>No recurring templates yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #E6E8EA' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Template</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Frequency</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Next Run</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Generated</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#475569' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template, index) => (
                    <tr key={template.template_id} style={{ borderBottom: '1px solid #F2F4F6', background: index % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: '#191C1E' }}>{template.name}</div>
                        <div className="text-xs" style={{ color: '#64748B' }}>{template.status}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#191C1E' }}>{template.template_type}</td>
                      <td className="px-4 py-3" style={{ color: '#191C1E' }}>{template.frequency} / every {template.interval}</td>
                      <td className="px-4 py-3" style={{ color: '#191C1E' }}>{template.next_run_date || '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#191C1E' }}>{template.generated_count || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleRunTemplate(template.template_id)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: '#EFF6FF', color: '#0F2D5C' }}>
                          Run Now
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #E6E8EA' }}>
              <h2 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Open Reminders</h2>
            </div>
            <div className="max-h-[32rem] overflow-y-auto">
              {reminders.length === 0 ? (
                <div className="px-5 py-10 text-sm text-center" style={{ color: '#64748B' }}>No due or overdue reminders right now.</div>
              ) : reminders.map((item) => (
                <div key={item.reminder_id} className="px-5 py-4" style={{ borderBottom: '1px solid #F2F4F6' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#191C1E' }}>{item.title}</p>
                      <p className="text-xs mt-1" style={{ color: '#64748B' }}>{item.summary}</p>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: item.reminder_kind === 'overdue' ? '#FEF2F2' : '#EFF6FF', color: item.reminder_kind === 'overdue' ? '#BA1A1A' : '#0F2D5C' }}>
                      {item.reminder_kind === 'overdue' ? 'Overdue' : 'Due Soon'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs" style={{ color: '#64748B' }}>
                    <span>{item.record_type} • due {item.due_date}</span>
                    <span>${Number(item.amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" style={{ background: 'rgba(25,28,30,0.55)' }}>
            <div className="w-full max-w-4xl rounded-3xl p-6 overflow-y-auto max-h-[90vh]" style={{ background: '#FFFFFF' }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: '#191C1E', fontFamily: 'Manrope, sans-serif' }}>New Recurring Template</h3>
                  <p className="text-sm mt-1" style={{ color: '#64748B' }}>Create a scheduled invoice or bill draft with built-in reminders.</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="px-3 py-2 rounded-lg text-sm" style={{ background: '#F2F4F6', color: '#475569' }}>Close</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Template Name">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} />
                </Field>
                <Field label="Template Type">
                  <select value={form.template_type} onChange={(e) => handleTemplateTypeChange(e.target.value)} className={inputClass} style={inputStyle}>
                    <option value="invoice">Recurring Invoice</option>
                    <option value="bill">Recurring Bill</option>
                  </select>
                </Field>
                <Field label={form.template_type === 'invoice' ? 'Customer' : 'Vendor'}>
                  {form.template_type === 'invoice' ? (
                    <select value={form.template_payload.customer_id} onChange={(e) => {
                      const customer = customers.find((item) => item.customer_id === e.target.value);
                      updatePayload({ customer_id: e.target.value, customer_name: customer?.name || '' });
                    }} className={inputClass} style={inputStyle}>
                      <option value="">Select customer</option>
                      {customers.map((customer) => <option key={customer.customer_id} value={customer.customer_id}>{customer.name}</option>)}
                    </select>
                  ) : (
                    <select value={form.template_payload.vendor_id} onChange={(e) => {
                      const vendor = vendors.find((item) => item.vendor_id === e.target.value);
                      updatePayload({ vendor_id: e.target.value, vendor_name: vendor?.name || '' });
                    }} className={inputClass} style={inputStyle}>
                      <option value="">Select vendor</option>
                      {vendors.map((vendor) => <option key={vendor.vendor_id} value={vendor.vendor_id}>{vendor.name}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Start Date">
                  <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputClass} style={inputStyle} />
                </Field>
                <Field label="Frequency">
                  <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={inputClass} style={inputStyle}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </Field>
                <Field label="Every">
                  <input type="number" min="1" value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className={inputClass} style={inputStyle} />
                </Field>
                <Field label="Day of Month">
                  <input type="number" min="1" max="31" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} className={inputClass} style={inputStyle} />
                </Field>
                <Field label="Reminder Days Before Due">
                  <input type="number" min="0" value={form.reminder_days_before} onChange={(e) => setForm({ ...form, reminder_days_before: e.target.value })} className={inputClass} style={inputStyle} />
                </Field>
                <Field label="Overdue Reminder After">
                  <input type="number" min="1" value={form.overdue_days_after} onChange={(e) => setForm({ ...form, overdue_days_after: e.target.value })} className={inputClass} style={inputStyle} />
                </Field>
                <Field label={form.template_type === 'invoice' ? 'Terms' : 'Notes'}>
                  <input value={form.template_type === 'invoice' ? form.template_payload.terms : form.template_payload.notes} onChange={(e) => updatePayload(form.template_type === 'invoice' ? { terms: e.target.value } : { notes: e.target.value })} className={inputClass} style={inputStyle} />
                </Field>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold" style={{ color: '#191C1E' }}>Recurring Line Items</h4>
                  <button onClick={() => updatePayload({ items: [...form.template_payload.items, { description: '', quantity: 1, rate: 0, amount: 0 }] })} className="text-xs font-medium" style={{ color: '#0F2D5C' }}>
                    <Plus size={12} className="inline mr-1" />
                    Add line
                  </button>
                </div>
                <div className="space-y-2">
                  {form.template_payload.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2">
                      <input placeholder="Description" value={item.description} onChange={(e) => updateLineItem(index, 'description', e.target.value)} className={inputClass} style={inputStyle} />
                      <input type="number" min="0" step="0.01" placeholder="Qty" value={item.quantity} onChange={(e) => updateLineItem(index, 'quantity', e.target.value)} className={inputClass} style={inputStyle} />
                      <input type="number" min="0" step="0.01" placeholder="Rate" value={item.rate} onChange={(e) => updateLineItem(index, 'rate', e.target.value)} className={inputClass} style={inputStyle} />
                      <input type="number" min="0" step="0.01" placeholder="Amount" value={item.amount} onChange={(e) => updateLineItem(index, 'amount', e.target.value)} className={inputClass} style={inputStyle} />
                    </div>
                  ))}
                </div>
                <div className="text-right mt-3 text-sm font-semibold" style={{ color: '#191C1E' }}>
                  Template Total: ${computeTotals(form.template_payload.items).total.toFixed(2)}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#475569' }}>Cancel</button>
                <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  Save Template
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({ title, value, icon: Icon, tone }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#64748B' }}>{title}</p>
          <p className="text-2xl font-bold mt-2" style={{ color: '#191C1E', fontFamily: 'Manrope, sans-serif' }}>{value}</p>
        </div>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${tone}14`, color: tone }}>
          <Icon size={20} />
        </div>
      </div>
    </div>
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
const inputStyle = {
  background: '#FFFFFF',
  boxShadow: '0 0 0 1px #CBD5E1',
  color: '#191C1E',
};
