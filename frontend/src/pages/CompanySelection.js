import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Buildings, SpinnerGap } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { BRANDING, brandFooter } from '../config/branding';

export default function CompanySelection() {
  const navigate = useNavigate();
  const { user, companies, loading } = useAuth();
  const { selectCompany } = useCompany();
  const [submittingId, setSubmittingId] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, navigate, user]);

  const handleSelect = async (company) => {
    try {
      setSubmittingId(company.company_id);
      await selectCompany(company.company_id);
      navigate('/dashboard', { replace: true });
    } finally {
      setSubmittingId('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(180deg, #F4FBFC 0%, #F7F9FB 100%)' }}>
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-[24px] flex items-center justify-center text-white font-bold text-xl mx-auto mb-5" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            {BRANDING.shortName}
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
            Select Company
          </h1>
          <p className="text-sm max-w-2xl mx-auto leading-7" style={{ color: '#475569' }}>
            {user?.name ? `Welcome, ${user.name}. ` : ''}Choose the company workspace you want to open.
          </p>
        </div>

        {loading ? (
          <div className="rounded-[28px] p-10 flex items-center justify-center gap-3" style={{ background: '#FFFFFF', boxShadow: '0 10px 35px rgba(15,45,92,0.06)' }}>
            <SpinnerGap size={20} className="animate-spin" style={{ color: '#0E7490' }} />
            <span style={{ color: '#475569' }}>Loading your company access...</span>
          </div>
        ) : (
          <>
            {!companies.length && (
              <div className="mb-5 rounded-2xl px-5 py-4 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
                No company access has been assigned to this user yet.
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {companies.map((company) => (
                <button
                  key={company.company_id}
                  data-testid={`select-company-${company.company_id}`}
                  onClick={() => handleSelect(company)}
                  disabled={submittingId === company.company_id}
                  className="group text-left p-7 rounded-[28px] transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: '#FFFFFF', boxShadow: '0 12px 38px rgba(15,45,92,0.06)' }}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#EAF6F8' }}>
                      <Buildings size={26} style={{ color: '#0E7490' }} />
                    </div>
                    <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: '#0F2D5C' }} />
                  </div>
                  <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
                    {company.name}
                  </h3>
                  <p className="text-sm leading-6" style={{ color: '#475569' }}>{company.type}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#F2F4F6', color: '#475569' }}>
                      {company.currency}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#ECFDF3', color: '#166534' }}>
                      {company.role}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-10 text-center">
          <p className="text-[11px]" style={{ color: '#64748B' }}>
            {brandFooter}
          </p>
        </div>
      </div>
    </div>
  );
}
