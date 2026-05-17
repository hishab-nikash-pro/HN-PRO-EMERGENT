import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getVendor, getVendorPurchaseOrders } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, EnvelopeSimple, Phone, MapPin } from '@phosphor-icons/react';

export default function VendorDetail() {
  const { vendorId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany || !vendorId) return;
    const load = async () => {
      try {
        const [vendorRes, poRes] = await Promise.all([
          getVendor(selectedCompany.company_id, vendorId),
          getVendorPurchaseOrders(selectedCompany.company_id, vendorId),
        ]);
        setVendor(vendorRes.data);
        setPurchaseOrders(poRes.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [selectedCompany, vendorId]);

  if (loading) {
    return <AppShell><div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} /></div></AppShell>;
  }
  if (!vendor) {
    return <AppShell><div className="text-center py-12" style={{ color: '#434655' }}>Vendor not found</div></AppShell>;
  }

  return (
    <AppShell>
      <div data-testid="vendor-detail-page" className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/vendors')} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{vendor.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: '#434655' }}>{vendor.company_name}</p>
          </div>
          <button
            data-testid="edit-vendor-btn"
            onClick={() => navigate(`/vendors/${vendorId}/edit`)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
            style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
          >
            Edit
          </button>
          <button
            onClick={() => navigate(`/vendor-ledger?vendor_id=${vendorId}`)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#F2F4F6]"
            style={{ color: '#191C1E', boxShadow: '0 0 0 1px #C4C5D7' }}
          >
            Ledger
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white" style={{ background: '#0F2D5C' }}>
                  {vendor.name?.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '#191C1E' }}>{vendor.name}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#dcfce7', color: '#16a34a' }}>{vendor.status}</span>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {vendor.phone && <div className="flex items-center gap-2" style={{ color: '#434655' }}><Phone size={16} /> {vendor.phone}</div>}
                {vendor.email && <div className="flex items-center gap-2" style={{ color: '#434655' }}><EnvelopeSimple size={16} /> {vendor.email}</div>}
                {vendor.address && <div className="flex items-center gap-2" style={{ color: '#434655' }}><MapPin size={16} /> {vendor.address}</div>}
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Purchasing Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#434655' }}>Payable Balance</span>
                  <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#BA1A1A' }}>
                    ${(vendor.payable_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#434655' }}>Total Billed</span>
                  <span className="font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    ${(vendor.total_billed || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#434655' }}>Bill Count</span>
                  <span className="font-semibold" style={{ color: '#191C1E' }}>{vendor.bill_count || 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl p-6" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Purchase Order History</h3>
              {purchaseOrders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: '#434655' }}>No purchase orders yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>PO</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Status</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: '#434655' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((order, i) => (
                      <tr key={order.purchase_order_id} onClick={() => navigate(`/purchase-orders/${order.purchase_order_id}`)} className="cursor-pointer hover:bg-[#F7F9FB]" style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#0F2D5C' }}>{order.purchase_order_number}</td>
                        <td className="px-4 py-3" style={{ color: '#434655' }}>{order.order_date}</td>
                        <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#0F2D5C' }}>{order.status}</span></td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>${(order.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
