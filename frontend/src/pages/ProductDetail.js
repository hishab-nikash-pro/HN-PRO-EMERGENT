import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getProduct } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, Pencil } from '@phosphor-icons/react';

export default function ProductDetail() {
  const { productId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany || !productId) return;
    getProduct(selectedCompany.company_id, productId)
      .then(res => setProduct(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, productId]);

  if (loading) {
    return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  }
  if (!product) {
    return <AppShell><div className="text-center py-12" style={{ color: '#434655' }}>Product not found</div></AppShell>;
  }

  return (
    <AppShell>
      <div data-testid="product-detail-page" className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/products')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{product.name}</h1>
              <p className="text-sm mt-0.5" style={{ color: '#434655' }}>SKU: {product.sku || 'N/A'}</p>
            </div>
          </div>
          <button
            data-testid="edit-product-btn"
            onClick={() => navigate(`/products/${productId}/edit`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
            style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>
            <Pencil size={16} /> Edit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Product Information</h3>
            <div className="space-y-3 text-sm">
              <div><span className="font-medium" style={{ color: '#434655' }}>Name:</span> <span style={{ color: '#191C1E' }}>{product.name}</span></div>
              <div><span className="font-medium" style={{ color: '#434655' }}>Description:</span> <span style={{ color: '#191C1E' }}>{product.description || '—'}</span></div>
              <div><span className="font-medium" style={{ color: '#434655' }}>Category:</span> <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: '#434655' }}>{product.category}</span></div>
              <div><span className="font-medium" style={{ color: '#434655' }}>SKU:</span> <span style={{ color: '#191C1E' }}>{product.sku || '—'}</span></div>
              <div><span className="font-medium" style={{ color: '#434655' }}>Unit:</span> <span style={{ color: '#191C1E' }}>{product.unit}</span></div>
            </div>
          </div>

          <div className="rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Pricing & Conversion</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span style={{ color: '#434655' }}>Cost Price:</span> <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(product.cost_price || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span style={{ color: '#434655' }}>Selling Price:</span> <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0E7490' }}>${(product.selling_price || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span style={{ color: '#434655' }}>Case Price:</span> <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(product.case_price || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span style={{ color: '#434655' }}>Units per Case:</span> <span className="font-semibold" style={{ color: '#191C1E' }}>{product.units_per_case || product.case_quantity || 1} {product.unit}</span></div>
              <div className="flex justify-between"><span style={{ color: '#434655' }}>Margin:</span> <span className="font-semibold" style={{ color: '#16a34a' }}>{product.selling_price > 0 ? (((product.selling_price - product.cost_price) / product.selling_price) * 100).toFixed(1) : '0.0'}%</span></div>
            </div>
          </div>

          <div className="rounded-2xl p-6 space-y-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Stock (Cases)</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span style={{ color: '#434655' }}>Cases on Hand:</span> <span className="font-bold tabular-nums text-lg" style={{ fontFamily: 'Manrope, sans-serif', color: '#0F2D5C' }}>{(product.cases_on_hand || 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span style={{ color: '#434655' }}>Available Cases:</span> <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#0E7490' }}>{(product.available_cases || product.cases_on_hand || 0).toFixed(2)}</span></div>
              <div className="text-xs px-3 py-2 rounded-lg" style={{ background: '#F7F9FB', color: '#434655' }}>
                <span className="font-medium">In Units:</span> {((product.cases_on_hand || 0) * (product.units_per_case || product.case_quantity || 1)).toFixed(0)} {product.unit}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Additional Details</h3>
          <div className="text-sm space-y-2" style={{ color: '#434655' }}>
            <div><span className="font-medium">Weight Info:</span> {product.weight_info || '—'}</div>
            <div><span className="font-medium">Created:</span> {product.created_at ? new Date(product.created_at).toLocaleDateString() : '—'}</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
