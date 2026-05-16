import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { useCompany } from '../contexts/CompanyContext';
import { getProduct, updateProduct } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import LegacyProductEditor from '../components/products/LegacyProductEditor';

function sanitizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUnitsPerCase(value) {
  const parsed = sanitizeNumber(value);
  return parsed > 0 ? parsed : 1;
}

function roundCurrency(value) {
  return Math.round(sanitizeNumber(value) * 100) / 100;
}

function getUnitPrice(product) {
  return sanitizeNumber(product?.unit_price ?? product?.selling_price);
}

const DEFAULT_CATEGORIES = [
  '250 GM BLOCK FISH',
  '500 GM BLOCK FISH',
  'IQF / VP PACK / VP TRAY / VP STEAKS / FILLETS',
  'IQF WHOLE FISH',
  'SHRIMP',
  'SWEET',
  'SNACKS',
  'READY TO COOKED',
  'FROZEN VEGETABLE',
  'VORTA',
  'DRY FISH',
];

export default function EditProduct() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { selectedCompany, role } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    product_type: 'Inventory',
    category: '',
    brand: '',
    product_mode: 'CASE',
    cost_type: 'UNIT',
    unit_type: 'PCS',
    units_per_case: 1,
    unit_label: 'PCS',
    cost_price: 0,
    case_cost: 0,
    unit_price: 0,
    case_price_override: '',
    cases_on_hand: 0,
    stock_cases: 0,
    sku: '',
    packing_text: '',
    notes: '',
    price_basis: '',
    size_range: '',
    default_box_weight_kg: 20,
    default_box_weight_lb: 44.1,
    actual_dispatch_weight_lb: '',
    actual_dispatch_unit_price: '',
    barcode: '',
    in_stock: true,
  });

  const canEditPrice = role === 'OWNER' || role === 'MANAGER';
  const categoryOptions = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    if (form.category) set.add(form.category);
    return [...set];
  }, [form.category]);

  const effectiveCasePrice = useMemo(() => {
    if (String(form.product_mode).toUpperCase() === 'WEIGHT') {
      const weight = sanitizeNumber(form.default_box_weight_lb) || 44.1;
      return roundCurrency(sanitizeNumber(form.unit_price) * weight);
    }
    if (canEditPrice && form.case_price_override !== '') {
      return roundCurrency(form.case_price_override);
    }
    return roundCurrency(sanitizeNumber(form.unit_price) * normalizeUnitsPerCase(form.units_per_case));
  }, [canEditPrice, form.case_price_override, form.default_box_weight_lb, form.product_mode, form.unit_price, form.units_per_case]);

  const packDisplay = useMemo(() => {
    if (String(form.product_mode).toUpperCase() === 'WEIGHT') {
      return `${sanitizeNumber(form.default_box_weight_kg) || 20} KG BOX (${(sanitizeNumber(form.default_box_weight_lb) || 44.1).toFixed(2)} LB)`;
    }
    const units = normalizeUnitsPerCase(form.units_per_case);
    const label = String(form.unit_label || form.unit_type || 'PCS').toUpperCase();
    return `${units} ${label}/CASE`;
  }, [form.default_box_weight_kg, form.default_box_weight_lb, form.product_mode, form.unit_label, form.unit_type, form.units_per_case]);

  const finalDispatchPrice = useMemo(
    () => roundCurrency(sanitizeNumber(form.actual_dispatch_weight_lb) * sanitizeNumber(form.actual_dispatch_unit_price)),
    [form.actual_dispatch_unit_price, form.actual_dispatch_weight_lb]
  );

  useEffect(() => {
    if (!selectedCompany?.company_id || !productId) return;
    getProduct(selectedCompany.company_id, productId)
      .then((response) => {
        const product = response.data || {};
        setForm({
          name: product.name || '',
          description: product.description || '',
          product_type: product.product_type || 'Inventory',
          category: product.category || '',
          brand: product.brand || '',
          product_mode: String(product.product_mode || 'CASE').toUpperCase(),
          cost_type: String(product.cost_type || 'UNIT').toUpperCase(),
          unit_type: String(product.unit_type || product.unit || 'PCS').toUpperCase(),
          units_per_case: normalizeUnitsPerCase(product.units_per_case),
          unit_label: String(product.unit_label || product.unit_type || 'PCS').toUpperCase(),
          cost_price: sanitizeNumber(product.cost_price ?? product.unit_cost),
          case_cost: sanitizeNumber(product.case_cost),
          unit_price: getUnitPrice(product),
          case_price_override: product.case_price_override !== null && product.case_price_override !== undefined ? String(product.case_price_override) : '',
          cases_on_hand: sanitizeNumber(product.cases_on_hand),
          stock_cases: sanitizeNumber(product.stock_cases ?? product.cases_on_hand),
          sku: product.sku || '',
          packing_text: product.packing_text || '',
          notes: product.notes || '',
          price_basis: product.price_basis || '',
          size_range: product.size_range || '',
          default_box_weight_kg: sanitizeNumber(product.default_box_weight_kg) || 20,
          default_box_weight_lb: sanitizeNumber(product.default_box_weight_lb) || 44.1,
          actual_dispatch_weight_lb: product.actual_dispatch_weight_lb || '',
          actual_dispatch_unit_price: product.actual_dispatch_unit_price || '',
          barcode: product.barcode || '',
          in_stock: product.in_stock !== false,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany?.company_id, productId]);

  const handleSave = async () => {
    if (!selectedCompany?.company_id || !productId || !form.name.trim()) return;
    setSaving(true);
    try {
      const unitsPerCase = normalizeUnitsPerCase(form.units_per_case);
      const unitPrice = sanitizeNumber(form.unit_price);
      const casePriceOverride = canEditPrice && String(form.case_price_override).trim() !== ''
        ? roundCurrency(form.case_price_override)
        : null;
      await updateProduct(selectedCompany.company_id, productId, {
        name: form.name.trim(),
        description: form.description.trim(),
        product_type: form.product_type,
        category: form.category.trim(),
        brand: form.brand.trim(),
        product_mode: form.product_mode,
        cost_type: form.cost_type,
        unit_type: form.unit_type,
        unit_label: String(form.unit_label || form.unit_type || 'PCS').toUpperCase(),
        unit: String(form.unit_type || 'PCS').toLowerCase(),
        packing_text: form.packing_text || '',
        units_per_case: unitsPerCase,
        cost_price: form.cost_type === 'CASE' ? roundCurrency(sanitizeNumber(form.case_cost) / unitsPerCase) : sanitizeNumber(form.cost_price),
        unit_cost: form.cost_type === 'CASE' ? roundCurrency(sanitizeNumber(form.case_cost) / unitsPerCase) : sanitizeNumber(form.cost_price),
        case_cost: form.cost_type === 'CASE' ? sanitizeNumber(form.case_cost) : roundCurrency(sanitizeNumber(form.cost_price) * unitsPerCase),
        unit_price: unitPrice,
        selling_price: unitPrice,
        case_price: casePriceOverride ?? roundCurrency(unitPrice * unitsPerCase),
        case_price_override: casePriceOverride,
        cases_on_hand: sanitizeNumber(form.stock_cases ?? form.cases_on_hand),
        stock_cases: sanitizeNumber(form.stock_cases ?? form.cases_on_hand),
        available_cases: sanitizeNumber(form.stock_cases ?? form.cases_on_hand),
        sku: form.sku || '',
        notes: form.notes || '',
        price_basis: form.price_basis || '',
        size_range: form.size_range || '',
        default_box_weight_kg: sanitizeNumber(form.default_box_weight_kg) || 20,
        default_box_weight_lb: sanitizeNumber(form.default_box_weight_lb) || 44.1,
        actual_dispatch_weight_lb: form.actual_dispatch_weight_lb || '',
        actual_dispatch_unit_price: form.actual_dispatch_unit_price || '',
        barcode: form.barcode || '',
        in_stock: form.in_stock !== false,
      });
      navigate(`/products/${productId}`);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AppShell><div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  }

  return (
    <AppShell>
      <div data-testid="edit-product-page" className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/products/${productId}`)} className="rounded-lg p-2 transition-colors hover:bg-white" style={{ color: '#434655' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-[18px] font-bold" style={{ color: '#202020' }}>Edit Product</h1>
            <p className="mt-0.5 text-[12px]" style={{ color: '#5A6E84' }}>Legacy desktop product editor using the current update workflow.</p>
          </div>
        </div>

        <LegacyProductEditor
          title="Edit Product"
          saveLabel="OK"
          form={form}
          setForm={setForm}
          categoryOptions={categoryOptions}
          canEditPrice={canEditPrice}
          effectiveCasePrice={effectiveCasePrice}
          packDisplay={packDisplay}
          finalDispatchPrice={finalDispatchPrice}
          onSave={handleSave}
          onCancel={() => navigate(`/products/${productId}`)}
          saveDisabled={saving || !form.name.trim()}
          saving={saving}
        />
      </div>
    </AppShell>
  );
}
