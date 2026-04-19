import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getCustomer, updateCustomer } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FloppyDisk } from '@phosphor-icons/react';

export default function EditCustomer() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const { customerId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', company_name: '', phone: '', email: '', address: '', tax_id: '', notes: ''
  });

  useEffect(() => {
    if (!selectedCompany || !customerId) return;
    getCustomer(selectedCompany.company_id, customerId)
      .then(res => {
        const c = res.data;
        setForm({
          name: c.name || '',
          company_name: c.company_name || '',
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          tax_id: c.tax_id || '',
          notes: c.notes || ''
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, customerId]);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await updateCustomer(selectedCompany.company_id, customerId, form);
      navigate(`/customers/${customerId}`);
    } catch (err) {
      console.error(err);
      alert('Failed to update customer');
    } finally {
      setSaving(false);
    }
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
      <div data-testid="edit-customer-page" className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/customers/${customerId}`)} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Edit Customer</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>Update customer information</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Customer Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Company Name</label>
              <input type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Address</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Tax ID</label>
              <input type="text" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3} className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button onClick={handleSave} disabled={saving || !form.name}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <FloppyDisk size={16} weight="fill" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => navigate(`/customers/${customerId}`)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#F2F4F6', color: '#434655' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
