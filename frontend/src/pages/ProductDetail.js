import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil } from '@phosphor-icons/react';
import { useCompany } from '../contexts/CompanyContext';
import { getProduct, getProductQuickReport } from '../lib/api';
import AppShell from '../components/layout/AppShell';

const normalize = (value) => String(value || '').trim().toLowerCase();

function sanitizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUnitsPerCase(value) {
  const parsed = sanitizeNumber(value);
  return parsed > 0 ? parsed : 1;
}

function getUnitPrice(product) {
  return sanitizeNumber(product?.unit_price ?? product?.selling_price);
}

function getCasePrice(product) {
  if (String(product?.product_mode || '').toUpperCase() === 'WEIGHT') {
    return sanitizeNumber(product?.default_box_price ?? product?.case_price);
  }
  const explicit = sanitizeNumber(product?.case_price);
  if (explicit > 0) return explicit;
  return Math.round(getUnitPrice(product) * normalizeUnitsPerCase(product?.units_per_case) * 100) / 100;
}

function getPackDisplay(product) {
  if (String(product?.product_mode || '').toUpperCase() === 'WEIGHT') {
    const kg = sanitizeNumber(product?.default_box_weight_kg) || 20;
    const lb = sanitizeNumber(product?.default_box_weight_lb) || 44.1;
    return `${kg.toFixed(0)} KG BOX (${lb.toFixed(2)} LB)`;
  }
  const units = normalizeUnitsPerCase(product?.units_per_case);
  const label = String(product?.unit_label || product?.unit_type || product?.unit || 'PCS').toUpperCase();
  return `${units} ${label}/CASE`;
}

