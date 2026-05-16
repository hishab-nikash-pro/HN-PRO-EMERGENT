import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearSessionToken,
  getMe,
  login as loginApi,
  logout as logoutApi,
  selectAuthCompany as selectAuthCompanyApi,
} from '../lib/api';

const AuthContext = createContext(null);

const EMPTY_PERMISSIONS = {
  grants: [],
  map: {},
  can_edit_price: false,
  can_delete_invoice: false,
  can_export_data: false,
  can_view_profit: false,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const [role, setRole] = useState('');
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const applyAuthPayload = useCallback((payload) => {
    setUser(payload?.user || null);
    setCompanies(Array.isArray(payload?.companies) ? payload.companies : []);
    setActiveCompanyId(payload?.active_company_id || null);
    setRole(payload?.role || '');
    setPermissions(payload?.permissions || EMPTY_PERMISSIONS);
  }, []);

  const clearAuthState = useCallback(() => {
    clearSessionToken();
    setUser(null);
    setCompanies([]);
    setActiveCompanyId(null);
    setRole('');
    setPermissions(EMPTY_PERMISSIONS);
    localStorage.removeItem('hn_selected_company');
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const res = await getMe();
      applyAuthPayload(res.data);
    } catch {
      clearAuthState();
    } finally {
      setLoading(false);
    }
  }, [applyAuthPayload, clearAuthState]);

  useEffect(() => {
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (activeCompanyId) {
      localStorage.setItem('hn_selected_company', activeCompanyId);
    } else {
      localStorage.removeItem('hn_selected_company');
    }
  }, [activeCompanyId]);

  const login = useCallback(async (credentials) => {
    const res = await loginApi(credentials);
    applyAuthPayload(res.data);
    return res.data;
  }, [applyAuthPayload]);

  const selectCompany = useCallback(async (companyId) => {
    const res = await selectAuthCompanyApi(companyId);
    applyAuthPayload(res.data);
    return res.data;
  }, [applyAuthPayload]);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // ignore
    }
    clearAuthState();
  }, [clearAuthState]);

  const activeCompany = useMemo(
    () => companies.find((company) => company.company_id === activeCompanyId) || null,
    [companies, activeCompanyId]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        companies,
        activeCompanyId,
        activeCompany,
        role,
        permissions,
        loading,
        login,
        logout,
        checkAuth,
        selectCompany,
        clearAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
