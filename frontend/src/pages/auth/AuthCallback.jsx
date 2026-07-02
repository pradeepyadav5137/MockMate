import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/services';

const AuthCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login?error=google', { replace: true });
      return;
    }
    localStorage.setItem('aic_token', token);
    authService.getMe()
      .then((res) => {
        login(token, res.data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => navigate('/login?error=google', { replace: true }));
  }, [params, navigate, login]);

  return <div className="min-h-screen flex items-center justify-center">Signing you in...</div>;
};

export default AuthCallback;
