import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';
import { useState } from 'react';
import { useUi } from '../../contexts/UiContext';
import { useLocation } from 'react-router-dom';

export default function AppShell({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { mobilePreview, setMobilePreview, isMobilePreviewEmbed, density } = useUi();
  const location = useLocation();

  if (isMobilePreviewEmbed) {
    return (
      <div className="min-h-screen overflow-x-hidden" style={{ background: '#F7F9FB' }}>
        <main className="min-w-0 px-3 pb-4 pt-3">
          <div className="mx-auto min-w-0 max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    );
  }

  const previewParams = new URLSearchParams(location.search);
  previewParams.set('mobile_preview_embed', '1');
  const previewSrc = `${location.pathname}?${previewParams.toString()}`;

  return (
    <div data-density={density} className="hn-app min-h-screen overflow-x-hidden" style={{ background: 'radial-gradient(circle at top left, rgba(14,116,144,0.08), transparent 28%), #F7F9FB' }}>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      <div className={`lg:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <Sidebar mobileMenuOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      </div>
      <div className="hn-app-content flex flex-col min-h-screen min-w-0 transition-all duration-200">
        <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 min-w-0 px-3 pb-24 pt-3 sm:px-4 sm:pt-4 md:px-5 lg:px-6 lg:pb-6 lg:pt-5">
          <div className="mx-auto min-w-0 max-w-[1600px]">
            {children}
          </div>
          {mobilePreview && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
              <div className="relative w-full max-w-[430px] rounded-[44px] border-[8px] border-[#162036] bg-[#F7F9FB] p-3 shadow-[0_26px_70px_rgba(15,45,92,0.34)]">
                <button
                  type="button"
                  onClick={() => setMobilePreview(false)}
                  className="absolute -right-3 -top-3 z-10 rounded-full bg-white px-3 py-2 text-xs font-bold shadow-lg"
                  style={{ color: '#0F2D5C' }}
                >
                  Close
                </button>
                <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-[#0F172A]" />
                <div className="overflow-hidden rounded-[28px] bg-[#F7F9FB]" style={{ height: 'min(820px, calc(100vh - 120px))' }}>
                  <iframe
                    title="Mobile preview"
                    src={previewSrc}
                    className="h-full w-full border-0"
                    style={{ background: '#F7F9FB' }}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
        {!mobilePreview && <MobileBottomNav />}
      </div>
    </div>
  );
}
