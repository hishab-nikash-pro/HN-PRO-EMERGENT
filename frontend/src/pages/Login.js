import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { BRANDING, brandFooter } from '../config/branding';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = await login(form);
      navigate(payload.active_company_id ? '/dashboard' : '/select-company');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F7F9FB' }}>
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative px-12" style={{ background: 'linear-gradient(155deg, #08182F 0%, #0F2D5C 45%, #0E7490 100%)' }}>
        <div className="text-white relative z-10 max-w-xl">
          <div className="w-20 h-20 rounded-[28px] flex items-center justify-center text-3xl font-bold mb-8" style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)' }}>
            {BRANDING.shortName}
          </div>
          <p className="text-xs uppercase tracking-[0.24em] opacity-70">Business Accounting Workspace</p>
          <h1 className="text-5xl font-extrabold mt-4 leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {BRANDING.appName}
          </h1>
          <p className="text-base mt-5 leading-8 opacity-80">
            Centralize accounting, inventory, team approvals, AI copilots, and automation.
          </p>
        </div>
        <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at 20% 20%, #67E8F9, transparent 20%), radial-gradient(circle at 80% 30%, #FFFFFF, transparent 18%)' }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md rounded-[30px] p-8" style={{ background: '#FFFFFF', boxShadow: '0 20px 60px rgba(15,45,92,0.08)' }}>
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              {BRANDING.shortName}
            </div>
            <span className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>{BRANDING.appName}</span>
          </div>

          <p className="text-xs uppercase tracking-[0.22em]" style={{ color: '#0E7490' }}>Sign In</p>
          <h2 className="text-3xl font-bold mt-3" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
            Enter your workspace
          </h2>
          <p className="text-sm mt-3 leading-6" style={{ color: '#475569' }}>
            Sign in with your email and password. If your account has more than one company, you will choose the workspace right after login.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-2xl text-sm"
                style={inputStyle}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="w-full px-4 py-3 rounded-2xl text-sm"
                style={inputStyle}
              />
            </Field>
            <button
              disabled={loading}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
            >
              {loading ? 'Signing in...' : 'Sign in with email'}
            </button>
          </form>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/select-company')}
              className="flex-1 py-3 rounded-2xl text-sm font-medium"
              style={{ background: '#F2F4F6', color: '#0F2D5C' }}
            >
              Select company first
            </button>
            <button
              onClick={() => navigate('/workspace-access')}
              className="flex-1 py-3 rounded-2xl text-sm font-medium inline-flex items-center justify-center gap-2"
              style={{ background: '#EFF6FF', color: '#0F2D5C' }}
            >
              Company access
              <ArrowRight size={16} />
            </button>
          </div>

          <p className="text-[11px] mt-8 text-center" style={{ color: '#64748B' }}>{brandFooter}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  background: '#FFFFFF',
  color: '#191C1E',
  boxShadow: '0 0 0 1px #CBD5E1',
  outline: 'none',
};
