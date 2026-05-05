import { Outlet } from 'react-router-dom';
import { NavBar } from '@/components/layout/NavBar';
import { DoctorSidebar } from '@/components/layout/Sidebar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { mockDoctor } from '@/lib/mockData';

export default function DoctorLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar userName={mockDoctor.fullName} hasNotifications={true} role="doctor" />
      <div className="flex-1 flex overflow-hidden">
        <DoctorSidebar />
        <Outlet />
      </div>
      <BottomTabBar role="doctor" />
    </div>
  );
}
