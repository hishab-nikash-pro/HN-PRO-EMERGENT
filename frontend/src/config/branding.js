export const BRANDING = {
  appName: process.env.REACT_APP_APP_NAME || 'Hishab Nikash Pro',
  shortName: process.env.REACT_APP_APP_SHORT_NAME || 'HN',
  tagline: process.env.REACT_APP_APP_TAGLINE || 'Accounting, inventory, automation, and AI operations in one workspace.',
  poweredBy: process.env.REACT_APP_POWERED_BY || '',
  supportEmail: process.env.REACT_APP_SUPPORT_EMAIL || 'support@example.com',
  allowGoogleAuth: (process.env.REACT_APP_ALLOW_GOOGLE_AUTH || 'false').toLowerCase() === 'true',
};

export const brandFooter = BRANDING.poweredBy
  ? `${BRANDING.appName} - Powered by ${BRANDING.poweredBy}`
  : BRANDING.appName;
