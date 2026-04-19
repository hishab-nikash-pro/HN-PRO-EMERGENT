import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useEffect, useState } from 'react';
import { getInvoice } from '../lib/api';
import { Printer, ArrowLeft } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';

const CK_LOGO = 'https://customer-assets.emergentagent.com/job_nikash-ops/artifacts/7isuelex_CK%20LOGO%20TRANSPARENT.png';
const HAOR_LOGO = 'https://customer-assets.emergentagent.com/job_nikash-ops/artifacts/7o55hrp5_WhatsApp%20Image%202026-03-19%20at%207.41.41%20PM.jpeg';
const SK_LOGO = 'https://customer-assets.emergentagent.com/job_nikash-ops/artifacts/he2uzdmw_SK%20Logo.jpeg';

export default function InvoicePrint() {
  const { invoiceId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany || !invoiceId) return;
    getInvoice(selectedCompany.company_id, invoiceId)
      .then(res => setInvoice(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, invoiceId]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  if (!invoice) return <AppShell><div className="text-center py-12" style={{ color: '#434655' }}>Invoice not found</div></AppShell>;

  // Fill empty rows up to at least 15 for the table
  const itemRows = invoice.items || [];
  const emptyRows = Math.max(0, 15 - itemRows.length);

  return (
    <AppShell>
      <div data-testid="invoice-print-page">
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-6 no-print">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/sales/${invoiceId}`)} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Print Invoice</h1>
          </div>
          <button data-testid="print-btn" onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            <Printer size={16} /> Print
          </button>
        </div>

        {/* ═══ INVOICE TEMPLATE — Exact Match to CK Frozen Fish Layout ═══ */}
        <div id="invoice-print-area" className="mx-auto" style={{
          width: '210mm', minHeight: '297mm', background: '#FFFFFF',
          padding: '10mm 12mm', fontFamily: "'Times New Roman', Times, serif",
          fontSize: '12px', color: '#000', boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          position: 'relative'
        }}>

          {/* ─── HEADER ROW ─── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>

            {/* LEFT: Company Logo + Info */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <img src={CK_LOGO} alt="CK Logo" style={{ width: '72px', height: 'auto', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
              <div>
                <h1 style={{ margin: 0, fontFamily: "'Old English Text MT', 'Times New Roman', serif", fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  C.K Frozen Fish & Food Inc
                </h1>
                <div style={{ fontSize: '11px', lineHeight: '1.5', fontFamily: "'Times New Roman', serif", textTransform: 'uppercase', marginTop: '2px' }}>
                  <div>168-56 Douglas Ave, Jamaica, NY-11433</div>
                  <div>PH: 718-297-2578, FAX: 718-297-2842</div>
                  <div>Email: CKFFFUSA@OUTLOOK.COM</div>
                  <div>Website:CKFROZENFISHUS.COM</div>
                </div>
              </div>
            </div>

            {/* RIGHT: Date & Invoice # Table */}
            <div>
              <table style={{ borderCollapse: 'collapse', border: '2px solid #000' }}>
                <thead>
                  <tr>
                    <th style={{ border: '2px solid #000', padding: '4px 16px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', background: '#fff' }}>DATE</th>
                    <th style={{ border: '2px solid #000', padding: '4px 16px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', background: '#fff' }}>INVOICE #</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '2px solid #000', padding: '4px 16px', fontSize: '13px', textAlign: 'center' }}>{invoice.invoice_date}</td>
                    <td style={{ border: '2px solid #000', padding: '4px 16px', fontSize: '13px', textAlign: 'center', fontWeight: 'bold' }}>{invoice.invoice_number?.replace('INV-', '') || ''}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: '6px' }}>
                <table style={{ borderCollapse: 'collapse', border: '2px solid #000', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td colSpan={2} style={{ border: '2px solid #000', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>Delivered by:</td>
                    </tr>
                    <tr>
                      <td style={{ border: '2px solid #000', padding: '3px 8px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', background: '#c00', color: '#fff', textAlign: 'center', letterSpacing: '1px' }}>SALES REP</td>
                      <td style={{ border: '2px solid #000', padding: '3px 12px', fontSize: '12px', textAlign: 'center' }}>{invoice.sales_rep || ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ─── SHIPPING ADDRESS + BRAND LOGOS ─── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            {/* Shipping Address Box */}
            <div style={{ border: '2px solid #000', padding: '6px 10px', minWidth: '220px', maxWidth: '260px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '4px' }}>
                SHIPPING & BILLING ADDRESS
              </div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: '1.4', textTransform: 'uppercase' }}>
                {invoice.customer_name || 'Customer Name'}<br />
                {invoice.shipping_address || ''}
              </div>
            </div>

            {/* Brand Logos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src={HAOR_LOGO} alt="Haor Heritage" style={{ height: '56px', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
              <img src={SK_LOGO} alt="Shahi King" style={{ height: '56px', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          </div>

          {/* ─── LINE ITEMS TABLE ─── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0', border: '2px solid #000' }}>
            <thead>
              <tr style={{ background: '#fff' }}>
                <th style={{ border: '2px solid #000', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', width: '50px' }}>QTY</th>
                <th style={{ border: '2px solid #000', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', width: '180px' }}>ITEMS</th>
                <th style={{ border: '2px solid #000', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center' }}>DESCRIPTION</th>
                <th style={{ border: '2px solid #000', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', width: '90px' }}>UNIT PRICE</th>
                <th style={{ border: '2px solid #000', padding: '6px 8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right', width: '100px' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {itemRows.map((item, i) => (
                <tr key={i}>
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1px solid #999', borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: '12px', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ borderRight: '1px solid #999', borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: '12px', textAlign: 'center', textTransform: 'uppercase', fontWeight: '600' }}>{item.product}</td>
                  <td style={{ borderRight: '1px solid #999', borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', textAlign: 'center' }}>{item.description}</td>
                  <td style={{ borderRight: '1px solid #999', borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: '12px', textAlign: 'right', fontFamily: "'Courier New', monospace" }}>{(item.rate || 0).toLocaleString('en-US', { minimumFractionDigits: 3 })}</td>
                  <td style={{ borderRight: '2px solid #000', borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: '12px', textAlign: 'right', fontFamily: "'Courier New', monospace" }}>{(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {/* Empty rows to fill the table */}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td style={{ borderLeft: '2px solid #000', borderRight: '1px solid #999', borderBottom: '1px solid #ccc', padding: '4px 8px', height: '22px' }}>&nbsp;</td>
                  <td style={{ borderRight: '1px solid #999', borderBottom: '1px solid #ccc', padding: '4px 8px' }}>&nbsp;</td>
                  <td style={{ borderRight: '1px solid #999', borderBottom: '1px solid #ccc', padding: '4px 8px' }}>&nbsp;</td>
                  <td style={{ borderRight: '1px solid #999', borderBottom: '1px solid #ccc', padding: '4px 8px' }}>&nbsp;</td>
                  <td style={{ borderRight: '2px solid #000', borderBottom: '1px solid #ccc', padding: '4px 8px' }}>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ─── FOOTER: Terms + Totals ─── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0' }}>

            {/* LEFT: Credit Card + Terms */}
            <div style={{ maxWidth: '340px' }}>
              <div style={{ border: '2px solid #000', padding: '6px 8px', marginBottom: '6px' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px' }}>We Accept all Major Credit Cards</p>
                <p style={{ margin: '2px 0 0', fontStyle: 'italic', fontSize: '11px' }}>There will be 3% transaction fee</p>
              </div>
              <div style={{ fontSize: '10px', lineHeight: '1.5', textTransform: 'uppercase', fontWeight: '500' }}>
                <p style={{ margin: '0 0 1px' }}>* In every return checks, there will be a $30.00 fee</p>
                <p style={{ margin: '0 0 1px' }}>* No claims will be accepted after 48 hours of delivery</p>
                <p style={{ margin: '0 0 1px' }}>* No return accepted for open box & cut fishes</p>
                <p style={{ margin: '0' }}>* All payments must be paid within 14 days after delivery</p>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <p style={{ fontFamily: "'Old English Text MT', 'Times New Roman', serif", fontSize: '18px', fontWeight: 'bold', color: '#c00', margin: 0, textTransform: 'uppercase' }}>Thank you for your<br />Business</p>
                <div style={{ background: '#3b5998', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                  Follow us on<br /><span style={{ fontSize: '14px' }}>Facebook</span>
                </div>
              </div>
            </div>

            {/* RIGHT: Totals Table */}
            <div style={{ minWidth: '260px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
                <tbody>
                  <tr style={{ borderBottom: '2px solid #000' }}>
                    <td style={{ padding: '6px 12px', fontWeight: 'bold', fontSize: '16px', textTransform: 'uppercase', fontFamily: "'Times New Roman', serif" }}>TOTAL</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px', fontFamily: "'Courier New', monospace" }}>
                      ${(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid #000' }}>
                    <td style={{ padding: '4px 12px', fontSize: '12px', fontWeight: '600' }}>Payments/Credits</td>
                    <td style={{ padding: '4px 12px', textAlign: 'right', fontSize: '12px', fontFamily: "'Courier New', monospace" }}>
                      ${(invoice.amount_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '2px solid #000' }}>
                    <td style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>BALANCE DUE</td>
                    <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', fontFamily: "'Courier New', monospace" }}>
                      ${(invoice.balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ textAlign: 'center', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid #000' }}>
                <p style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Customer Signature</p>
              </div>
            </div>
          </div>
        </div>

        {/* Print Styles */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; margin: 0; padding: 0; }
            #invoice-print-area {
              box-shadow: none !important;
              margin: 0 !important;
              width: 100% !important;
              padding: 8mm 10mm !important;
              min-height: auto !important;
            }
            aside, header, nav, [data-testid="app-sidebar"], [data-testid="app-header"] { display: none !important; }
            main { margin: 0 !important; padding: 0 !important; }
            .ml-64, .lg\\:ml-64 { margin-left: 0 !important; }
          }
        `}</style>
      </div>
    </AppShell>
  );
}
