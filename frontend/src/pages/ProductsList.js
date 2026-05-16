import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowClockwise, DownloadSimple, MagnifyingGlass, Pencil, Plus, Trash } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import ConfirmDeleteModal from '../components/common/ConfirmDeleteModal';
import { useCompany } from '../contexts/CompanyContext';
import { bulkDeleteProducts, createProduct, deleteProduct, getProducts, importProductsCSV, updateProduct } from '../lib/api';
import LegacyProductEditor from '../components/products/LegacyProductEditor';

const CATEGORY_OPTIONS = [
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

const emptyForm = {
  name: '',
  product_type: 'Inventory',
  category: '',
  brand: '',
  product_mode: 'CASE',
  cost_type: 'UNIT',
  unit_type: 'PCS',
  description: '',
  packing_text: '',
  units_per_case: 1,
  unit_label: 'PCS',
  stock_cases: 0,
  cost_price: 0,
  case_cost: 0,
  unit_price: 0,
  case_price_override: '',
  in_stock: true,
  sku: '',
  barcode: '',
  notes: '',
  price_basis: '',
  size_range: '',
  default_box_weight_kg: 20,
  default_box_weight_lb: 44.1,
  actual_dispatch_weight_lb: '',
  actual_dispatch_unit_price: '',
};

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

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getUnitPrice(product) {
  return sanitizeNumber(product?.unit_price ?? product?.selling_price);
}

function getCasePrice(product) {
  if (String(product?.product_mode || '').toUpperCase() === 'WEIGHT') {
    return roundCurrency(product?.default_box_price ?? product?.case_price);
  }
  const explicit = sanitizeNumber(product?.case_price);
  if (explicit > 0) return explicit;
  return roundCurrency(getUnitPrice(product) * normalizeUnitsPerCase(product?.units_per_case));
}

function getPackDisplay(product) {
  if (String(product?.product_mode || '').toUpperCase() === 'WEIGHT') {
    const kg = sanitizeNumber(product?.default_box_weight_kg) || 20;
    const lb = sanitizeNumber(product?.default_box_weight_lb) || 44.1;
    return `${kg.toFixed(0)} KG BOX (${lb.toFixed(2)} LB)`;
  }
  const units = normalizeUnitsPerCase(product?.units_per_case);
  const label = String(product?.unit_label || product?.unit_type || product?.unit || 'UNITS').toUpperCase();
  return `${units} ${label}/CASE`;
}

function getStockValue(product) {
  return sanitizeNumber(
    product?.total_quantity_on_hand
    ?? product?.quantity_on_hand
    ?? product?.stock_cases
    ?? product?.cases_on_hand
  );
}

function sortProducts(products, sortBy) {
  const list = [...products];
  const getSortValue = (product) => {
    switch (sortBy) {
      case 'category':
        return String(product.category || '').toLowerCase();
      case 'unit_price':
        return getUnitPrice(product);
      case 'stock':
        return getStockValue(product);
      case 'name':
      default:
        return String(product.name || '').toLowerCase();
    }
  };
  return list.sort((left, right) => {
    const a = getSortValue(left);
    const b = getSortValue(right);
    if (typeof a === 'number' && typeof b === 'number') {
      return sortBy === 'stock' || sortBy === 'unit_price' ? b - a : a - b;
    }
    return String(a).localeCompare(String(b));
  });
}

export default function ProductsList() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { selectedCompany, role, can } = useCompany();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const canEditPrice = role === 'OWNER' || role === 'MANAGER';

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

  const loadProducts = useCallback(async () => {
    if (!selectedCompany?.company_id) return;
    setLoading(true);
    try {
      const response = await getProducts(selectedCompany.company_id);
      setProducts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.company_id]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const categoryOptions = useMemo(() => {
    const set = new Set(CATEGORY_OPTIONS);
    products.forEach((product) => {
      if (product.category) set.add(product.category);
    });
    return [...set];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = normalizeText(search);
    const filtered = products.filter((product) => {
      const matchesSearch = !term || [
        product.name,
        product.description,
        product.category,
        product.sku,
        product.barcode,
        product.packing_text,
      ].filter(Boolean).join(' ').toLowerCase().includes(term);
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const stockValue = getStockValue(product);
      const matchesStock = stockFilter === 'all'
        || (stockFilter === 'in' && (Boolean(product.in_stock) || stockValue > 0))
        || (stockFilter === 'out' && !Boolean(product.in_stock) && stockValue <= 0);
      return matchesSearch && matchesCategory && matchesStock;
    });
    return sortProducts(filtered, sortBy);
  }, [products, search, categoryFilter, stockFilter, sortBy]);

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedProductIds.includes(product.product_id));

  const openCreate = () => {
    setEditProduct(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditProduct(product);
    setForm({
      name: product.name || '',
      product_type: product.product_type || 'Inventory',
      category: product.category || '',
      brand: product.brand || '',
      product_mode: String(product.product_mode || 'CASE').toUpperCase(),
      cost_type: String(product.cost_type || 'UNIT').toUpperCase(),
      unit_type: String(product.unit_type || product.unit || 'PCS').toUpperCase(),
      description: product.description || '',
      packing_text: product.packing_text || '',
      units_per_case: normalizeUnitsPerCase(product.units_per_case),
      unit_label: String(product.unit_label || product.unit_type || 'PCS').toUpperCase(),
      stock_cases: getStockValue(product),
      cost_price: sanitizeNumber(product.cost_price ?? product.unit_cost),
      case_cost: sanitizeNumber(product.case_cost),
      unit_price: getUnitPrice(product),
      case_price_override: product.case_price_override !== null && product.case_price_override !== undefined ? String(product.case_price_override) : '',
      in_stock: Boolean(product.in_stock),
      sku: product.sku || '',
      barcode: product.barcode || '',
      notes: product.notes || '',
      price_basis: product.price_basis || '',
      size_range: product.size_range || '',
      default_box_weight_kg: sanitizeNumber(product.default_box_weight_kg) || 20,
      default_box_weight_lb: sanitizeNumber(product.default_box_weight_lb) || 44.1,
      actual_dispatch_weight_lb: product.actual_dispatch_weight_lb || '',
      actual_dispatch_unit_price: product.actual_dispatch_unit_price || '',
    });
    setShowModal(true);
  };

  const buildPayload = () => {
    const unitsPerCase = normalizeUnitsPerCase(form.units_per_case);
    const stockCases = sanitizeNumber(form.stock_cases);
    const unitPrice = canEditPrice ? sanitizeNumber(form.unit_price) : getUnitPrice(editProduct);
    const casePriceOverride = canEditPrice && String(form.case_price_override).trim() !== ''
      ? roundCurrency(form.case_price_override)
      : null;
    const productMode = String(form.product_mode || 'CASE').toUpperCase();
    const defaultBoxWeightKg = sanitizeNumber(form.default_box_weight_kg) || 20;
    const defaultBoxWeightLb = sanitizeNumber(form.default_box_weight_lb) || 44.1;
    const actualDispatchWeightLb = sanitizeNumber(form.actual_dispatch_weight_lb);
    const actualDispatchUnitPrice = sanitizeNumber(form.actual_dispatch_unit_price);
    return {
      name: form.name.trim(),
      description: form.description.trim(),
      product_type: form.product_type,
      category: form.category.trim(),
      brand: form.brand.trim(),
      product_mode: productMode,
      cost_type: String(form.cost_type || 'UNIT').toUpperCase(),
      unit_type: String(form.unit_type || 'PCS').toUpperCase(),
      unit_label: String(form.unit_label || form.unit_type || 'PCS').toUpperCase(),
      unit: String(form.unit_type || 'PCS').toLowerCase(),
      packing_text: form.packing_text.trim(),
      units_per_case: productMode === 'WEIGHT' ? 1 : unitsPerCase,
      cost_price: form.cost_type === 'CASE' ? roundCurrency(sanitizeNumber(form.case_cost) / unitsPerCase) : sanitizeNumber(form.cost_price),
      unit_cost: form.cost_type === 'CASE' ? roundCurrency(sanitizeNumber(form.case_cost) / unitsPerCase) : sanitizeNumber(form.cost_price),
      case_cost: form.cost_type === 'CASE' ? sanitizeNumber(form.case_cost) : roundCurrency(sanitizeNumber(form.cost_price) * unitsPerCase),
      unit_price: unitPrice,
      selling_price: unitPrice,
      case_price: productMode === 'WEIGHT'
        ? roundCurrency(unitPrice * defaultBoxWeightLb)
        : (casePriceOverride ?? roundCurrency(unitPrice * unitsPerCase)),
      case_price_override: casePriceOverride,
      effective_case_price: effectiveCasePrice,
      price_basis: String(form.price_basis || (productMode === 'WEIGHT' ? 'LB' : '')).toUpperCase(),
      size_range: String(form.size_range || '').toUpperCase(),
      default_box_weight_kg: productMode === 'WEIGHT' ? defaultBoxWeightKg : 0,
      default_box_weight_lb: productMode === 'WEIGHT' ? defaultBoxWeightLb : 0,
      default_box_price: productMode === 'WEIGHT' ? roundCurrency(unitPrice * defaultBoxWeightLb) : 0,
      actual_dispatch_weight_lb: actualDispatchWeightLb,
      actual_dispatch_unit_price: actualDispatchUnitPrice,
      final_dispatch_box_price: actualDispatchWeightLb > 0 && actualDispatchUnitPrice > 0
        ? roundCurrency(actualDispatchWeightLb * actualDispatchUnitPrice)
        : 0,
      stock_cases: stockCases,
      cases_on_hand: stockCases,
      available_cases: stockCases,
      stock_units_on_hand: productMode === 'WEIGHT' ? stockCases : stockCases * unitsPerCase,
      available_stock_units: productMode === 'WEIGHT' ? stockCases : stockCases * unitsPerCase,
      in_stock: Boolean(form.in_stock),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      notes: form.notes.trim(),
    };
  };

  const handleSave = async () => {
    if (!selectedCompany?.company_id || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editProduct) {
        await updateProduct(selectedCompany.company_id, editProduct.product_id, payload);
      } else {
        await createProduct(selectedCompany.company_id, payload);
      }
      setShowModal(false);
      setForm(emptyForm);
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCompany?.company_id || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(selectedCompany.company_id, deleteTarget.product_id);
      setProducts((current) => current.filter((product) => product.product_id !== deleteTarget.product_id));
      setSelectedProductIds((current) => current.filter((productId) => productId !== deleteTarget.product_id));
      setFeedback({ type: 'success', message: `${deleteTarget.name || 'Product'} deleted successfully.` });
      setDeleteTarget(null);
      await loadProducts();
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Failed to delete product.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedCompany?.company_id || selectedProductIds.length === 0) return;
    setDeleting(true);
    try {
      await bulkDeleteProducts(selectedCompany.company_id, selectedProductIds);
      setProducts((current) => current.filter((product) => !selectedProductIds.includes(product.product_id)));
      setFeedback({ type: 'success', message: `${selectedProductIds.length} product${selectedProductIds.length === 1 ? '' : 's'} deleted successfully.` });
      setSelectedProductIds([]);
      setDeleteTarget(null);
      await loadProducts();
    } catch (error) {
      console.error(error);
      setFeedback({ type: 'error', message: error?.response?.data?.detail || 'Failed to delete selected products.' });
    } finally {
      setDeleting(false);
    }
  };

  const toggleProductSelection = (productId) => {
    setSelectedProductIds((current) => (
      current.includes(productId)
        ? current.filter((value) => value !== productId)
        : [...current, productId]
    ));
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedProductIds((current) => current.filter((productId) => !filteredProducts.some((product) => product.product_id === productId)));
      return;
    }
    setSelectedProductIds((current) => {
      const merged = new Set(current);
      filteredProducts.forEach((product) => merged.add(product.product_id));
      return [...merged];
    });
  };

  const triggerImport = () => fileInputRef.current?.click();

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!selectedCompany?.company_id || !file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await importProductsCSV(selectedCompany.company_id, formData);
      await loadProducts();
      const data = response.data || {};
      alert(`Import complete.\nImported: ${data.imported || 0}\nUpdated: ${data.updated || 0}\nDuplicates removed: ${data.duplicates_removed || 0}\nCategories: ${data.categories_created || 0}\nErrors: ${(data.errors || []).length}`);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.detail || 'Failed to import catalog.');
    } finally {
      event.target.value = '';
      setImporting(false);
    }
  };

  return (
    <AppShell>
      <div data-testid="products-list-page" className="space-y-4">
        {feedback && (
          <div className="rounded-[18px] px-4 py-3 text-[12px] font-semibold" style={{ background: feedback.type === 'error' ? '#FEF2F2' : '#ECFDF3', color: feedback.type === 'error' ? '#B42318' : '#027A48', border: `1px solid ${feedback.type === 'error' ? '#FECACA' : '#A7F3D0'}` }}>
            {feedback.message}
          </div>
        )}
        <div className="rounded-[18px] border bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,45,92,0.06)]" style={{ borderColor: '#D7E1EC' }}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-[18px] font-bold" style={{ color: '#202020' }}>Product Lists</h1>
              <p className="mt-1 text-[12px]" style={{ color: '#5B6F85' }}>
                {selectedCompany?.name || 'Current company'} business overview with live financial and inventory values.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={triggerImport}
                disabled={importing}
                className="flex items-center gap-2 rounded px-3 py-2 text-[12px] font-bold transition-colors disabled:opacity-60"
                style={{ background: '#FFFFFF', color: '#2B415A', border: '1px solid #B7C7D9' }}
              >
                {importing ? <ArrowClockwise size={15} className="animate-spin" /> : <DownloadSimple size={15} weight="bold" />}
                Import Excel/CSV
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm,.csv" className="hidden" onChange={handleImport} />
              <button
                onClick={openCreate}
                className="flex items-center gap-2 rounded px-3 py-2 text-[12px] font-bold text-white"
                style={{ background: 'linear-gradient(180deg, #0F68C8 0%, #0B4D96 100%)', border: '1px solid #0B4D96' }}
              >
                <Plus size={15} weight="bold" /> Add Product
              </button>
            </div>
          </div>
        </div>

        {can.admin && selectedProductIds.length > 0 && (
          <div className="rounded-[18px] border bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,45,92,0.04)]" style={{ borderColor: '#D7E1EC' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px] font-semibold" style={{ color: '#36516C' }}>
                {selectedProductIds.length} product{selectedProductIds.length === 1 ? '' : 's'} selected
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget({ mode: 'bulk', count: selectedProductIds.length })}
                className="flex items-center gap-2 rounded px-3 py-2 text-[12px] font-bold text-white"
                style={{ background: '#B42318' }}
              >
                <Trash size={14} weight="bold" /> Delete Selected
              </button>
            </div>
          </div>
        )}

        <div className="rounded-[18px] border bg-white px-3 py-3 shadow-[0_6px_18px_rgba(15,45,92,0.04)]" style={{ borderColor: '#D7E1EC' }}>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-[auto_150px_auto_180px_120px_auto_130px_140px] xl:items-center">
            <div className="text-[11px] font-bold" style={{ color: '#36516C' }}>Look for</div>
            <div className="relative">
              <MagnifyingGlass size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#5A6A7B' }} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="w-full rounded px-7 py-1.5 text-[12px] focus:outline-none"
                style={{ background: '#FFFFFF', color: '#191C1E', border: '1px solid #B7C7D9', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.06)' }}
              />
            </div>
            <div className="hidden text-center text-[11px] font-bold xl:block" style={{ color: '#36516C' }}>in</div>
            <FilterSelect value={categoryFilter} onChange={setCategoryFilter}>
              <option value="all">All fields</option>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </FilterSelect>
            <button
              type="button"
              onClick={() => {}}
              className="rounded px-3 py-1.5 text-[12px] font-bold text-white"
              style={{ background: 'linear-gradient(180deg, #6793D4 0%, #2E66B4 100%)', border: '1px solid #2E66B4' }}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
                setStockFilter('all');
                setSortBy('name');
              }}
              className="rounded px-3 py-1.5 text-[12px] font-bold"
              style={{ background: '#F5F7FA', color: '#4A5E76', border: '1px solid #CDD8E4' }}
            >
              Reset
            </button>
            <FilterSelect value={stockFilter} onChange={setStockFilter}>
              <option value="all">All stock</option>
              <option value="in">In stock</option>
              <option value="out">Out of stock</option>
            </FilterSelect>
            <FilterSelect value={sortBy} onChange={setSortBy}>
              <option value="name">Sort: Name</option>
              <option value="category">Sort: Category</option>
              <option value="unit_price">Sort: Price</option>
              <option value="stock">Sort: Stock</option>
            </FilterSelect>
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] border bg-white shadow-[0_6px_18px_rgba(15,45,92,0.04)]" style={{ borderColor: '#D7E1EC' }}>
          <div className="border-b px-3 py-2 text-[11px] font-bold uppercase" style={{ borderColor: '#D7E1EC', background: '#F6F9FC', color: '#37506A' }}>
            Product Lists
          </div>
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #C9D5E2' }}>
                    <LegacyHeaderCell align="center">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        disabled={!can.admin}
                        aria-label="Select all products"
                      />
                    </LegacyHeaderCell>
                    <LegacyHeaderCell>Name</LegacyHeaderCell>
                    <LegacyHeaderCell>Description</LegacyHeaderCell>
                    <LegacyHeaderCell>Type</LegacyHeaderCell>
                    <LegacyHeaderCell>Account</LegacyHeaderCell>
                    <LegacyHeaderCell align="right">Total Quantity On Hand</LegacyHeaderCell>
                    <LegacyHeaderCell align="right">On Sales Order</LegacyHeaderCell>
                    <LegacyHeaderCell align="center">U/M</LegacyHeaderCell>
                    <LegacyHeaderCell align="right">Price</LegacyHeaderCell>
                    <LegacyHeaderCell align="center">Attach</LegacyHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-sm" style={{ color: '#434655' }}>
                        No products found for the current filters.
                      </td>
                    </tr>
                  ) : filteredProducts.map((product, index) => {
                    const stockValue = getStockValue(product);
                    return (
                      <tr
                        key={product.product_id}
                        id={product.product_id}
                        onClick={() => navigate(`/products/${product.product_id}`)}
                        className="cursor-pointer"
                        style={{
                          background: index % 2 === 0 ? '#FFFFFF' : '#EDF5FF',
                          borderBottom: '1px solid #DCE6F2',
                        }}
                      >
                        <td className="px-3 py-1.5 text-center align-top">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(product.product_id)}
                            disabled={!can.admin}
                            onChange={(event) => {
                              event.stopPropagation();
                              toggleProductSelection(product.product_id);
                            }}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Select ${product.name}`}
                          />
                        </td>
                        <td className="px-3 py-1.5 align-top">
                          <div className="font-semibold" style={{ color: '#21384F' }}>{product.name}</div>
                          <div className="mt-0.5 text-[10px]" style={{ color: '#5B7089' }}>{product.sku || '\u2022'}</div>
                        </td>
                        <td className="px-3 py-1.5 align-top" style={{ color: '#263D56' }}>{product.packing_text || product.description || '-'}</td>
                        <td className="px-3 py-1.5 align-top" style={{ color: '#263D56' }}>
                          {String(product.product_type || 'Inventory').replace('-', ' ')}
                        </td>
                        <td className="px-3 py-1.5 align-top" style={{ color: '#263D56' }}>
                          {String(product.in_stock || stockValue > 0 ? 'Sales' : 'Inventory').replace('-', ' ')}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums align-top" style={{ color: stockValue < 0 ? '#A02222' : '#21384F' }}>
                          {stockValue.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums align-top" style={{ color: '#21384F' }}>0</td>
                        <td className="px-3 py-1.5 text-center align-top" style={{ color: '#21384F' }}>
                          {String(product.unit_label || product.unit_type || 'PCS').toUpperCase()}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums align-top" style={{ color: '#21384F' }}>
                          {getCasePrice(product).toFixed(3)}
                        </td>
                        <td className="px-3 py-1.5 align-top">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={(event) => { event.stopPropagation(); openEdit(product); }} className="rounded p-1 hover:bg-[#DDE8F5]" style={{ color: '#435970' }}>
                              <Pencil size={13} />
                            </button>
                            {can.admin && (
                              <button onClick={(event) => { event.stopPropagation(); setDeleteTarget({ mode: 'single', ...product }); }} className="rounded p-1 hover:bg-[#FCE6E6]" style={{ color: '#BA1A1A' }}>
                                <Trash size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ConfirmDeleteModal
          open={Boolean(deleteTarget)}
          title={deleteTarget?.mode === 'bulk' ? 'Delete Selected Products' : 'Delete Product'}
          message={deleteTarget?.mode === 'bulk'
            ? `Delete ${deleteTarget?.count || selectedProductIds.length} products?`
            : 'Are you sure you want to delete this product?'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteTarget?.mode === 'bulk' ? handleBulkDelete : handleDelete}
          loading={deleting}
        />

        {showModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto p-4" style={{ background: 'rgba(18, 30, 46, 0.46)' }}>
            <div className="mx-auto mt-6 max-w-[1120px]">
              <LegacyProductEditor
                title={editProduct ? 'Edit Product' : 'Add New Products'}
                saveLabel={editProduct ? 'OK' : 'OK'}
                form={form}
                setForm={setForm}
                categoryOptions={categoryOptions}
                canEditPrice={canEditPrice}
                effectiveCasePrice={effectiveCasePrice}
                packDisplay={getPackDisplay(buildPayload())}
                finalDispatchPrice={roundCurrency(sanitizeNumber(form.actual_dispatch_weight_lb) * sanitizeNumber(form.actual_dispatch_unit_price))}
                onSave={handleSave}
                onCancel={() => setShowModal(false)}
                saveDisabled={saving || !form.name.trim()}
                saving={saving}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function LegacyHeaderCell({ children, align = 'left' }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return <th className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide ${alignClass}`} style={{ color: '#76899E' }}>{children}</th>;
}

function FilterSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded px-2 py-1.5 text-[12px] focus:outline-none"
      style={{ background: '#FFFFFF', color: '#20384F', border: '1px solid #B7C7D9', boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.06)' }}
    >
      {children}
    </select>
  );
}
