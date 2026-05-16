import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function WorkspaceAccess() {
  const navigate = useNavigate();
  const { user, activeCompanyId, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    navigate(activeCompanyId ? '/dashboard' : '/select-company', { replace: true });
  }, [activeCompanyId, loading, navigate, user]);

  return null;
}
