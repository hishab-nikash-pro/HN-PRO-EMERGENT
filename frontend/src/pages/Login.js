import { Buildings } from '@phosphor-icons/react';

export default function Login() {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#F7F9FB' }}>
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative" style={{ background: 'linear-gradient(135deg, #0F2D5C 0%, #0E7490 50%, #0E7490 100%)' }}>
        <div className="text-center text-white px-12 relative z-10">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto mb-8" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)' }}>
            HN
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Hishab Nikash Pro
          </h1>
          <p className="text-lg opacity-80 max-w-md mx-auto leading-relaxed">
            Multi-company accounting and operations management system for wholesale import and distribution businesses.
          </p>
          <div className="mt-12 flex items-center justify-center gap-6 opacity-60 text-sm">
            <span>Sales & Invoicing</span>
            <span className="w-1 h-1 rounded-full bg-white" />
            <span>Inventory</span>
            <span className="w-1 h-1 rounded-full bg-white" />
            <span>Financial Reports</span>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(-20%, 20%)' }} />
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
              HN
            </div>
            <span className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>Hishab Nikash Pro</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Manrope, sans-serif', color: '#191C1E' }}>
              Welcome back
            </h2>
            <p className="text-sm mb-8" style={{ color: '#434655' }}>
              Sign in to access your accounting workspace
            </p>

            <button
              data-testid="google-login-btn"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-md"
              style={{ background: '#FFFFFF', color: '#191C1E', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px #E6E8EA' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: '#E6E8EA' }} />
              <span className="text-xs" style={{ color: '#434655' }}>or</span>
              <div className="flex-1 h-px" style={{ background: '#E6E8EA' }} />
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Email</label>
                <input
                  data-testid="login-email"
                  type="email"
                  placeholder="name@company.com"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-1"
                  style={{ background: '#FFFFFF', borderColor: '#C4C5D7', color: '#191C1E' }}
                  disabled
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#434655' }}>Password</label>
                <input
                  data-testid="login-password"
                  type="password"
                  placeholder="Enter password"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-1"
                  style={{ background: '#FFFFFF', borderColor: '#C4C5D7', color: '#191C1E' }}
                  disabled
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-not-allowed opacity-50" style={{ color: '#434655' }}>
                  <input type="checkbox" disabled className="rounded" />
                  Remember me
                </label>
                <span className="text-xs opacity-50" style={{ color: '#0F2D5C' }}>Forgot password?</span>
              </div>
              <button
                disabled
                className="w-full py-2.5 rounded-lg text-sm font-medium text-white opacity-50 cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}
              >
                Sign in
              </button>
              <p className="text-xs text-center" style={{ color: '#434655' }}>
                Use Google Sign-In for secure access
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-[11px]" style={{ color: '#434655', opacity: 0.5 }}>
              Hishab Nikash Pro — Powered by iAlam
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
