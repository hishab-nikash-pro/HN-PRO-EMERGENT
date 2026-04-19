import { useNavigate } from 'react-router-dom';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import { seedData } from '../lib/api';
import { Buildings, ArrowRight, Fish, Storefront, Truck, Snowflake } from '@phosphor-icons/react';

const COMPANIES = [
  { company_id: 'ckfrozen', name: 'CK Frozen Fish & Food Inc.', short_name: 'CK Frozen', type: 'Wholesale Import & Distribution', currency: 'USD', icon: Fish, color: '#0F2D5C' },
  { company_id: 'haor', name: 'Haor Heritage Inc.', short_name: 'Haor Heritage', type: 'Wholesale & Retail', currency: 'USD', icon: Storefront, color: '#0E7490' },
  { company_id: 'deshi', name: 'Deshi Distributors LLC', short_name: 'Deshi Dist.', type: 'Distribution', currency: 'USD', icon: Truck, color: '#0E7490' },
  { company_id: 'ckcanada', name: 'CK Frozen Fish & Food Canada Inc.', short_name: 'CK Canada', type: 'Import & Distribution', currency: 'CAD', icon: Snowflake, color: '#0F2D5C' },
];

export default function CompanySelection() {
  const navigate = useNavigate();
  const { selectCompany } = useCompany();
  const { user } = useAuth();

  const handleSelect = async (company) => {
    selectCompany(company);
    try {
      await seedData(company.company_id);
    } catch { /* ignore if already seeded */ }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F7F9FB' }}>
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-5" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            HN
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
            Select Company
          </h1>
          <p className="text-sm" style={{ color: '#434655' }}>
            {user?.name ? `Welcome, ${user.name}. ` : ''}Choose a company to access its workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COMPANIES.map((company) => {
            const Icon = company.icon;
            return (
              <button
                key={company.company_id}
                data-testid={`select-company-${company.company_id}`}
                onClick={() => handleSelect(company)}
                className="group text-left p-6 rounded-2xl transition-all duration-200 hover:shadow-md"
                style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${company.color}12` }}>
                    <Icon size={24} style={{ color: company.color }} />
                  </div>
                  <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: '#0F2D5C' }} />
                </div>
                <h3 className="text-base font-semibold mb-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                  {company.name}
                </h3>
                <p className="text-xs" style={{ color: '#434655' }}>{company.type}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ background: '#F2F4F6', color: '#434655' }}>
                  {company.currency}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="text-[11px]" style={{ color: '#434655', opacity: 0.5 }}>
            Hishab Nikash Pro — Powered by iAlam
          </p>
        </div>
      </div>
    </div>
  );
}
