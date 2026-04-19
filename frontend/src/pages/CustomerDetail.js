import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getCustomer, getInvoices } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, EnvelopeSimple, Phone, MapPin, Receipt, CurrencyDollar } from '@phosphor-icons/react';

export default function CustomerDetail() {
  const { customerId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany || !customerId) return;
    const load = async () => {
      try {
        const [custRes, invRes] = await Promise.all([
          getCustomer(selectedCompany.company_id, customerId),
          getInvoices(selectedCompany.company_id)
        ]);
        setCustomer(custRes.data);
        setInvoices(invRes.data.filter(i => i.customer_id === customerId));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [selectedCompany, customerId]);

  if (loading) {
    return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  }
  if (!customer) {
    return <AppShell><div className="text-center py-12" style={{ color: '#434655' }}>Customer not found</div></AppShell>;
  }

  return (
    <AppShell>
      <div data-testid="customer-detail-page" className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/customers')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{customer.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{customer.company_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="edit-customer-btn"
              onClick={() => navigate(`/customers/${customerId}/edit`)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
              style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
            >
              Edit
            </button>
            <button
              data-testid="customer-statement-btn"
              onClick={() => navigate(`/customers/${customerId}/statement`)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
              style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
            >
              Statement
            </button>
            <button
              data-testid="create-invoice-for-customer"
              onClick={() => navigate('/sales/new')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
            >
              Create Invoice
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white" style={{ background: '#0E7490' }}>
                  {customer.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '#191C1E' }}>{customer.name}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{customer.status}</span>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {customer.phone && <div className="flex items-center gap-2" style={{ color: '#434655' }}><Phone size={16} /> {customer.phone}</div>}
                {customer.email && <div className="flex items-center gap-2" style={{ color: '#434655' }}><EnvelopeSimple size={16} /> {customer.email}</div>}
                {customer.address && <div className="flex items-center gap-2" style={{ color: '#434655' }}><MapPin size={16} /> {customer.address}</div>}
              </div>
            </div>
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Financial Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#434655' }}>Open Balance</span>
                  <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#7F2500' }}>
                    ${(customer.open_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#434655' }}>Total Invoiced</span>
                  <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    ${(customer.total_invoiced || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#434655' }}>Last Invoice</span>
                  <span style={{ color: '#191C1E' }}>{customer.last_invoice_date || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E6E8EA' }}>
                <h3 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Invoices ({invoices.length})</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Invoice</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Total</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-sm" style={{ color: '#434655' }}>No invoices yet</td></tr>
                  ) : invoices.map((inv, i) => (
                    <tr
                      key={inv.invoice_id}
                      onClick={() => navigate(`/sales/${inv.invoice_id}`)}
                      className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                      style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{inv.invoice_number}</td>
                      <td className="px-4 py-3" style={{ color: '#434655' }}>{inv.invoice_date}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: inv.status === 'Paid' ? '#dcfce7' : inv.status === 'Overdue' ? '#fef2f2' : '#dbeafe',
                            color: inv.status === 'Paid' ? '#16a34a' : inv.status === 'Overdue' ? '#BA1A1A' : '#0F2D5C'
                          }}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                        ${(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: inv.balance_due > 0 ? '#7F2500' : '#191C1E' }}>
                        ${(inv.balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
