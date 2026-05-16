import { createContext, useContext, useEffect, useState } from 'react';

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const isMobilePreviewEmbed = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('mobile_preview_embed') === '1';
  const [mobilePreview, setMobilePreview] = useState(() => (
    isMobilePreviewEmbed ? false : localStorage.getItem('hn_mobile_preview') === 'true'
  ));
  const [density, setDensityState] = useState(() => (
    localStorage.getItem('hn_layout_density') || 'compact'
  ));

  useEffect(() => {
    if (isMobilePreviewEmbed) return;
    localStorage.setItem('hn_mobile_preview', mobilePreview ? 'true' : 'false');
  }, [isMobilePreviewEmbed, mobilePreview]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem('hn_layout_density', density);
  }, [density]);

  const setDensity = (nextDensity) => {
    setDensityState(nextDensity === 'comfortable' ? 'comfortable' : 'compact');
  };

  return (
    <UiContext.Provider value={{ mobilePreview, setMobilePreview, toggleMobilePreview: () => setMobilePreview((current) => !current), isMobilePreviewEmbed, density, setDensity }}>
      {children}
    </UiContext.Provider>
  );
}

export function useUi() {
  const context = useContext(UiContext);
  if (!context) throw new Error('useUi must be used within UiProvider');
  return context;
}
