import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { BRANDING } from '../config/branding';

export default function SplashWelcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { selectedCompany } = useCompany();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !ready) return;
    if (user && selectedCompany?.company_id) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (user) {
      navigate('/select-company', { replace: true });
      return;
    }
    navigate('/login', { replace: true });
  }, [loading, ready, user, selectedCompany?.company_id, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'radial-gradient(circle at top left, rgba(14,116,144,0.18), transparent 32%), linear-gradient(180deg, #F4FBFC 0%, #F7F9FB 100%)' }}>
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-[28px] flex items-center justify-center text-white font-bold text-3xl" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)', boxShadow: '0 24px 60px rgba(15,45,92,0.18)' }}>
            {BRANDING.shortName}
          </div>
          <div className="absolute inset-[-14px] rounded-[36px] animate-ping" style={{ border: '2px solid rgba(14,116,144,0.18)' }} />
        </div>
        <h1 className="mt-8 text-3xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{BRANDING.appName}</h1>
        <p className="mt-2 text-sm max-w-md leading-6" style={{ color: '#475569' }}>
          Loading your accounting workspace...
        </p>
        <div className="mt-6 h-2 w-56 overflow-hidden rounded-full" style={{ background: '#DDE6EE' }}>
          <div className="h-full rounded-full animate-[pulse_1.2s_ease-in-out_infinite]" style={{ width: '62%', background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }} />
        </div>
      </div>
    </div>
  );
}
