import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getVendors } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, Export } from '@phosphor-icons/react';

export default function VendorsList() {
  const { selectedCompany } = useCompany();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', company_name: '', phone: '', email: '', address: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    const load = async () => {
      try {
        const res = await getVendors(selectedCompany.company_id);
        setVendors(res.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [selectedCompany]);

  const filtered = vendors.filter(v =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateVendor = async () => {
    try {
      const { createVendor } = await import('../lib/api');
      await createVendor(selectedCompany.company_id, newVendor);
      setShowCreateModal(false);
      setNewVendor({ name: '', company_name: '', phone: '', email: '', address: '' });
      const res = await getVendors(selectedCompany.company_id);
      setVendors(res.data);
    } catch (err) { console.error(err); }
  };

  return (
    <AppShell>
      <div data-testid="vendors-list-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Vendors</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Manage vendor accounts and payables</p>
          </div>
          <button
            data-testid="create-vendor-btn"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
          >
            <Plus size={16} weight="bold" /> Add Vendor
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
            <input
              data-testid="vendors-search"
              type="text" placeholder="Search vendors..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
            />
          </div>
          <button className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: '#434655' }}><Export size={18} /></button>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F7F9FB', borderBottom: '1px solid #C4C5D7' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Vendor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Email</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Payable Balance</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Bills</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No vendors found</td></tr>
                ) : filtered.map((v, i) => (
                  <tr
                    key={v.vendor_id}
                    data-testid={`vendor-row-${v.vendor_id}`}
                    onClick={() => navigate(`/vendors/${v.vendor_id}`)}
                    className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                    style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: '#0F2D5C' }}>
                          {v.name?.charAt(0)}
                        </div>
                        <span className="font-medium" style={{ color: '#191C1E' }}>{v.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{v.company_name}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{v.phone}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{v.email}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: v.payable_balance > 0 ? '#BA1A1A' : '#191C1E' }}>
                      ${(v.payable_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: '#191C1E' }}>{v.bill_count || 0}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: v.status === 'Active' ? '#dcfce7' : '#F2F4F6', color: v.status === 'Active' ? '#16a34a' : '#434655' }}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create Vendor Modal */}
        {showCreateModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>New Vendor</h3>
              <div className="space-y-4">
                {[
                  { key: 'name', label: 'Vendor Name', placeholder: 'Full name' },
                  { key: 'company_name', label: 'Company', placeholder: 'Company name' },
                  { key: 'phone', label: 'Phone', placeholder: '(xxx) xxx-xxxx' },
                  { key: 'email', label: 'Email', placeholder: 'email@company.com' },
                  { key: 'address', label: 'Address', placeholder: 'Street, City, State' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>{label}</label>
                    <input
                      data-testid={`new-vendor-${key}`}
                      type="text" value={newVendor[key]} onChange={(e) => setNewVendor({ ...newVendor, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                      style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button data-testid="save-vendor-btn" onClick={handleCreateVendor} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  Save Vendor
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
