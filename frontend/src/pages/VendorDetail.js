import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { getVendor } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { ArrowLeft, EnvelopeSimple, Phone, MapPin } from '@phosphor-icons/react';

export default function VendorDetail() {
  const { vendorId } = useParams();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany || !vendorId) return;
    const load = async () => {
      try {
        const res = await getVendor(selectedCompany.company_id, vendorId);
        setVendor(res.data);
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
              <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Bills & Payment History</h3>
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: '#434655' }}>Bill management will be available in Phase 2</p>
                <p className="text-xs mt-1" style={{ color: '#434655', opacity: 0.7 }}>Track vendor bills, payments, and credits</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
