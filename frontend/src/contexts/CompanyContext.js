import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const [selectedCompany, setSelectedCompany] = useState(() => {
    const saved = localStorage.getItem('hn_selected_company');
    return saved ? JSON.parse(saved) : null;
  });
  const [role, setRole] = useState('Viewer');
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    if (selectedCompany) {
      localStorage.setItem('hn_selected_company', JSON.stringify(selectedCompany));
    }
  }, [selectedCompany]);

  const refreshRole = useCallback(async () => {
    if (!selectedCompany?.company_id) { setRole('Viewer'); return; }
    setRoleLoading(true);
    try {
      const r = await api.get(`/auth/me-with-role?company_id=${selectedCompany.company_id}`);
      setRole(r.data?.role || 'Viewer');
    } catch {
      setRole('Viewer');
    } finally {
      setRoleLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => { refreshRole(); }, [refreshRole]);

  const selectCompany = (company) => setSelectedCompany(company);
  const clearCompany = () => {
    setSelectedCompany(null);
    setRole('Viewer');
    localStorage.removeItem('hn_selected_company');
  };

  // Permission helpers
  const can = {
    admin: role === 'Owner' || role === 'Admin',
    manage: ['Owner', 'Admin', 'Manager'].includes(role),
    write: ['Owner', 'Admin', 'Manager', 'Staff/Accountant'].includes(role),
    read: true,
  };

  return (
    <CompanyContext.Provider value={{ selectedCompany, selectCompany, clearCompany, role, roleLoading, refreshRole, can }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be inside CompanyProvider');
  return ctx;
};
