import { Outlet } from 'react-router-dom';
import { NavBar } from '@/components/layout/NavBar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { useMe, profileName } from '@/hooks/useMe';

export default function PatientLayout() {
  const { me, loading } = useMe();
  const name = profileName(me) || (loading ? '' : 'Patient');

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBar userName={name} role="patient" />
      <Outlet />
      <BottomTabBar role="patient" />
    </div>
  );
}
