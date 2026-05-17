import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FilePdf, Printer } from '@phosphor-icons/react';
import AppShell from '../components/layout/AppShell';
import InvoiceRenderer from '../components/invoice/InvoiceRenderer';
import { useCompany } from '../contexts/CompanyContext';
import { getCustomer, getInvoice, getSettings } from '../lib/api';
import { normalizeInvoiceLayout } from '../lib/invoiceLayout';

export default function InvoicePrint() {
  const { invoiceId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany?.company_id || !invoiceId) return;
    let cancelled = false;
    async function loadInvoicePrint() {
      try {
        const [invoiceRes, settingsRes] = await Promise.all([
          getInvoice(selectedCompany.company_id, invoiceId),
          getSettings(selectedCompany.company_id),
        ]);
        if (cancelled) return;
        const nextInvoice = invoiceRes.data;
        let nextCustomer = null;
        if (nextInvoice?.customer_id) {
          try {
            const customerRes = await getCustomer(selectedCompany.company_id, nextInvoice.customer_id);
            nextCustomer = customerRes.data || null;
          } catch (error) {
            console.warn('Unable to load invoice customer address', error);
          }
        }
        if (cancelled) return;
        setInvoice(nextInvoice);
        setSettings(settingsRes.data || {});
        setCustomer(nextCustomer);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInvoicePrint();
    return () => { cancelled = true; };
  }, [invoiceId, selectedCompany?.company_id]);

  useEffect(() => {
    if (!loading && invoice && new URLSearchParams(window.location.search).get('export') === 'pdf') {
      window.setTimeout(() => window.print(), 350);
    }
  }, [invoice, loading]);

  const layout = useMemo(
    () => normalizeInvoiceLayout(settings?.invoice_layout, selectedCompany?.company_id),
    [settings?.invoice_layout, selectedCompany?.company_id]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    );
  }

  if (!invoice) {
    return <AppShell><div className="py-12 text-center" style={{ color: '#434655' }}>Invoice not found</div></AppShell>;
  }

  return (
    <AppShell>
      <div data-testid="invoice-print-page" className="space-y-5">
        <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/sales/${invoiceId}`)} className="rounded-xl p-2 transition-colors hover:bg-white" style={{ color: '#434655' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Print Invoice</h1>
              <p className="text-sm" style={{ color: '#434655' }}>A4 branded invoice renderer with live layout settings.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold" style={{ boxShadow: '0 0 0 1px #C4C5D7', color: '#0F2D5C' }}>
              <FilePdf size={16} />
              Export PDF
            </button>
            <button data-testid="print-btn" onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              <Printer size={16} />
              Print
            </button>
          </div>
        </div>

        <div className="invoice-print-preview overflow-x-auto">
          <InvoiceRenderer
            invoice={invoice}
            customer={customer}
            settings={settings || {}}
            company={selectedCompany}
            companyId={selectedCompany?.company_id || 'ckfrozen'}
            layout={layout}
          />
        </div>

        <style>{`
          @page { size: A4 portrait; margin: 0; }
          @media print {
            .no-print, aside, header[data-testid="app-header"], nav, [data-testid="app-sidebar"], [data-testid="app-header"], .roma-assistant-widget { display: none !important; }
            html, body, #root { background: white !important; width: auto !important; height: auto !important; }
            body { margin: 0 !important; padding: 0 !important; }
            main { margin: 0 !important; padding: 0 !important; overflow: visible !important; }
            .lg\\:ml-64 { margin-left: 0 !important; }
            .invoice-print-preview { overflow: visible !important; }
            .invoice-render-root { margin: 0 !important; width: 210mm !important; }
            .invoice-render-page { box-shadow: none !important; margin: 0 !important; }
          }
        `}</style>
      </div>
    </AppShell>
  );
}
