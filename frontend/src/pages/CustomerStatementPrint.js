import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getCustomerStatement } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, Printer } from '@phosphor-icons/react';

const COMPANY_INFO = {
  ckfrozen: { name: 'C.K FROZEN FISH & FOOD INC', address: '168-56 Douglas Ave, Jamaica, NY-11433', phone: '718-297-2578', email: 'CKFFFUSA@OUTLOOK.COM' },
  haor: { name: 'HAOR HERITAGE INC.', address: '168-56 Douglas Ave, Jamaica, NY-11433', phone: '718-297-2578', email: 'info@haorheritage.com' },
  deshi: { name: 'DESHI DISTRIBUTORS LLC', address: '168-56 Douglas Ave, Jamaica, NY-11433', phone: '718-297-2578', email: 'info@deshidist.com' },
  ckcanada: { name: 'CK FROZEN FISH & FOOD CANADA INC.', address: 'Toronto, ON, Canada', phone: '416-555-0100', email: 'info@ckcanada.com' },
};

export default function CustomerStatementPrint() {
  const { customerId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany || !customerId) return;
    getCustomerStatement(selectedCompany.company_id, customerId)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedCompany, customerId]);

  if (loading) return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  if (!data) return <AppShell><div className="text-center py-12" style={{ color: '#434655' }}>Statement not found</div></AppShell>;

  const info = COMPANY_INFO[selectedCompany?.company_id] || COMPANY_INFO.ckfrozen;
  const cust = data.customer || {};

  return (
    <AppShell>
      <div data-testid="customer-statement-page">
        <div className="flex items-center justify-between mb-6 no-print">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/customers/${customerId}`)} className="p-2 rounded-lg hover:bg-white" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Customer Statement</h1>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            <Printer size={16} /> Print
          </button>
        </div>

        <div id="statement-print" className="mx-auto" style={{ width: '210mm', minHeight: '297mm', background: '#FFFFFF', padding: '15mm', fontFamily: 'Inter, Arial, sans-serif', fontSize: '11px', color: '#191C1E', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '3px solid #0F2D5C', paddingBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'linear-gradient(135deg, #0F2D5C, #0E7490)', color: 'white', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>CK</div>
                <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '16px', fontWeight: 800, margin: 0, color: '#191C1E' }}>{info.name}</h1>
              </div>
              <p style={{ fontSize: '10px', color: '#434655', margin: '4px 0 0 50px' }}>{info.address}</p>
              <p style={{ fontSize: '10px', color: '#434655', margin: '2px 0 0 50px' }}>PH: {info.phone} | Email: {info.email}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: '20px', fontWeight: 800, color: '#0F2D5C', margin: '0 0 8px' }}>STATEMENT</h2>
              <p style={{ fontSize: '10px', color: '#434655', margin: '2px 0' }}>Date: {data.statement_date}</p>
            </div>
          </div>

          {/* Customer Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ border: '1px solid #C4C5D7', borderRadius: '6px', padding: '10px 14px', minWidth: '260px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#434655', marginBottom: '6px' }}>Bill To</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#191C1E' }}>{cust.name}</div>
              {cust.company_name && <div style={{ fontSize: '10px', color: '#434655' }}>{cust.company_name}</div>}
              {cust.address && <div style={{ fontSize: '10px', color: '#434655' }}>{cust.address}</div>}
              {cust.phone && <div style={{ fontSize: '10px', color: '#434655' }}>PH: {cust.phone}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ padding: '8px 16px', borderRadius: '8px', background: '#F2F4F6' }}>
                <p style={{ fontSize: '10px', color: '#434655', margin: '0 0 4px' }}>Balance Due</p>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: '20px', fontWeight: 800, color: data.balance_due > 0 ? '#BA1A1A' : '#16a34a', margin: 0 }}>
                  ${(data.balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ borderTop: '2px solid #191C1E', borderBottom: '2px solid #191C1E' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '80px' }}>Date</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '70px' }}>Type</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '90px' }}>Ref #</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Description</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '100px' }}>Amount</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', width: '100px' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {(data.transactions || []).map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #E6E8EA' }}>
                  <td style={{ padding: '6px 10px', fontSize: '10px' }}>{t.date}</td>
                  <td style={{ padding: '6px 10px', fontSize: '10px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: t.type === 'Payment' ? '#dcfce7' : '#dbeafe', color: t.type === 'Payment' ? '#16a34a' : '#0F2D5C' }}>{t.type}</span>
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '10px', color: '#434655' }}>{t.ref}</td>
                  <td style={{ padding: '6px 10px', fontSize: '10px' }}>{t.description}</td>
                  <td style={{ padding: '6px 10px', fontSize: '11px', textAlign: 'right', fontFamily: 'Manrope, monospace', fontWeight: 600, color: t.amount < 0 ? '#16a34a' : '#191C1E' }}>
                    {t.amount < 0 ? `-$${Math.abs(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `$${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '11px', textAlign: 'right', fontFamily: 'Manrope, monospace', fontWeight: 700 }}>
                    ${t.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '260px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #E6E8EA' }}>
                  <td style={{ padding: '6px 12px', fontSize: '11px', color: '#434655' }}>Total Invoiced</td>
                  <td style={{ padding: '6px 12px', fontSize: '11px', textAlign: 'right', fontFamily: 'Manrope, monospace', fontWeight: 600 }}>${(data.total_invoiced || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #E6E8EA' }}>
                  <td style={{ padding: '6px 12px', fontSize: '11px', color: '#434655' }}>Total Paid</td>
                  <td style={{ padding: '6px 12px', fontSize: '11px', textAlign: 'right', fontFamily: 'Manrope, monospace', fontWeight: 600, color: '#16a34a' }}>${(data.total_paid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #191C1E' }}>
                  <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 700 }}>BALANCE DUE</td>
                  <td style={{ padding: '8px 12px', fontSize: '14px', textAlign: 'right', fontFamily: 'Manrope, monospace', fontWeight: 800, color: '#BA1A1A' }}>${(data.balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #E6E8EA', paddingTop: '12px', fontSize: '9px', color: '#434655', lineHeight: '1.6' }}>
            <p style={{ margin: 0 }}>Please remit payment within 14 days. For questions about this statement, contact us at {info.phone} or {info.email}.</p>
            <p style={{ margin: '8px 0 0', fontWeight: 700, color: '#BA1A1A' }}>THANK YOU FOR YOUR BUSINESS</p>
            <p style={{ margin: '8px 0 0', opacity: 0.5 }}>Hishab Nikash Pro — Powered by iAlam</p>
          </div>
        </div>

        <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } #statement-print { box-shadow: none !important; margin: 0 !important; width: 100% !important; } aside, header, nav { display: none !important; } main { margin: 0 !important; padding: 0 !important; } .ml-64, .lg\\:ml-64 { margin-left: 0 !important; } }`}</style>
      </div>
    </AppShell>
  );
}
