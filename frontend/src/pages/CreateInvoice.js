import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FloppyDisk, Printer, Receipt, Trash } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import { useCompany } from '../contexts/CompanyContext';
import { createInvoice, getCustomers, getInvoice, getProducts, getSettings, updateInvoice } from '../lib/api';

const emptyItem = {
  product_id: '',
  product: '',
  description: '',
  quantity: 1,
  unit: 'case',
  pricing_mode: 'case',
  product_mode: 'CASE',
  unit_type: 'PCS',
  units_per_case: 1,
  unit_price: 0,
  case_price: 0,
  rate: 0,
  amount: 0,
  tax_rate: 0,
  tax: 0,
  quantity_input: '1',
  rate_input: '0',
  amount_input: '0',
};

const cardStyle = { background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const fieldClass = 'w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1';
const fieldStyle = { background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' };
const entryGridSize = 8;

function sanitizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePricingMode(value) {
  return String(value || '').toLowerCase() === 'unit' ? 'unit' : 'case';
}

function normalizeUnitType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ['PCS', 'KG', 'BOX'].includes(normalized) ? normalized : 'PCS';
}

function normalizeUnitsPerCase(value) {
  const parsed = sanitizeNumber(value);
  return parsed > 0 ? parsed : 1;
}

function getProductUnitType(product) {
  return normalizeUnitType(product?.unit_type || product?.unit);
}

function getProductUnitsPerCase(product) {
  return normalizeUnitsPerCase(product?.units_per_case || product?.case_quantity);
}

function getProductUnitPrice(product) {
  return sanitizeNumber(product?.unit_price ?? product?.selling_price);
}

function getProductCasePrice(product) {
  const explicit = sanitizeNumber(product?.case_price);
  if (explicit > 0) return explicit;
  return roundCurrency(getProductUnitPrice(product) * getProductUnitsPerCase(product));
}

function roundCurrency(value) {
  return Math.round(sanitizeNumber(value) * 100) / 100;
}

function getInvoiceUnitLabel(pricingMode, unitType) {
  return normalizePricingMode(pricingMode) === 'case' ? 'case' : normalizeUnitType(unitType).toLowerCase();
}

function getLinePricingRate(pricingMode, unitPrice, casePrice) {
  return normalizePricingMode(pricingMode) === 'case' ? sanitizeNumber(casePrice) : sanitizeNumber(unitPrice);
}

function hydrateInvoiceItem(item, fallbackTaxRate) {
  const pricingMode = normalizePricingMode(item.pricing_mode || (String(item.unit || '').toLowerCase() === 'case' ? 'case' : 'unit'));
  const unitType = normalizeUnitType(item.unit_type || item.unit);
  const unitsPerCase = normalizeUnitsPerCase(item.units_per_case);
  const unitPrice = sanitizeNumber(
    item.unit_price ?? (pricingMode === 'unit' ? item.rate : unitsPerCase ? sanitizeNumber(item.rate) / unitsPerCase : 0)
  );
  const casePrice = sanitizeNumber(item.case_price) || roundCurrency(unitPrice * unitsPerCase);
  const rate = sanitizeNumber(item.rate) || getLinePricingRate(pricingMode, unitPrice, casePrice);
  return recalcLine({
    ...emptyItem,
    ...item,
    pricing_mode: pricingMode,
    product_mode: String(item.product_mode || 'CASE').toUpperCase(),
    unit_type: unitType,
    units_per_case: unitsPerCase,
    unit_price: unitPrice,
    case_price: casePrice,
    unit: item.unit || getInvoiceUnitLabel(pricingMode, unitType),
    rate,
    quantity_input: String(item.quantity_input ?? item.quantity ?? 1),
    rate_input: String(item.rate_input ?? rate),
    amount_input: String(item.amount_input ?? item.amount ?? 0),
  }, fallbackTaxRate);
}

function evaluateExpression(rawValue, fallback = 0) {
  if (rawValue === null || rawValue === undefined) return fallback;
  const expression = String(rawValue).trim();
  if (!expression) return fallback;
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return fallback;

  try {
    // Limited arithmetic evaluator for inline pricing calculations.
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? result : fallback;
  } catch {
    return fallback;
  }
}

function recalcLine(item, fallbackTaxRate) {
  const quantity = Math.max(evaluateExpression(item.quantity_input ?? item.quantity, sanitizeNumber(item.quantity)), 0);
  const rate = Math.max(evaluateExpression(item.rate_input ?? item.rate, sanitizeNumber(item.rate)), 0);
  const taxRate = sanitizeNumber(item.tax_rate ?? fallbackTaxRate);
  const amount = quantity * rate;
  const tax = amount * (taxRate / 100);

  return {
    ...item,
    quantity,
    rate,
    amount,
    tax_rate: taxRate,
    tax,
    quantity_input: String(item.quantity_input ?? quantity),
    rate_input: String(item.rate_input ?? rate),
    amount_input: amount ? amount.toFixed(2) : '0',
  };
}

function recalcLineFromAmount(item, fallbackTaxRate) {
  const quantity = Math.max(evaluateExpression(item.quantity_input ?? item.quantity, sanitizeNumber(item.quantity)), 0);
  const amount = Math.max(evaluateExpression(item.amount_input ?? item.amount, sanitizeNumber(item.amount)), 0);
  const taxRate = sanitizeNumber(item.tax_rate ?? fallbackTaxRate);
  const rate = quantity > 0 ? amount / quantity : amount;
  const tax = amount * (taxRate / 100);

  return {
    ...item,
    quantity,
    rate,
    amount,
    tax_rate: taxRate,
    tax,
    quantity_input: String(item.quantity_input ?? quantity),
    rate_input: quantity > 0 ? rate.toFixed(2) : String(rate),
    amount_input: amount ? amount.toFixed(2) : '0',
  };
}

function isValidInvoiceLine(item) {
  return Boolean(item.product?.trim()) && sanitizeNumber(item.quantity) > 0 && sanitizeNumber(item.amount) > 0;
}

function isTouchedInvoiceLine(item) {
  return Boolean(item.product?.trim() || item.description?.trim())
    || sanitizeNumber(item.rate) > 0
    || sanitizeNumber(item.amount) > 0
    || !['', '1'].includes(String(item.quantity_input ?? item.quantity ?? '').trim());
}

function ensureEntryRows(rows) {
  const nextRows = [...rows];
  while (nextRows.length < entryGridSize) {
    nextRows.push({ ...emptyItem });
  }
  const last = nextRows[nextRows.length - 1];
  if (last && isTouchedInvoiceLine(last)) {
    nextRows.push({ ...emptyItem });
  }
  return nextRows;
}

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

function lookupLabels(option, getLabels) {
  const raw = getLabels(option);
  const values = Array.isArray(raw) ? raw : [raw];
  return values.filter(Boolean).map((value) => String(value));
}

function findBestMatch(options, value, getLabel) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return null;

  const entries = options.map((option) => ({
    option,
    labels: lookupLabels(option, getLabel).map(normalizeLookupValue),
  }));

  const exact = entries.find((entry) => entry.labels.some((label) => label === normalized));
  if (exact) return exact.option;

  const startsWithMatches = entries.filter((entry) => entry.labels.some((label) => label.startsWith(normalized)));
  if (startsWithMatches.length === 1) return startsWithMatches[0].option;

  const containsMatches = entries.filter((entry) => entry.labels.some((label) => label.includes(normalized)));
  if (containsMatches.length === 1) return containsMatches[0].option;

  return null;
}

