import React from 'react';
import {
  INVOICE_STATIC_ASSETS,
  isSectionVisible,
  normalizeInvoiceLayout,
} from '../../lib/invoiceLayout';

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;

const DEFAULT_COMPANY_DISPLAY = {
  ckfrozen: {
    name: 'C.K FROZEN FISH & FOOD INC',
    address: '168-56 DOUGLAS AVE, JAMAICA, NY-11433',
    phone: '866-CKFFNYC (253-3692)',
    fax: '718-297-2578, 718-297-2842',
    email: 'INFO@CKFFFUS.COM, CKFFFUSA@OUTLOOK.COM',
    website: 'WWW.CKFFFUS.COM',
  },
  haor: {
    name: 'HAOR HERITAGE INC.',
    address: '168-56 DOUGLAS AVE, JAMAICA, NY-11433',
    phone: '866-CKFFNYC (253-3692)',
    fax: '718-297-2578, 718-297-2842',
    email: 'INFO@CKFFFUS.COM',
    website: 'WWW.CKFFFUS.COM',
  },
  deshi: {
    name: 'SHAHI KING FOODS',
    address: '168-56 DOUGLAS AVE, JAMAICA, NY-11433',
    phone: '866-CKFFNYC (253-3692)',
    fax: '718-297-2578, 718-297-2842',
    email: 'INFO@CKFFFUS.COM',
    website: 'WWW.CKFFFUS.COM',
  },
  ckcanada: {
    name: 'C.K FROZEN FISH & FOOD CANADA INC.',
    address: '168-56 DOUGLAS AVE, JAMAICA, NY-11433',
    phone: '866-CKFFNYC (253-3692)',
    fax: '718-297-2578, 718-297-2842',
    email: 'INFO@CKFFFUS.COM',
    website: 'WWW.CKFFFUS.COM',
  },
};

export const SAMPLE_INVOICE_PREVIEW = {
  invoice_date: '2026-05-06',
  due_date: '2026-05-20',
  invoice_number: '64800',
  sales_rep: 'OVE',
  customer_name: 'SUPREME WHOLESALE INC',
  shipping_name: 'SUPREME WHOLESALE INC',
  shipping_street: '137 ARTHUR RD,',
  shipping_city: 'BUFFALO',
  shipping_state: 'NY',
  shipping_zip: '14207',
  total: 178.42,
  amount_paid: 0,
  balance_due: 178.42,
  items: [
    { quantity: 1, product: 'PUTI TRAY 4-6 (VAC)', description: '250GM X 25 @ 2.50', rate: 62.5, amount: 62.5 },
    { quantity: 1, product: 'ROHU 5 KG UP', description: '22 KGS / 48.50LB @ 2.39', rate: 115.92, amount: 115.92 },
  ],
};

function mm(value) {
  return `${Number(value || 0)}mm`;
}

function formatMoney(value, digits = 2) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatRate(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0.00';
  return number.toFixed(2);
}

function compactAddress(...parts) {
  return parts.filter(Boolean).join(', ');
}

