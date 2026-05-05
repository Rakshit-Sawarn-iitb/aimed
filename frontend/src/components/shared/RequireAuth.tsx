import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { auth } from '@/lib/api';

interface Props {
  role?: 'doctor' | 'patient';
}

export default function RequireAuth({ role }: Props) {
  const location = useLocation();

  if (!auth.isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role) {
    const current = auth.getRole();
    if (!current) {
      return <Navigate to="/onboarding" replace />;
    }
    if (current !== role) {
      return <Navigate to={current === 'doctor' ? '/doctor' : '/patient'} replace />;
    }
  }

  return <Outlet />;
}