function filterLookupOptions(options, value, getLabels, limit = 14) {
  const normalized = normalizeLookupValue(value);
  const matches = options
    .map((option, index) => {
      const labels = lookupLabels(option, getLabels).map(normalizeLookupValue);
      const matched = !normalized || labels.some((label) => label.includes(normalized));
      if (!matched) return null;
      const exact = labels.some((label) => label === normalized);
      const starts = labels.some((label) => label.startsWith(normalized));
      return { option, index, score: exact ? 0 : starts ? 1 : 2 };
    })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.option);
  return matches.length > 0 ? matches : options.slice(0, limit);
}

const customerLookupLabels = (customer) => [customer.name, customer.company_name, customer.phone, customer.email];
const productLookupLabels = (product) => [product.name, product.sku, product.item_number, product.product_code, product.description, product.category];

export default function CreateInvoice() {
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const { invoiceId } = useParams();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({ tax_rate: 0, invoice_prefix: 'INV', default_terms: 'Net 30' });
  const [form, setForm] = useState({
    customer_id: '',
    customer_name: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    sales_rep: '',
    warehouse: 'Main Warehouse',
    terms: 'Net 30',
    notes: '',
    customer_message: '',
    memo: '',
  });
  const [items, setItems] = useState(() => ensureEntryRows([{ ...emptyItem }]));
  const [loadedInvoice, setLoadedInvoice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeCustomerSearch, setActiveCustomerSearch] = useState(false);
  const [activeProductRow, setActiveProductRow] = useState(null);

  useEffect(() => {
    if (!selectedCompany?.company_id) return;

    Promise.all([
      getCustomers(selectedCompany.company_id),
      getProducts(selectedCompany.company_id),
      getSettings(selectedCompany.company_id),
      invoiceId ? getInvoice(selectedCompany.company_id, invoiceId) : Promise.resolve({ data: null }),
    ])
      .then(([customersRes, productsRes, settingsRes, invoiceRes]) => {
        const loadedSettings = settingsRes.data || { tax_rate: 0, invoice_prefix: 'INV', default_terms: 'Net 30' };
        setCustomers(customersRes.data || []);
        setProducts(productsRes.data || []);
        setSettings(loadedSettings);
        if (invoiceRes.data) {
          const invoice = invoiceRes.data;
          setLoadedInvoice(invoice);
          setForm({
            customer_id: invoice.customer_id || '',
            customer_name: invoice.customer_name || '',
            invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
            due_date: invoice.due_date || '',
            sales_rep: invoice.sales_rep || '',
            warehouse: invoice.warehouse || 'Main Warehouse',
            terms: invoice.terms || loadedSettings.default_terms || 'Net 30',
            notes: invoice.notes || '',
            customer_message: invoice.customer_message || '',
            memo: invoice.memo || '',
          });
          setItems(ensureEntryRows((invoice.items || []).map((item) => hydrateInvoiceItem(item, loadedSettings.tax_rate))));
        } else {
          setLoadedInvoice(null);
          setForm((current) => ({
            ...current,
            terms: current.terms || loadedSettings.default_terms || 'Net 30',
          }));
          setItems((current) => ensureEntryRows(current.map((item) => recalcLine(item, loadedSettings.tax_rate))));
        }
      })
      .catch(() => {});
  }, [selectedCompany?.company_id, invoiceId]);

  useEffect(() => {
    const extracted = location.state?.extractedData;
    if (!extracted) return;

    setForm((current) => ({
      ...current,
      customer_name: extracted.customer_name || current.customer_name,
      invoice_date: extracted.invoice_date || current.invoice_date,
      due_date: extracted.due_date || current.due_date,
      notes: extracted.notes || current.notes,
    }));

    if (extracted.items?.length) {
      setItems(
        ensureEntryRows(extracted.items.map((item) => hydrateInvoiceItem(item, settings.tax_rate)))
      );
    }
  }, [location.state, settings.tax_rate]);

  const totals = useMemo(() => {
    const validItems = items.filter(isValidInvoiceLine);
    const subtotal = validItems.reduce((sum, item) => sum + sanitizeNumber(item.amount), 0);
    const taxTotal = validItems.reduce((sum, item) => sum + sanitizeNumber(item.tax), 0);
    const total = subtotal + taxTotal;
    return { validItems, subtotal, taxTotal, total };
  }, [items]);

  const draftPreviewNumber = `${settings.invoice_prefix || 'INV'}-${String(settings.invoice_starting_number || 1001).padStart(4, '0')}`;
  const currentDocumentNumber = invoiceId ? 'Editing Invoice' : draftPreviewNumber;

  const customerSuggestions = useMemo(() => {
    if (!activeCustomerSearch) return [];
    return filterLookupOptions(customers, form.customer_name, customerLookupLabels, 18);
  }, [activeCustomerSearch, customers, form.customer_name]);

  const productSuggestions = (index) => {
    if (activeProductRow !== index) return [];
    return filterLookupOptions(products, items[index]?.product, productLookupLabels, 24);
  };

  const setLineInput = (index, field, value) => {
    setItems((current) =>
      ensureEntryRows(current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
    );
  };

  const commitLine = (index, mode = 'line') => {
    setItems((current) =>
      ensureEntryRows(current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        return mode === 'amount' ? recalcLineFromAmount(item, settings.tax_rate) : recalcLine(item, settings.tax_rate);
      }))
    );
  };

  const applyProductToLine = (index, productName, commitPartial = false) => {
    const selected = findBestMatch(products, productName, productLookupLabels);
    setItems((current) =>
      ensureEntryRows(current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (!selected) return { ...item, product: productName };
        const unitType = getProductUnitType(selected);
        const unitsPerCase = getProductUnitsPerCase(selected);
        const unitPrice = getProductUnitPrice(selected);
        const casePrice = getProductCasePrice(selected);
        return recalcLine(
          {
            ...item,
            product_id: selected.product_id || '',
            product: selected.name,
            description: selected.description || selected.weight_info || '',
            pricing_mode: 'case',
            product_mode: String(selected.product_mode || 'CASE').toUpperCase(),
            unit_type: unitType,
            units_per_case: unitsPerCase,
            unit_price: unitPrice,
            case_price: casePrice,
            unit: 'case',
            rate: casePrice,
            rate_input: String(casePrice),
            tax_rate: sanitizeNumber(selected.tax_rate ?? settings.tax_rate),
          },
          settings.tax_rate
        );
      }))
    );
    return Boolean(selected) || commitPartial;
  };

  const setLinePricingMode = (index, pricingMode) => {
    const normalizedMode = normalizePricingMode(pricingMode);
    setItems((current) =>
      ensureEntryRows(current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const rate = getLinePricingRate(normalizedMode, item.unit_price, item.case_price);
        return recalcLine(
          {
            ...item,
            pricing_mode: normalizedMode,
            unit: getInvoiceUnitLabel(normalizedMode, item.unit_type),
            rate,
            rate_input: String(rate),
          },
          settings.tax_rate
        );
      }))
    );
  };

  const applyCustomerToForm = (customerValue, commitPartial = false) => {
    const customer = findBestMatch(customers, customerValue, customerLookupLabels);
    setForm((current) => ({
      ...current,
      customer_id: customer?.customer_id || (commitPartial ? '' : current.customer_id),
      customer_name: customer?.name || customerValue,
    }));
    return Boolean(customer) || commitPartial;
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems((current) => ensureEntryRows(current.filter((_, itemIndex) => itemIndex !== index)));
  };

  const buildPayload = (status) => ({
    ...form,
    items: totals.validItems.map((item) => ({
      product_id: item.product_id || '',
      product: item.product,
      description: item.description,
      quantity: sanitizeNumber(item.quantity),
      unit: item.unit,
      pricing_mode: normalizePricingMode(item.pricing_mode),
      product_mode: String(item.product_mode || 'CASE').toUpperCase(),
      unit_type: normalizeUnitType(item.unit_type),
      units_per_case: normalizeUnitsPerCase(item.units_per_case),
      unit_price: sanitizeNumber(item.unit_price),
      case_price: sanitizeNumber(item.case_price),
      rate: sanitizeNumber(item.rate),
      amount: sanitizeNumber(item.amount),
      tax_rate: sanitizeNumber(item.tax_rate),
      tax: sanitizeNumber(item.tax),
    })),
    subtotal: Math.round(totals.subtotal * 100) / 100,
    tax_total: Math.round(totals.taxTotal * 100) / 100,
    discount_total: 0,
    total: Math.round(totals.total * 100) / 100,
    status,
    payment_status: 'Unpaid',
    amount_paid: invoiceId ? sanitizeNumber(loadedInvoice?.amount_paid) : 0,
  });

  const handleSave = async (status = 'Draft', afterSave = 'view') => {
    setErrorMessage('');
    const matchedCustomer = findBestMatch(customers, form.customer_name, customerLookupLabels);
    if (!matchedCustomer?.customer_id) {
      setErrorMessage('Please select a customer before saving the invoice.');
      return;
    }

    const resolvedItems = items.map((item) => {
      const selectedProduct = findBestMatch(products, item.product, productLookupLabels);
      if (!selectedProduct) return item;
      const pricingMode = normalizePricingMode(item.pricing_mode);
      const unitType = getProductUnitType(selectedProduct);
      const unitsPerCase = getProductUnitsPerCase(selectedProduct);
      const unitPrice = getProductUnitPrice(selectedProduct);
      const casePrice = getProductCasePrice(selectedProduct);
      return recalcLine(
        {
          ...item,
          product_id: selectedProduct.product_id || item.product_id || '',
          product: selectedProduct.name,
          description: item.description || selectedProduct.description || selectedProduct.weight_info || '',
          pricing_mode: pricingMode,
          product_mode: String(selectedProduct.product_mode || item.product_mode || 'CASE').toUpperCase(),
          unit_type: unitType,
          units_per_case: unitsPerCase,
          unit_price: unitPrice,
          case_price: casePrice,
          unit: getInvoiceUnitLabel(pricingMode, unitType),
          rate_input: item.rate_input || String(getLinePricingRate(pricingMode, unitPrice, casePrice)),
          tax_rate: sanitizeNumber(item.tax_rate || selectedProduct.tax_rate || settings.tax_rate),
        },
        settings.tax_rate
      );
    });

    const resolvedValidItems = resolvedItems.filter(isValidInvoiceLine);
    const resolvedSubtotal = resolvedValidItems.reduce((sum, item) => sum + sanitizeNumber(item.amount), 0);
    const resolvedTaxTotal = resolvedValidItems.reduce((sum, item) => sum + sanitizeNumber(item.tax), 0);
    const resolvedTotal = resolvedSubtotal + resolvedTaxTotal;

    if (resolvedValidItems.length === 0 || resolvedTotal <= 0) {
      setErrorMessage('Add at least one valid line item with product, quantity, and a positive amount.');
      return;
    }

    const invalidWholesaleRow = resolvedValidItems.find((item) => {
      const unitsPerCase = normalizeUnitsPerCase(item.units_per_case);
      const productMode = String(item.product_mode || '').toUpperCase();
      const pricingMode = normalizePricingMode(item.pricing_mode);
      const hasPrice = pricingMode === 'case' ? sanitizeNumber(item.case_price) > 0 : sanitizeNumber(item.unit_price) > 0;
      return unitsPerCase <= 0 || !['CASE', 'UNIT', 'WEIGHT'].includes(productMode) || !hasPrice;
    });
    if (invalidWholesaleRow) {
      setErrorMessage(`Product '${invalidWholesaleRow.product || 'line item'}' is missing wholesale setup. Check units per case, pricing, and product mode before saving.`);
      return;
    }

    setSaving(true);
    try {
      setItems(resolvedItems);
      const payload = {
        ...buildPayload(status),
        customer_id: matchedCustomer.customer_id,
        customer_name: matchedCustomer.name,
        items: resolvedValidItems.map((item) => ({
          product_id: item.product_id || '',
          product: item.product,
          description: item.description,
          quantity: sanitizeNumber(item.quantity),
          unit: item.unit,
          pricing_mode: normalizePricingMode(item.pricing_mode),
          product_mode: String(item.product_mode || 'CASE').toUpperCase(),
          unit_type: normalizeUnitType(item.unit_type),
          units_per_case: normalizeUnitsPerCase(item.units_per_case),
          unit_price: sanitizeNumber(item.unit_price),
          case_price: sanitizeNumber(item.case_price),
          rate: sanitizeNumber(item.rate),
          amount: sanitizeNumber(item.amount),
          tax_rate: sanitizeNumber(item.tax_rate),
          tax: sanitizeNumber(item.tax),
        })),
        subtotal: Math.round(resolvedSubtotal * 100) / 100,
        tax_total: Math.round(resolvedTaxTotal * 100) / 100,
        total: Math.round(resolvedTotal * 100) / 100,
      };
      const response = invoiceId
        ? await updateInvoice(selectedCompany.company_id, invoiceId, payload)
        : await createInvoice(selectedCompany.company_id, payload);
      const savedInvoiceId = response.data?.invoice_id || invoiceId;
      if (invoiceId && savedInvoiceId) {
        const fresh = await getInvoice(selectedCompany.company_id, savedInvoiceId);
        const invoice = fresh.data || response.data;
        setLoadedInvoice(invoice);
        setForm({
          customer_id: invoice.customer_id || '',
          customer_name: invoice.customer_name || '',
          invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
          due_date: invoice.due_date || '',
          sales_rep: invoice.sales_rep || '',
          warehouse: invoice.warehouse || 'Main Warehouse',
          terms: invoice.terms || settings.default_terms || 'Net 30',
          notes: invoice.notes || '',
          customer_message: invoice.customer_message || '',
          memo: invoice.memo || '',
        });
        setItems(ensureEntryRows((invoice.items || []).map((item) => hydrateInvoiceItem(item, settings.tax_rate))));
      }
      if (afterSave === 'print') {
        navigate(`/sales/${savedInvoiceId}/print`);
      } else {
        navigate(`/sales/${savedInvoiceId}`);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error?.response?.data?.detail || 'Unable to save the invoice right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div data-testid="create-invoice-page" className="mx-auto max-w-[1500px] space-y-4">
        <div className="rounded-[28px] border border-white/70 px-4 py-4 sm:px-5 sm:py-5" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.84))', boxShadow: '0 16px 40px rgba(15,45,92,0.08)' }}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <button onClick={() => navigate('/sales')} className="rounded-xl p-2 transition-colors hover:bg-white" style={{ color: '#434655' }}>
                <ArrowLeft size={20} />
              </button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: '#0E7490' }}>Sales Workspace</p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{invoiceId ? 'Edit Invoice' : 'Create Invoice'}</h1>
                <p className="mt-1 text-sm sm:text-base" style={{ color: '#434655' }}>A denser entry screen for fast transaction input, pricing, and review.</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[420px]">
              {[
                [invoiceId ? 'Mode' : 'Draft No.', currentDocumentNumber],
                ['Customer', form.customer_name || 'Unassigned'],
                ['Invoice Total', `$${totals.total.toFixed(2)}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl px-4 py-3" style={{ background: '#F7F9FB', boxShadow: 'inset 0 0 0 1px #E6E8EA' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{label}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: '#191C1E' }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                data-testid="save-draft-btn"
                onClick={() => handleSave('Draft')}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-[#F2F4F6]"
                style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
              >
                <FloppyDisk size={16} />
                Save Draft
              </button>
              <button
                data-testid="send-invoice-btn"
                onClick={() => handleSave('Sent')}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #26295C, #0F2D5C)' }}
              >
                <Receipt size={16} />
                Send Invoice
              </button>
              <button
                onClick={() => handleSave('Draft', 'print')}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #3B4F79, #1E3A6D)' }}
              >
                <Printer size={16} />
                Print
              </button>
            </div>
          </div>
          {errorMessage && (
            <div className="mt-4 rounded-2xl px-4 py-3 text-sm font-medium" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
              {errorMessage}
            </div>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_280px]">
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <section className="rounded-[28px] p-4 sm:p-5" style={cardStyle}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Customer & Billing</h2>
                  <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ background: '#EEF2FF', color: '#4C5FA8' }}>
                    Required
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Customer</label>
                    <div className="relative">
                    <input
                      data-testid="invoice-customer-select"
                      value={form.customer_name}
                      onChange={(event) => {
                        setActiveCustomerSearch(true);
                        setForm((current) => ({ ...current, customer_name: event.target.value, customer_id: '' }));
                      }}
                      onFocus={() => setActiveCustomerSearch(true)}
                      onBlur={(event) => {
                        setTimeout(() => setActiveCustomerSearch(false), 120);
                        applyCustomerToForm(event.target.value, true);
                      }}
                      placeholder="Type customer name and choose from list"
                      className={fieldClass}
                      style={fieldStyle}
                    />
                    {customerSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-72 overflow-y-auto rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: '#CBD5E1' }}>
                        {customerSuggestions.map((customer) => (
                          <button
                            key={customer.customer_id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              applyCustomerToForm(customer.name, true);
                              setActiveCustomerSearch(false);
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-[#EAF1FF]"
                            style={{ color: '#191C1E' }}
                          >
                            <span className="block font-semibold">{customer.name}</span>
                            {customer.company_name && <span className="block text-xs" style={{ color: '#64748B' }}>{customer.company_name}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Sales Rep</label>
                    <input data-testid="invoice-sales-rep" value={form.sales_rep} onChange={(event) => setForm((current) => ({ ...current, sales_rep: event.target.value }))} placeholder="Sales rep" className={fieldClass} style={fieldStyle} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Warehouse</label>
                    <input
                      data-testid="invoice-warehouse"
                      list="invoice-warehouse-options"
                      value={form.warehouse}
                      onChange={(event) => setForm((current) => ({ ...current, warehouse: event.target.value }))}
                      className={fieldClass}
                      style={fieldStyle}
                    />
                    <datalist id="invoice-warehouse-options">
                      {['Main Warehouse', 'Cold Storage A', 'Distribution Center'].map((warehouse) => (
                        <option key={warehouse} value={warehouse} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] p-4 sm:p-5" style={cardStyle}>
                <h2 className="mb-4 text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Document Control</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Invoice Date</label>
                    <input data-testid="invoice-date" type="date" value={form.invoice_date} onChange={(event) => setForm((current) => ({ ...current, invoice_date: event.target.value }))} className={fieldClass} style={fieldStyle} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Due Date</label>
                    <input data-testid="invoice-due-date" type="date" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} className={fieldClass} style={fieldStyle} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Terms</label>
                    <input
                      list="invoice-terms-options"
                      value={form.terms}
                      onChange={(event) => setForm((current) => ({ ...current, terms: event.target.value }))}
                      className={fieldClass}
                      style={fieldStyle}
                    />
                    <datalist id="invoice-terms-options">
                      {['Net 30', 'Net 15', 'Net 60', 'Due on Receipt'].map((term) => (
                        <option key={term} value={term} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-[28px] p-4 sm:p-5" style={cardStyle}>
              <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#E6E8EA' }}>
                <div>
                  <h2 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Line Items</h2>
                  <p className="mt-1 text-sm" style={{ color: '#434655' }}>Keyboard-friendly transaction rows with inline calculation support in unit price and amount.</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[0.55fr_1.6fr_2.2fr_1fr_1fr_0.5fr] gap-0 border-b px-2 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: '#D5DAE3', color: '#7B8AA3' }}>
                    <span className="px-2">Qty</span>
                    <span className="px-2">Items</span>
                    <span className="px-2">Description</span>
                    <span className="px-2 text-right">Unit Price</span>
                    <span className="px-2 text-right">Amount</span>
                    <span />
                  </div>

                  <div className="border-x border-b" style={{ borderColor: '#D5DAE3' }}>
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[0.55fr_1.6fr_2.2fr_1fr_1fr_0.5fr] gap-0"
                        style={{ background: index % 2 === 0 ? '#FFFFFF' : '#EAF1FF' }}
                      >
                        <div className="border-r px-2 py-1.5" style={{ borderColor: '#D5DAE3' }}>
                          <input
                            data-testid={`item-qty-${index}`}
                            value={item.quantity_input}
                            onChange={(event) => setLineInput(index, 'quantity_input', event.target.value)}
                            onBlur={() => commitLine(index)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitLine(index);
                              }
                            }}
                            className="w-full bg-transparent text-sm focus:outline-none"
                            style={{ color: '#191C1E' }}
                          />
                        </div>
                        <div className="border-r px-2 py-1.5" style={{ borderColor: '#D5DAE3' }}>
                          <div className="relative">
                          <input
                            data-testid={`item-product-${index}`}
                            value={item.product}
                            onChange={(event) => {
                              setActiveProductRow(index);
                              setLineInput(index, 'product', event.target.value);
                            }}
                            onFocus={() => setActiveProductRow(index)}
                            onBlur={(event) => {
                              setTimeout(() => setActiveProductRow(null), 120);
                              applyProductToLine(index, event.target.value, true);
                            }}
                            placeholder="Type item name"
                            className="w-full bg-transparent text-sm focus:outline-none"
                            style={{ color: '#191C1E' }}
                          />
                          {productSuggestions(index).length > 0 && (
                            <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-72 min-w-[280px] overflow-y-auto rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: '#CBD5E1' }}>
                              {productSuggestions(index).map((product) => (
                                <button
                                  key={product.product_id}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    applyProductToLine(index, product.name, true);
                                    setActiveProductRow(null);
                                  }}
                                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[#EAF1FF]"
                                  style={{ color: '#191C1E' }}
                                >
                                  <span className="block font-semibold">{product.name}</span>
                                  <span className="block text-xs" style={{ color: '#64748B' }}>
                                    {[
                                      product.sku && `SKU ${product.sku}`,
                                      `$${getProductCasePrice(product).toFixed(2)}/case`,
                                      `$${getProductUnitPrice(product).toFixed(2)}/${getProductUnitType(product).toLowerCase()}`,
                                    ].filter(Boolean).join(' · ') || 'Product'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <select
                              value={normalizePricingMode(item.pricing_mode)}
                              onChange={(event) => setLinePricingMode(index, event.target.value)}
                              className="rounded-md border px-2 py-0.5 text-[11px] font-medium focus:outline-none"
                              style={{ borderColor: '#CBD5E1', color: '#334155', background: '#FFFFFF' }}
                            >
                              <option value="case">Case</option>
                              <option value="unit">{item.unit_type || 'Unit'}</option>
                            </select>
                            <span className="text-[11px]" style={{ color: '#64748B' }}>
                              {normalizeUnitsPerCase(item.units_per_case)} {normalizeUnitType(item.unit_type)} / case
                            </span>
                          </div>
                          </div>
                        </div>
                        <div className="border-r px-2 py-1.5" style={{ borderColor: '#D5DAE3' }}>
                          <input
                            value={item.description}
                            onChange={(event) => setItems((current) => ensureEntryRows(current.map((entry, itemIndex) => (itemIndex === index ? { ...entry, description: event.target.value } : entry))))}
                            className="w-full bg-transparent text-sm focus:outline-none"
                            style={{ color: '#191C1E' }}
                          />
                        </div>
                        <div className="border-r px-2 py-1.5" style={{ borderColor: '#D5DAE3' }}>
                          <input
                            value={item.rate_input}
                            onChange={(event) => setLineInput(index, 'rate_input', event.target.value)}
                            onBlur={() => commitLine(index)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitLine(index);
                              }
                            }}
                            placeholder="46.30*1.29"
                            className="w-full bg-transparent text-right text-sm focus:outline-none"
                            style={{ color: '#191C1E' }}
                          />
                          <div className="mt-1 text-right text-[11px]" style={{ color: '#64748B' }}>
                            ${sanitizeNumber(item.rate).toFixed(2)} / {normalizePricingMode(item.pricing_mode) === 'case' ? 'CASE' : normalizeUnitType(item.unit_type)}
                          </div>
                        </div>
                        <div className="border-r px-2 py-1.5" style={{ borderColor: '#D5DAE3' }}>
                          <input
                            value={item.amount_input}
                            onChange={(event) => setLineInput(index, 'amount_input', event.target.value)}
                            onBlur={() => commitLine(index, 'amount')}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitLine(index, 'amount');
                              }
                            }}
                            className="w-full bg-transparent text-right text-sm focus:outline-none"
                            style={{ color: '#191C1E' }}
                          />
                        </div>
                        <div className="flex items-center justify-center px-1 py-1.5">
                          <button onClick={() => removeItem(index)} disabled={items.length === 1} className="rounded-lg p-1.5 transition-colors hover:bg-white/70 disabled:opacity-40" style={{ color: '#B91C1C' }}>
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, index) => (
                      <div key={`blank-${index}`} className="grid grid-cols-[0.55fr_1.6fr_2.2fr_1fr_1fr_0.5fr] gap-0" style={{ background: (items.length + index) % 2 === 0 ? '#FFFFFF' : '#EAF1FF', minHeight: '28px' }}>
                        {Array.from({ length: 6 }).map((__, cellIndex) => (
                          <div key={cellIndex} className={cellIndex < 5 ? 'border-r' : ''} style={{ borderColor: '#D5DAE3' }} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#7B8AA3' }}>Customer Message</label>
                    <input value={form.customer_message} onChange={(event) => setForm((current) => ({ ...current, customer_message: event.target.value }))} className={fieldClass} style={fieldStyle} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#7B8AA3' }}>Memo</label>
                    <input value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} className={fieldClass} style={fieldStyle} />
                  </div>
                </div>
                <div className="flex items-end justify-end">
                  <div className="flex w-full items-center justify-between rounded-2xl px-4 py-3" style={{ background: '#F8FAFC' }}>
                    <span className="text-2xl font-bold" style={{ color: '#191C1E' }}>Total:</span>
                    <span className="text-2xl font-bold tabular-nums" style={{ color: '#191C1E' }}>${totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[28px] p-4 sm:p-5" style={cardStyle}>
              <div className="space-y-2 text-sm">
                {[
                  ['Total', totals.total],
                  ['Payments Applied', 0],
                  ['Balance Due', totals.total],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span style={{ color: '#64748B' }}>{label}</span>
                    <span className="tabular-nums" style={{ color: '#191C1E' }}>${Number(value).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[22px] px-6 py-7 text-center" style={{ background: 'linear-gradient(135deg, #304774, #243A67)' }}>
                <p className="text-2xl font-bold text-white sm:text-4xl tabular-nums">${totals.total.toFixed(2)}</p>
              </div>
            </section>

            <section className="rounded-[28px] p-4 sm:p-5" style={cardStyle}>
              <h2 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Notes & Review</h2>
              <div className="mt-4 rounded-2xl p-4" style={{ background: '#F4F1F3' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#8B7F87' }}>Posting Preview</p>
                <p className="mt-2 text-sm" style={{ color: '#191C1E' }}>
                  {form.customer_name || 'No customer selected'} will be invoiced for <strong>${totals.total.toFixed(2)}</strong>.
                </p>
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#434655' }}>Notes</label>
                <textarea
                  data-testid="invoice-notes"
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  rows={5}
                  placeholder="Internal notes, delivery instructions, payment comments..."
                  className={`${fieldClass} resize-none`}
                  style={fieldStyle}
                />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