function buildQuickReportRoute(row) {
  if (!row?.record_id) return row?.link || '';
  if (row.type === 'Invoice') return `/sales/${row.record_id}`;
  if (row.type === 'Receive Stock') return `/receive-stock/${row.record_id}`;
  if (row.type === 'Bill') return `/bills/${row.record_id}`;
  return row?.link || '';
}

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [product, setProduct] = useState(null);
  const [quickReport, setQuickReport] = useState([]);
  const [reportType, setReportType] = useState('all');
  const [datePreset, setDatePreset] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);

  const today = useMemo(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
  }, []);

  const monthRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }, []);

  const reportRange = useMemo(() => {
    if (datePreset === 'today') {
      return { start: today, end: today };
    }
    if (datePreset === 'custom') {
      return { start: customStart, end: customEnd };
    }
    return monthRange;
  }, [customEnd, customStart, datePreset, monthRange, today]);

  useEffect(() => {
    if (!selectedCompany?.company_id || !productId) return;
    const load = async () => {
      setLoading(true);
      try {
        const productRes = await getProduct(selectedCompany.company_id, productId);
        setProduct(productRes.data || null);
      } catch (error) {
        console.error(error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompany?.company_id, productId]);

  useEffect(() => {
    if (!selectedCompany?.company_id || !productId) return;
    if (datePreset === 'custom' && (!customStart || !customEnd)) {
      setQuickReport([]);
      setReportLoading(false);
      return;
    }
    const loadQuickReport = async () => {
      setReportLoading(true);
      try {
        const response = await getProductQuickReport(selectedCompany.company_id, productId, {
          start_date: reportRange.start,
          end_date: reportRange.end,
          entry_type: reportType,
        });
        setQuickReport(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error(error);
        setQuickReport([]);
      } finally {
        setReportLoading(false);
      }
    };
    loadQuickReport();
  }, [customEnd, customStart, datePreset, productId, reportRange.end, reportRange.start, reportType, selectedCompany?.company_id]);

  const quickView = useMemo(() => {
    if (!product) return { soldQty: 0, customers: [], lastPrice: 0 };
    const salesLines = quickReport.filter((line) => line.entry_type === 'sales');
    const soldQty = salesLines.reduce((sum, line) => sum + Math.abs(sanitizeNumber(line.qty)), 0);
    const customers = [...new Set(salesLines.map((line) => line.name).filter(Boolean))];
    return {
      soldQty,
      customers,
      lastPrice: getUnitPrice(product),
    };
  }, [product, quickReport]);

  if (loading) {
    return <AppShell><div className="flex h-64 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  }
  if (!product) {
    return <AppShell><div className="py-12 text-center" style={{ color: '#434655' }}>Product not found.</div></AppShell>;
  }

  return (
    <AppShell>
      <div data-testid="product-detail-page" className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/products')} className="rounded-lg p-2 transition-colors hover:bg-white" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{product.name}</h1>
              <p className="mt-0.5 text-sm" style={{ color: '#434655' }}>{product.product_type || 'Inventory'} product</p>
            </div>
          </div>
          <button onClick={() => navigate(`/products/${productId}/edit`)} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[#F2F4F6]" style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}>
            <Pencil size={16} /> Edit
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <InfoCard title="Product">
            <Detail label="Name" value={product.name} />
            <Detail label="Category" value={product.category || '-'} />
            <Detail label="Description" value={product.description || '-'} />
            <Detail label="Packing" value={product.packing_text || getPackDisplay(product)} />
            <Detail label="Type" value={product.product_type || 'Inventory'} />
            <Detail label="Product Mode" value={String(product.product_mode || 'CASE').toUpperCase()} />
            <Detail label="Brand" value={product.brand || '-'} />
          </InfoCard>
          <InfoCard title="Wholesale Pricing">
            <Detail label="Cost Type" value={String(product.cost_type || 'UNIT').toUpperCase()} />
            <Detail label="Unit Type" value={String(product.unit_type || product.unit || 'PCS').toUpperCase()} />
            <Detail label="Unit Label" value={String(product.unit_label || product.unit_type || 'PCS').toUpperCase()} />
            <Detail label="Units Per Case" value={normalizeUnitsPerCase(product.units_per_case).toFixed(0)} />
            <Detail label="Unit Cost" value={`$${sanitizeNumber(product.unit_cost || product.cost_price).toFixed(2)}`} />
            <Detail label="Case Cost" value={`$${sanitizeNumber(product.case_cost).toFixed(2)}`} />
            <Detail label="Unit Price" value={`$${getUnitPrice(product).toFixed(2)}`} />
            <Detail label={String(product.product_mode || '').toUpperCase() === 'WEIGHT' ? 'Default Box Price' : 'Case Price'} value={`$${getCasePrice(product).toFixed(2)}`} />
            <Detail label="Price Basis" value={product.price_basis || '-'} />
            <Detail label="Cost" value={`$${sanitizeNumber(product.cost_price).toFixed(2)}`} />
            <Detail label="Last Sale Price" value={`$${sanitizeNumber(quickView.lastPrice).toFixed(2)}`} />
          </InfoCard>
          <InfoCard title="Quick View">
            <Detail label="Stock on Hand" value={`${sanitizeNumber(product.total_quantity_on_hand ?? product.quantity_on_hand ?? product.stock_cases ?? product.cases_on_hand).toFixed(2)} cases`} />
            <Detail label="Sold Qty" value={`${sanitizeNumber(quickView.soldQty).toFixed(2)} cases`} />
            <Detail label="Customers" value={quickView.customers.length ? quickView.customers.join(', ') : '-'} />
            <Detail label="Dispatch Weight LB" value={sanitizeNumber(product.actual_dispatch_weight_lb).toFixed(2)} />
            <Detail label="Dispatch Unit Price" value={`$${sanitizeNumber(product.actual_dispatch_unit_price).toFixed(2)}`} />
            <Detail label="Final Dispatch Price" value={`$${sanitizeNumber(product.final_dispatch_box_price).toFixed(2)}`} />
          </InfoCard>
        </div>

        <div className="space-y-4 rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Quick Report</h3>
              <p className="mt-1 text-xs" style={{ color: '#64748B' }}>Item history by sales and restock transactions.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PresetButton active={datePreset === 'today'} onClick={() => setDatePreset('today')}>Today</PresetButton>
              <PresetButton active={datePreset === 'this_month'} onClick={() => setDatePreset('this_month')}>This Month</PresetButton>
              <PresetButton active={datePreset === 'custom'} onClick={() => setDatePreset('custom')}>Custom</PresetButton>
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value)}
                className="rounded-lg px-3 py-2 text-xs focus:outline-none"
                style={{ background: '#FFFFFF', color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
              >
                <option value="all">All</option>
                <option value="sales">Sales</option>
                <option value="purchase">Purchase</option>
              </select>
            </div>
          </div>

          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl px-3 py-3" style={{ background: '#F7F9FB' }}>
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="rounded-lg px-3 py-2 text-xs focus:outline-none"
                style={{ background: '#FFFFFF', color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
              />
              <span className="text-xs" style={{ color: '#64748B' }}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="rounded-lg px-3 py-2 text-xs focus:outline-none"
                style={{ background: '#FFFFFF', color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
              />
            </div>
          )}

          {reportLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                    <ReportHeader>DATE</ReportHeader>
                    <ReportHeader>TYPE</ReportHeader>
                    <ReportHeader>NAME</ReportHeader>
                    <ReportHeader>DOC NO</ReportHeader>
                    <ReportHeader align="right">QTY</ReportHeader>
                    <ReportHeader align="right">BALANCE</ReportHeader>
                    <ReportHeader align="center">LINK</ReportHeader>
                  </tr>
                </thead>
                <tbody>
                  {quickReport.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm" style={{ color: '#64748B' }}>
                        No quick report activity for the selected filters.
                      </td>
                    </tr>
                  ) : quickReport.map((row) => (
                    <tr key={`${row.type}-${row.record_id}-${row.doc_no}`} style={{ borderBottom: '1px solid #F2F4F6' }}>
                      <td className="px-3 py-3" style={{ color: '#191C1E' }}>{formatDate(row.date)}</td>
                      <td className="px-3 py-3" style={{ color: '#191C1E' }}>{row.type}</td>
                      <td className="px-3 py-3" style={{ color: '#191C1E' }}>{row.name || '-'}</td>
                      <td className="px-3 py-3 font-medium" style={{ color: '#0F2D5C' }}>{row.doc_no || '-'}</td>
                      <td className="px-3 py-3 text-right tabular-nums" style={{ color: sanitizeNumber(row.qty) < 0 ? '#B42318' : '#027A48' }}>
                        {formatSignedQuantity(row.qty)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums" style={{ color: '#191C1E' }}>
                        {sanitizeNumber(row.balance).toFixed(2)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {buildQuickReportRoute(row) ? (
                          <button
                            type="button"
                            onClick={() => navigate(buildQuickReportRoute(row))}
                            className="text-xs font-semibold"
                            style={{ color: '#0F2D5C' }}
                          >
                            Open
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: '#94A3B8' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="space-y-4 rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{title}</h3>
      {children}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{label}</div>
      <div className="text-sm" style={{ color: '#191C1E' }}>{value}</div>
    </div>
  );
}

function PresetButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-3 py-2 text-xs font-semibold"
      style={{ background: active ? '#0F2D5C' : '#F7F9FB', color: active ? '#FFFFFF' : '#434655' }}
    >
      {children}
    </button>
  );
}

function ReportHeader({ children, align = 'left' }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return <th className={`px-3 py-3 text-[11px] font-semibold uppercase ${alignClass}`} style={{ color: '#64748B' }}>{children}</th>;
}

function formatDate(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function formatSignedQuantity(value) {
  const qty = sanitizeNumber(value);
  const prefix = qty > 0 ? '+' : '';
  return `${prefix}${qty.toFixed(2)}`;
}
