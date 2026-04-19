import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getInvoice } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, Printer } from '@phosphor-icons/react';

const COMPANY_INFO = {
  ckfrozen: { name: 'C.K FROZEN FISH & FOOD INC', address: '168-56 Douglas Ave, Jamaica, NY-11433', phone: '718-297-2578', fax: '718-297-2842' },
  haor: { name: 'HAOR HERITAGE INC.', address: '168-56 Douglas Ave, Jamaica, NY-11433', phone: '718-297-2578', fax: '718-297-2842' },
  deshi: { name: 'DESHI DISTRIBUTORS LLC', address: '168-56 Douglas Ave, Jamaica, NY-11433', phone: '718-297-2578', fax: '718-297-2842' },
  ckcanada: { name: 'CK FROZEN FISH & FOOD CANADA INC.', address: 'Toronto, ON, Canada', phone: '416-555-0100', fax: '416-555-0101' },
};

export default function PackingListPrint() {
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

  const info = COMPANY_INFO[selectedCompany?.company_id] || COMPANY_INFO.ckfrozen;

  return (
    <AppShell>
      <div data-testid="packing-list-page">
        <div className="flex items-center justify-between mb-6 no-print">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/sales/${invoiceId}`)} className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Packing List</h1>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            <Printer size={16} /> Print
          </button>
        </div>

        <div id="packing-print" className="mx-auto" style={{ width: '210mm', minHeight: '297mm', background: '#FFFFFF', padding: '15mm', fontFamily: 'Inter, Arial, sans-serif', fontSize: '11px', color: '#191C1E', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '3px solid #0F2D5C', paddingBottom: '16px' }}>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '22px', fontWeight: 800, color: '#0F2D5C', margin: '0 0 4px' }}>PACKING LIST</h1>
            <p style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px', color: '#191C1E' }}>{info.name}</p>
            <p style={{ fontSize: '10px', color: '#434655', margin: 0 }}>{info.address} | PH: {info.phone} | FAX: {info.fax}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ border: '1px solid #C4C5D7', borderRadius: '6px', padding: '10px 14px', flex: 1, marginRight: '16px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#434655', marginBottom: '6px' }}>Ship To</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#191C1E' }}>{invoice.customer_name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <table style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: '#434655' }}>Invoice #:</td><td style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 700, color: '#191C1E' }}>{invoice.invoice_number}</td></tr>
                  <tr><td style={{ padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: '#434655' }}>Date:</td><td style={{ padding: '3px 10px', fontSize: '11px', color: '#191C1E' }}>{invoice.invoice_date}</td></tr>
                  <tr><td style={{ padding: '3px 10px', fontSize: '10px', fontWeight: 600, color: '#434655' }}>Warehouse:</td><td style={{ padding: '3px 10px', fontSize: '11px', color: '#191C1E' }}>{invoice.warehouse || 'Main Warehouse'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <thead>
              <tr style={{ borderTop: '2px solid #191C1E', borderBottom: '2px solid #191C1E' }}>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '40px' }}>#</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '60px' }}>QTY</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Item</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '60px' }}>Unit</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '80px' }}>Checked</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E6E8EA' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '11px' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '12px', fontWeight: 700 }}>{item.quantity}</td>
                  <td style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{item.product}</td>
                  <td style={{ padding: '8px 10px', fontSize: '10px', color: '#434655' }}>{item.description}</td>
                  <td style={{ padding: '8px 10px', fontSize: '11px' }}>{item.unit}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}><div style={{ width: '20px', height: '20px', border: '2px solid #C4C5D7', borderRadius: '3px', margin: '0 auto' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
            <div style={{ flex: 1, maxWidth: '250px' }}>
              <p style={{ fontSize: '10px', color: '#434655', margin: '0 0 4px' }}>Total Items: {(invoice.items || []).length}</p>
              <p style={{ fontSize: '10px', color: '#434655', margin: '0 0 4px' }}>Total Quantity: {(invoice.items || []).reduce((s, i) => s + (i.quantity || 0), 0)}</p>
              <p style={{ fontSize: '10px', color: '#434655', margin: '16px 0 0' }}>Packed by: ___________________________</p>
              <p style={{ fontSize: '10px', color: '#434655', margin: '12px 0 0' }}>Date: ___________________________</p>
            </div>
            <div style={{ flex: 1, maxWidth: '250px', textAlign: 'right' }}>
              <p style={{ fontSize: '10px', color: '#434655', margin: '0 0 16px' }}>Received in good condition:</p>
              <p style={{ fontSize: '10px', color: '#434655', margin: '0 0 12px' }}>Signature: ___________________________</p>
              <p style={{ fontSize: '10px', color: '#434655', margin: 0 }}>Date: ___________________________</p>
            </div>
          </div>
        </div>

        <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } #packing-print { box-shadow: none !important; margin: 0 !important; width: 100% !important; } aside, header, nav { display: none !important; } main { margin: 0 !important; padding: 0 !important; } .ml-64, .lg\\:ml-64 { margin-left: 0 !important; } }`}</style>
      </div>
    </AppShell>
  );
}
