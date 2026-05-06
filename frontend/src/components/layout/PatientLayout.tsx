import { Outlet, useNavigate } from 'react-router-dom';
import { NavBar } from '@/components/layout/NavBar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { useMe, profileName } from '@/hooks/useMe';
import { auth } from '@/lib/api';

export default function PatientLayout() {
  const navigate = useNavigate();
  const { me, loading } = useMe();
  const name = profileName(me) || (loading ? '' : 'Patient');

  const handleLogout = () => {
    auth.clear();
    navigate('/');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBar userName={name} role="patient" onLogout={handleLogout} />
      <Outlet />
      <BottomTabBar role="patient" />
    </div>
  );
}
