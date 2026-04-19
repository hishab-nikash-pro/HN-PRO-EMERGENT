import { useEffect, useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { getCustomers } from '../lib/api';
import AppShell from '../components/layout/AppShell';
import { useNavigate } from 'react-router-dom';
import { Plus, MagnifyingGlass, Export } from '@phosphor-icons/react';

export default function CustomersList() {
  const { selectedCompany } = useCompany();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', company_name: '', phone: '', email: '', address: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedCompany) return;
    const load = async () => {
      try {
        const res = await getCustomers(selectedCompany.company_id);
        setCustomers(res.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [selectedCompany]);

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateCustomer = async () => {
    try {
      const { createCustomer } = await import('../lib/api');
      await createCustomer(selectedCompany.company_id, newCustomer);
      setShowCreateModal(false);
      setNewCustomer({ name: '', company_name: '', phone: '', email: '', address: '' });
      const res = await getCustomers(selectedCompany.company_id);
      setCustomers(res.data);
    } catch (err) { console.error(err); }
  };

  return (
    <AppShell>
      <div data-testid="customers-list-page" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Customers</h1>
            <p className="text-sm mt-1" style={{ color: '#434655' }}>Manage customer accounts and balances</p>
          </div>
          <button
            data-testid="create-customer-btn"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
          >
            <Plus size={16} weight="bold" /> Add Customer
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#434655' }} />
            <input
              data-testid="customers-search"
              type="text" placeholder="Search customers..."
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
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Email</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Open Balance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#434655' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#434655' }}>No customers found</td></tr>
                ) : filtered.map((c, i) => (
                  <tr
                    key={c.customer_id}
                    data-testid={`customer-row-${c.customer_id}`}
                    onClick={() => navigate(`/customers/${c.customer_id}`)}
                    className="cursor-pointer transition-colors hover:bg-[#F7F9FB]"
                    style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFBFC', borderBottom: '1px solid #F2F4F6' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: '#0E7490' }}>
                          {c.name?.charAt(0)}
                        </div>
                        <span className="font-medium" style={{ color: '#191C1E' }}>{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{c.company_name}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{c.phone}</td>
                    <td className="px-4 py-3" style={{ color: '#434655' }}>{c.email}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: c.open_balance > 0 ? '#7F2500' : '#191C1E' }}>
                      ${(c.open_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: c.status === 'Active' ? '#dcfce7' : '#F2F4F6', color: c.status === 'Active' ? '#16a34a' : '#434655' }}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create Customer Modal */}
        {showCreateModal && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(25,28,30,0.5)' }}>
            <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#FFFFFF' }}>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>New Customer</h3>
              <div className="space-y-4">
                {[
                  { key: 'name', label: 'Customer Name', placeholder: 'Full name' },
                  { key: 'company_name', label: 'Company', placeholder: 'Company name' },
                  { key: 'phone', label: 'Phone', placeholder: '(xxx) xxx-xxxx' },
                  { key: 'email', label: 'Email', placeholder: 'email@company.com' },
                  { key: 'address', label: 'Address', placeholder: 'Street, City, State' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>{label}</label>
                    <input
                      data-testid={`new-customer-${key}`}
                      type="text" value={newCustomer[key]} onChange={(e) => setNewCustomer({ ...newCustomer, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                      style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px #C4C5D7', color: '#191C1E' }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: '#434655' }}>Cancel</button>
                <button data-testid="save-customer-btn" onClick={handleCreateCustomer} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
                  Save Customer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
