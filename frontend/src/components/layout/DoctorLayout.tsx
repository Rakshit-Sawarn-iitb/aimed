import { Outlet, useNavigate } from 'react-router-dom';
import { NavBar } from '@/components/layout/NavBar';
import { DoctorSidebar } from '@/components/layout/Sidebar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { useMe, profileName } from '@/hooks/useMe';
import { auth } from '@/lib/api';

export default function DoctorLayout() {
  const navigate = useNavigate();
  const { me, loading } = useMe();
  const name = profileName(me) || (loading ? '' : 'Doctor');

  const handleLogout = () => {
    auth.clear();
    navigate('/');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBar userName={name} hasNotifications={false} role="doctor" onLogout={handleLogout} />
      <div className="flex-1 flex overflow-hidden">
        <DoctorSidebar />
        <Outlet />
      </div>
      <BottomTabBar role="doctor" />
    </div>
  );
}
