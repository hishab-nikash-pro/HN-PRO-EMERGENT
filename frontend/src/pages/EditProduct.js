import { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getProduct, updateProduct } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FloppyDisk } from '@phosphor-icons/react';

const CATEGORIES = ['Frozen Fish', 'Frozen Meat', 'Frozen Vegetables', 'Dairy', 'Snacks', 'Beverages', 'Condiments', 'Packaging', 'Other'];
const UNITS = ['kg', 'lb', 'pcs', 'box', 'case', 'liter', 'gallon', 'each'];

export default function EditProduct() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const { productId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', category: 'Frozen Fish', unit: 'kg', cost_price: 0, selling_price: 0,
    case_price: 0, units_per_case: 1, cases_on_hand: 0, available_cases: 0, weight_info: '', sku: ''
  });

  useEffect(() => {
    if (!selectedCompany || !productId) return;
    getProduct(selectedCompany.company_id, productId)
      .then(res => {
        const p = res.data;
        setForm({
          name: p.name || '',
          description: p.description || '',
          category: p.category || 'Frozen Fish',
          unit: p.unit || 'kg',
          cost_price: p.cost_price || 0,
          selling_price: p.selling_price || 0,
          case_price: p.case_price || 0,
          units_per_case: p.units_per_case || p.case_quantity || 1,
          cases_on_hand: p.cases_on_hand || 0,
          available_cases: p.available_cases || p.cases_on_hand || 0,
          weight_info: p.weight_info || '',
          sku: p.sku || ''
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, productId]);

  const handleSave = async () => {
    if (!form.name || !form.category) return;
    setSaving(true);
    try {
      await updateProduct(selectedCompany.company_id, productId, form);
      navigate(`/products/${productId}`);
    } catch (err) {
      console.error(err);
      alert('Failed to update product');
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
      <div data-testid="edit-product-page" className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/products/${productId}`)} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Edit Product</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>Update product information</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Product Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>SKU</label>
              <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2} className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Category *</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Cost Price</label>
              <input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Selling Price</label>
              <input type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Case Price</label>
              <input type="number" step="0.01" value={form.case_price} onChange={(e) => setForm({ ...form, case_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Units per Case</label>
              <input type="number" step="1" min="1" value={form.units_per_case} onChange={(e) => setForm({ ...form, units_per_case: parseInt(e.target.value) || 1 })}
                placeholder="e.g., 12"
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Cases on Hand</label>
              <input type="number" step="0.01" min="0" value={form.cases_on_hand} onChange={(e) => setForm({ ...form, cases_on_hand: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Available Cases</label>
              <input type="number" step="0.01" min="0" value={form.available_cases} onChange={(e) => setForm({ ...form, available_cases: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#434655' }}>Weight Info</label>
              <input type="text" value={form.weight_info} onChange={(e) => setForm({ ...form, weight_info: e.target.value })}
                placeholder="e.g., 1kg per pack"
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
                style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button onClick={handleSave} disabled={saving || !form.name || !form.category}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <FloppyDisk size={16} weight="fill" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => navigate(`/products/${productId}`)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: '#F2F4F6', color: '#434655' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
