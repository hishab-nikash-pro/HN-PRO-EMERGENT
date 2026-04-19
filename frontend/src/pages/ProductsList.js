import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getProducts, createProduct, deleteProduct } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, Export, Pencil, Trash } from '@phosphor-icons/react';

export default function ProductsList() {
  const { selectedCompany } = useCompany();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', category: 'Frozen Fish', unit: 'kg', cost_price: 0, selling_price: 0, case_price: 0, case_quantity: 1, weight_info: '', sku: '' });
  const navigate = useNavigate();

  const loadProducts = () => {
    if (!selectedCompany) return;
    setLoading(true);
    getProducts(selectedCompany.company_id, categoryFilter || undefined)
      .then(res => setProducts(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProducts(); }, [selectedCompany, categoryFilter]);

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const handleSave = async () => {
    if (!form.name) return;
    try {
      if (editProduct) {
        const { updateProduct } = await import('../lib/api');
        await updateProduct(selectedCompany.company_id, editProduct.product_id, form);
      } else {
        await createProduct(selectedCompany.company_id, form);
      }
      setShowCreateModal(false);
      setEditProduct(null);
      setForm({ name: '', description: '', category: 'Frozen Fish', unit: 'kg', cost_price: 0, selling_price: 0, case_price: 0, case_quantity: 1, weight_info: '', sku: '' });
      loadProducts();
    } catch (err) { console.error(err); }
  };

  const handleEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description || '', category: p.category || '', unit: p.unit || 'kg', cost_price: p.cost_price || 0, selling_price: p.selling_price || 0, case_price: p.case_price || 0, case_quantity: p.case_quantity || 1, weight_info: p.weight_info || '', sku: p.sku || '' });
    setShowCreateModal(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await deleteProduct(selectedCompany.company_id, productId);
      loadProducts();
    } catch (err) { console.error(err); }
  };

  const margin = (p) => p.selling_price > 0 ? (((p.selling_price - p.cost_price) / p.selling_price) * 100).toFixed(1) : '0.0';

  return (
    <AppShell>
      <div data-testid="products-list-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Products</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Product catalog with pricing and case information</p>
          </div>
          <button data-testid="add-product-btn" onClick={() => { setEditProduct(null); setForm({ name: '', description: '', category: 'Frozen Fish', unit: 'kg', cost_price: 0, selling_price: 0, case_price: 0, case_quantity: 1, weight_info: '', sku: '' }); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            <Plus size={16} weight="bold" /> Add Product
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Total Products</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{filtered.length}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Categories</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{categories.length}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#434655' }}>Active</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#16a34a' }}>{filtered.filter(p => p.status === 'Active').length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
            <input data-testid="products-search" type="text" placeholder="Search products..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
            style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><Export size={18} /></button>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Product Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Cost Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Selling Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Case Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Margin</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No products found</td></tr>
                ) : filtered.map((p, i) => (
                  <tr key={p.product_id} data-testid={`product-row-${p.product_id}`}
                    onClick={() => navigate(`/products/${p.product_id}`)}
                    className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                    style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{p.sku}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium" style={{ color: '#191C1E' }}>{p.name}</p>
                        <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: '#434655' }}>{p.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: '#434655' }}>{p.category}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(p.cost_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(p.selling_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0E7490' }}>${(p.case_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: '#16a34a' }}>{margin(p)}%</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button data-testid={`edit-product-${p.product_id}`} onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                          className="p-1.5 rounded hover:bg-[#F2F4F6] transition-colors" style={{ color: '#434655' }}><Pencil size={14} /></button>
                        <button data-testid={`delete-product-${p.product_id}`} onClick={(e) => { e.stopPropagation(); handleDelete(p.product_id); }}
                          className="p-1.5 rounded hover:bg-[#fef2f2] transition-colors" style={{ color: '#BA1A1A' }}><Trash size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                {editProduct ? 'Edit Product' : 'New Product'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Product Name</label>
                  <input data-testid="product-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Hilsha 5/8 UP" className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Description</label>
                  <textarea data-testid="product-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2} placeholder="Product description..." className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1 resize-none"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                    <option>Frozen Fish</option><option>Frozen Shrimp</option><option>Dried Fish</option><option>Frozen Shellfish</option><option>Frozen Seafood</option><option>Value Added</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}>
                    <option>kg</option><option>lb</option><option>pcs</option><option>pack</option><option>box</option><option>case</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Cost Price ($)</label>
                  <input data-testid="product-cost-price" type="number" step="0.01" value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Selling Price ($)</label>
                  <input data-testid="product-selling-price" type="number" step="0.01" value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Case Price ($)</label>
                  <input type="number" step="0.01" value={form.case_price}
                    onChange={(e) => setForm({ ...form, case_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Case Quantity</label>
                  <input type="number" value={form.case_quantity}
                    onChange={(e) => setForm({ ...form, case_quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Weight / Pack Info</label>
                  <input type="text" value={form.weight_info} onChange={(e) => setForm({ ...form, weight_info: e.target.value })}
                    placeholder="e.g. (20KG X 1) 44.09 LBS @ 3.99 LB"
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>SKU</label>
                  <input type="text" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Auto-generated if blank"
                    className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                    style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => { setShowCreateModal(false); setEditProduct(null); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button data-testid="save-product-btn" onClick={handleSave}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  {editProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
