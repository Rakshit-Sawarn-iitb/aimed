import { Outlet } from 'react-router-dom';
import { NavBar } from '@/components/layout/NavBar';
import { DoctorSidebar } from '@/components/layout/Sidebar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { useMe, profileName } from '@/hooks/useMe';

export default function DoctorLayout() {
  const { me, loading } = useMe();
  const name = profileName(me) || (loading ? '' : 'Doctor');

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar userName={name} hasNotifications={false} role="doctor" />
      <div className="flex-1 flex overflow-hidden">
        <DoctorSidebar />
        <Outlet />
      </div>
      <BottomTabBar role="doctor" />
    </div>
  );
}
