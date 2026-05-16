import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { exchangeSession } from '../../lib/api';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        const hash = window.location.hash;
        const sessionId = new URLSearchParams(hash.substring(1)).get('session_id');
        if (!sessionId) {
          navigate('/login', { replace: true });
          return;
        }
        await exchangeSession(sessionId);
        await checkAuth();
        // Clean the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        navigate('/workspace-access', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login', { replace: true });
      }
    };
    processAuth();
  }, [checkAuth, navigate]);

  return null;
}