function addressLines(invoice, customer = {}) {
  const shippingCityStateZip = compactAddress(
    invoice.shipping_city || customer.shipping_city || customer.city,
    invoice.shipping_state || customer.shipping_state || customer.state,
    invoice.shipping_zip || invoice.shipping_postal_code || customer.shipping_zip || customer.zip
  );
  const rawLines = [
    invoice.shipping_name,
    invoice.customer_name || customer.name,
    invoice.shipping_company || customer.company_name,
    invoice.shipping_address,
    invoice.shipping_street || customer.shipping_address || customer.address,
    shippingCityStateZip,
  ];
  const seen = new Set();
  return rawLines
    .filter(Boolean)
    .join('\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.toUpperCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function getCompanyDefaults(companyId, settings = {}, company = null) {
  const fallback = DEFAULT_COMPANY_DISPLAY[companyId] || DEFAULT_COMPANY_DISPLAY.ckfrozen;
  return {
    name: (settings.company_name || company?.name || fallback.name).toUpperCase(),
    address: (settings.company_address || fallback.address).toUpperCase(),
    phone: settings.company_phone || fallback.phone,
    fax: settings.company_fax || fallback.fax,
    email: (settings.company_email || fallback.email).toUpperCase(),
    website: (settings.company_website || fallback.website).toUpperCase(),
  };
}

function chunkInvoiceRows(rows, lineCount) {
  const firstPageRows = Math.max(12, Number(lineCount || 22));
  const continuationRows = Math.max(firstPageRows + 3, firstPageRows);
  if (rows.length <= firstPageRows) return [rows];
  const pages = [rows.slice(0, firstPageRows)];
  for (let index = firstPageRows; index < rows.length; index += continuationRows) {
    pages.push(rows.slice(index, index + continuationRows));
  }
  return pages;
}

function elementStyle(element, scale = 1, accentColor = '#0F2D5C', preview = false) {
  return {
    position: 'absolute',
    left: preview ? element.x * scale : mm(element.x),
    top: preview ? element.y * scale : mm(element.y),
    width: preview ? element.w * scale : mm(element.w),
    height: preview ? element.h * scale : mm(element.h),
    padding: preview ? element.padding * scale : mm(element.padding),
    boxSizing: 'border-box',
    border: element.border ? `${preview ? Math.max(1, 0.4 * scale) : 0.4}mm solid #3c4655` : 'none',
    overflow: 'hidden',
    background: element.type === 'totals' ? `${accentColor}08` : 'transparent',
  };
}

function textStyle(element, fontFamily, bodyFontSize) {
  return {
    fontFamily,
    fontSize: `${element.fontSize || bodyFontSize}pt`,
    textAlign: element.align || 'left',
    fontStyle: element.italic ? 'italic' : 'normal',
    fontWeight: element.bold ? 700 : 400,
  };
}

function InvoiceMetaBox({ invoice, element, fontFamily, bodyFontSize, preview = false, scale = 1, accentColor = '#0F2D5C' }) {
  return (
    <div className="invoice-meta-box" style={{ ...elementStyle(element, scale, accentColor, preview), ...textStyle(element, fontFamily, bodyFontSize) }}>
      <div className="meta-row head"><span>DATE</span><span>INVOICE #</span></div>
      <div className="meta-row"><span>{invoice.invoice_date || ''}</span><span>{invoice.invoice_number || ''}</span></div>
      <div className="meta-row"><span>Delivered By</span><span>{invoice.delivered_by || ''}</span></div>
      <div className="meta-row"><span>SALES REP</span><span>{(invoice.sales_rep || '').toUpperCase()}</span></div>
    </div>
  );
}

function InvoiceItemsTable({ rows, fontFamily, bodyFontSize, accentColor }) {
  return (
    <table className="invoice-items-table" style={{ fontFamily, fontSize: `${bodyFontSize}pt`, ['--accentColor']: accentColor }}>
      <thead>
        <tr>
          <th style={{ width: '8%' }}>QTY</th>
          <th style={{ width: '28%' }}>PRODUCT NAME</th>
          <th style={{ width: '36%' }}>DESCRIPTION</th>
          <th style={{ width: '14%' }}>UNIT PRICE</th>
          <th style={{ width: '14%' }}>AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item, index) => (
          <tr key={`${item.product || item.description}-${index}`}>
            <td className="qty">{Number(item.quantity || item.qty || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
            <td className="product">{item.product || item.product_name || item.item_name || ''}</td>
            <td className="description">{item.description || item.details || ''}</td>
            <td className="number">{formatRate(item.rate ?? item.unit_price ?? item.price)}</td>
            <td className="number">{formatMoney(item.amount ?? (Number(item.quantity || item.qty || 0) * Number(item.rate ?? item.unit_price ?? item.price ?? 0)))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderCustomElement(element, fontFamily, bodyFontSize, accentColor) {
  if (element.type === 'divider') {
    return <div className="invoice-divider" style={{ ...elementStyle(element), border: 'none', borderTop: `0.6mm solid ${accentColor}` }} />;
  }
  if (element.type === 'logo') {
    return <div className="invoice-custom-logo" style={{ ...elementStyle(element), display: 'flex', alignItems: 'center', justifyContent: 'center', ...textStyle(element, fontFamily, bodyFontSize) }}>Logo</div>;
  }
  return (
    <div style={{ ...elementStyle(element), ...textStyle(element, fontFamily, bodyFontSize), whiteSpace: 'pre-wrap' }}>
      {element.text || element.label}
    </div>
  );
}

function InvoicePage({
  invoice,
  customer,
  settings,
  companyId,
  company,
  layout,
  rows,
  pageIndex,
  pageCount,
  preview = false,
  scale = 1,
}) {
  const fontFamily = layout.fontFamily || 'Georgia';
  const bodyFontSize = layout.bodyFontSize || 8.5;
  const companyDisplay = getCompanyDefaults(companyId, settings, company);
  const address = addressLines(invoice, customer);
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.amount_paid || 0);
  const balance = Number(invoice.balance_due ?? total - paid);
  const showAddress = pageIndex === 0 && isSectionVisible(layout, 'address');
  const requiredIds = new Set(['companyLogo', 'companyInfo', 'invoiceTitle', 'invoiceMeta', 'customerAddress', 'brandLogos', 'itemTable', 'paymentInstructions', 'totals', 'thankYouFooter', 'signature']);
  const pageStyle = preview
    ? {
        position: 'relative',
        width: PAGE_WIDTH_MM * scale,
        height: PAGE_HEIGHT_MM * scale,
        background: '#fff',
        boxShadow: '0 18px 45px rgba(15,45,92,0.12)',
        overflow: 'hidden',
      }
    : {
        position: 'relative',
        width: `${PAGE_WIDTH_MM}mm`,
        height: `${PAGE_HEIGHT_MM}mm`,
        background: '#fff',
        overflow: 'hidden',
        pageBreakAfter: pageIndex === pageCount - 1 ? 'auto' : 'always',
        breakAfter: pageIndex === pageCount - 1 ? 'auto' : 'page',
      };

  const visibleElements = layout.elements.filter((element) => element.visible !== false);
  return (
    <section className={`invoice-render-page ${preview ? 'preview' : 'print'}`} style={pageStyle}>
      <div className="invoice-page-shell" style={{
        position: 'absolute',
        left: preview ? layout.pageMargins.left * scale : mm(layout.pageMargins.left),
        top: preview ? layout.pageMargins.top * scale : mm(layout.pageMargins.top),
        right: preview ? layout.pageMargins.right * scale : mm(layout.pageMargins.right),
        bottom: preview ? layout.pageMargins.bottom * scale : mm(layout.pageMargins.bottom),
      }}>
        {visibleElements.map((element) => {
          if (pageIndex > 0 && ['customerAddress', 'brandLogos', 'paymentInstructions', 'totals', 'thankYouFooter', 'signature'].includes(element.id)) {
            return null;
          }
          if (element.id === 'companyLogo') {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={settings.logo_url || INVOICE_STATIC_ASSETS.ckLogo}
                  alt="Company logo"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `scale(${Number(layout.logoScale || 100) / 100})` }}
                />
              </div>
            );
          }
          if (element.id === 'companyInfo') {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), ...textStyle(element, fontFamily, bodyFontSize) }}>
                <div className="invoice-company-name">{companyDisplay.name}</div>
                <div className="invoice-company-line">{companyDisplay.address}</div>
                <div className="invoice-company-line">{companyDisplay.phone}</div>
                <div className="invoice-company-line">{companyDisplay.fax}</div>
                <div className="invoice-company-line">{companyDisplay.email}</div>
                <div className="invoice-company-line">{companyDisplay.website}</div>
              </div>
            );
          }
          if (element.id === 'invoiceTitle') {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), ...textStyle(element, fontFamily, bodyFontSize) }} className="invoice-title-block">
                {element.text || 'INVOICE'}
              </div>
            );
          }
          if (element.id === 'invoiceMeta') {
            return (
              <InvoiceMetaBox
                key={element.id}
                invoice={invoice}
                element={{ ...element, border: true }}
                fontFamily={fontFamily}
                bodyFontSize={bodyFontSize}
                preview={preview}
                scale={scale}
                accentColor={layout.accentColor}
              />
            );
          }
          if (element.id === 'customerAddress' && showAddress) {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), ...textStyle(element, fontFamily, bodyFontSize) }} className="invoice-address-box">
                <div className="invoice-address-title">SHIPPING &amp; BILLING ADDRESS</div>
                <div className="invoice-address-lines">{address.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}</div>
              </div>
            );
          }
          if (element.id === 'brandLogos') return null;
          if (element.id === 'itemTable') {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), padding: 0 }}>
                <InvoiceItemsTable rows={rows} fontFamily={fontFamily} bodyFontSize={bodyFontSize} accentColor={layout.accentColor} />
              </div>
            );
          }
          if (element.id === 'paymentInstructions' && pageIndex === pageCount - 1 && isSectionVisible(layout, 'terms')) {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), ...textStyle(element, fontFamily, bodyFontSize) }} className="invoice-payment-box">
                <div className="invoice-payment-title">We Accept all Major Credit Cards</div>
                <div className="invoice-payment-subtitle">There will be 3% transaction fee</div>
                <div>* In every return checks, there will be a $30.00 fee</div>
                <div>* No claims will be accepted after 48 hours of delivery</div>
                <div>* No Return accepted for open box &amp; cut fishes</div>
                <div>* {(settings.invoice_terms_text || 'All payments must be paid within 14 days after delivery.').replace(/\.$/, '')}</div>
              </div>
            );
          }
          if (element.id === 'totals' && pageIndex === pageCount - 1 && isSectionVisible(layout, 'totals')) {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), ...textStyle(element, fontFamily, bodyFontSize) }} className="invoice-totals-box">
                <div className="invoice-total-row highlight"><span>TOTAL :</span><span>$ {formatMoney(total)}</span></div>
                <div className="invoice-total-row"><span>PAYMENT/CREDITS :</span><span>$ {formatMoney(paid)}</span></div>
                <div className="invoice-total-row"><span>BALANCE DUE :</span><span>$ {formatMoney(balance)}</span></div>
              </div>
            );
          }
          if (element.id === 'thankYouFooter' && pageIndex === pageCount - 1) {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), ...textStyle(element, fontFamily, bodyFontSize) }} className="invoice-thank-you">
                {element.text || 'Thank You For Your Business'}
              </div>
            );
          }
          if (element.id === 'signature' && pageIndex === pageCount - 1 && isSectionVisible(layout, 'signature')) {
            return (
              <div key={element.id} style={{ ...elementStyle(element, scale, layout.accentColor, preview), ...textStyle(element, fontFamily, bodyFontSize) }} className="invoice-signature-box">
                CUSTOMER SIGNATURE
              </div>
            );
          }
          if (!requiredIds.has(element.id)) {
            return <React.Fragment key={element.id}>{renderCustomElement(element, fontFamily, bodyFontSize, layout.accentColor)}</React.Fragment>;
          }
          return null;
        })}
        {pageIndex > 0 && (
          <div className="invoice-continuation-banner" style={{ position: 'absolute', left: 0, right: 0, top: 52, display: 'flex', justifyContent: 'space-between', fontFamily, fontSize: `${bodyFontSize}pt`, fontWeight: 700 }}>
            <span>Customer: {invoice.customer_name}</span>
            <span>Page {pageIndex + 1} of {pageCount}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default function InvoiceRenderer({
  invoice,
  customer = null,
  settings = {},
  company = null,
  companyId = 'ckfrozen',
  layout: rawLayout,
  preview = false,
  scale = 1,
  sample = false,
}) {
  const documentInvoice = sample ? SAMPLE_INVOICE_PREVIEW : invoice;
  const layout = normalizeInvoiceLayout(rawLayout, companyId);
  const rows = Array.isArray(documentInvoice?.items) ? documentInvoice.items : [];
  const pages = chunkInvoiceRows(rows, layout.lineCount);
  return (
    <div className={`invoice-render-root ${preview ? 'preview' : 'print'}`}>
      {pages.map((pageRows, index) => (
        <InvoicePage
          key={`invoice-page-${index}`}
          invoice={documentInvoice}
          customer={customer}
          settings={settings}
          company={company}
          companyId={companyId}
          layout={layout}
          rows={pageRows}
          pageIndex={index}
          pageCount={pages.length}
          preview={preview}
          scale={scale}
        />
      ))}
      <style>{`
        .invoice-render-root { width: fit-content; margin: 0 auto; }
        .invoice-render-page + .invoice-render-page { margin-top: 12px; }
        .invoice-company-name {
          font-size: 20pt;
          line-height: 1;
          font-weight: 700;
          letter-spacing: 0.2px;
          text-transform: uppercase;
        }
        .invoice-company-line {
          margin-top: 1.2mm;
          font-size: 10pt;
          line-height: 1.05;
        }
        .invoice-title-block {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          font-size: 28pt !important;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }
        .invoice-meta-box {
          display: grid;
          grid-template-rows: repeat(4, 1fr);
          background: #fff;
        }
        .invoice-meta-box .meta-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 0.4mm solid #3c4655;
        }
        .invoice-meta-box .meta-row:last-child { border-bottom: 0; }
        .invoice-meta-box .meta-row span {
          padding: 1.3mm 1.6mm;
          border-right: 0.4mm solid #3c4655;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .invoice-meta-box .meta-row span:last-child { border-right: 0; }
        .invoice-meta-box .meta-row.head span { font-weight: 700; }
        .invoice-address-box {
          display: flex;
          flex-direction: column;
        }
        .invoice-address-title {
          margin: -2mm -2mm 1.8mm;
          padding: 1.4mm 2mm;
          border-bottom: 0.4mm solid #3c4655;
          font-size: 10pt;
          font-weight: 700;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .invoice-address-lines {
          font-size: 9.5pt;
          line-height: 1.12;
          text-transform: uppercase;
        }
        .invoice-brand-grid {
          display: grid;
          width: 100%;
          height: 100%;
          gap: 3mm;
          align-items: center;
        }
        .invoice-brand-grid.ck { grid-template-columns: 1fr 0.95fr; }
        .invoice-brand-grid.haor,
        .invoice-brand-grid.shahi { grid-template-columns: 0.65fr 1fr 0.9fr; }
        .invoice-brand-grid img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .invoice-brand-small { max-width: 70%; max-height: 52%; opacity: 0.92; }
        .invoice-brand-secondary { max-width: 82%; max-height: 72%; opacity: 0.92; }
        .invoice-brand-haor-primary { max-width: 100%; max-height: 92%; }
        .invoice-brand-shahi-primary { max-width: 96%; max-height: 92%; }
        .invoice-items-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .invoice-items-table thead th {
          background: rgba(15,45,92,0.08);
          border-right: 0.35mm solid #8c97a7;
          border-bottom: 0.45mm solid #8c97a7;
          padding: 1.2mm 1mm;
          font-weight: 700;
          text-transform: uppercase;
          text-align: center;
        }
        .invoice-items-table thead th:last-child { border-right: 0; }
        .invoice-items-table tbody td {
          border-right: 0.35mm solid #b8c0cc;
          border-bottom: 0.35mm solid #d6dce4;
          padding: 1.2mm 1.4mm;
          vertical-align: top;
          line-height: 1.07;
        }
        .invoice-items-table tbody td:last-child { border-right: 0; }
        .invoice-items-table .qty { text-align: center; }
        .invoice-items-table .product { text-transform: uppercase; }
        .invoice-items-table .description { text-transform: uppercase; white-space: pre-wrap; }
        .invoice-items-table .number { text-align: right; }
        .invoice-items-table .blank td { height: 7.4mm; }
        .invoice-payment-box {
          display: flex;
          flex-direction: column;
          gap: 0.8mm;
          font-size: 7.3pt !important;
          line-height: 1.05;
        }
        .invoice-payment-title {
          font-size: 9.2pt;
          font-weight: 700;
        }
        .invoice-payment-subtitle {
          font-size: 8pt;
          font-weight: 700;
        }
        .invoice-totals-box {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1.2mm;
          font-size: 9pt !important;
        }
        .invoice-total-row {
          display: flex;
          justify-content: space-between;
          gap: 3mm;
          align-items: center;
        }
        .invoice-total-row.highlight {
          font-size: 11pt;
          font-weight: 700;
        }
        .invoice-thank-you {
          display: flex;
          align-items: center;
          font-size: 16pt !important;
          font-style: italic;
          font-weight: 700;
        }
        .invoice-signature-box {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8.8pt !important;
          text-transform: uppercase;
        }
        .invoice-custom-logo {
          color: #516171;
          background: rgba(15,45,92,0.04);
        }
        .invoice-continuation-banner {
          border-top: 0.4mm solid #3c4655;
          padding-top: 1mm;
        }
      `}</style>
    </div>
  );
}
