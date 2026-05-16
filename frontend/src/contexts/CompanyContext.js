import { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const {
    activeCompany,
    activeCompanyId,
    role,
    permissions,
    selectCompany: selectAuthCompany,
    checkAuth,
  } = useAuth();

  const grants = permissions?.grants || [];
  const grantMap = useMemo(() => permissions?.map || {}, [permissions]);

  const hasPermission = useCallback((slug) => Boolean(grantMap[slug]), [grantMap]);

  const can = useMemo(() => ({
    admin: role === 'OWNER',
    manage: role === 'OWNER' || role === 'MANAGER',
    write: role === 'OWNER' || role === 'MANAGER' || role === 'STAFF',
    read: Boolean(activeCompanyId),
    exportData: Boolean(permissions?.can_export_data),
    editPrice: Boolean(permissions?.can_edit_price),
    deleteInvoice: Boolean(permissions?.can_delete_invoice),
    viewProfit: Boolean(permissions?.can_view_profit),
    has: hasPermission,
  }), [activeCompanyId, hasPermission, permissions, role]);

  const selectCompany = async (company) => {
    const companyId = typeof company === 'string' ? company : company?.company_id;
    if (!companyId) return null;
    return selectAuthCompany(companyId);
  };

  const clearCompany = () => {
    localStorage.removeItem('hn_selected_company');
  };

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany: activeCompany,
        selectCompany,
        clearCompany,
        role,
        roleLoading: false,
        refreshRole: checkAuth,
        can,
        permissions: {
          ...permissions,
          grants,
        },
        companyProfile: activeCompany,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be inside CompanyProvider');
  return ctx;
};
