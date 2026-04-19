import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

export default function ProtectedRoute({ children, requireCompany = true }) {
  const { user, loading } = useAuth();
  const { selectedCompany } = useCompany();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F9FB' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #0F2D5C, #0E7490)' }}>
            HN
          </div>
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0F2D5C', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireCompany && !selectedCompany && location.pathname !== '/select-company') {
    return <Navigate to="/select-company" replace />;
  }

  return children;
}
