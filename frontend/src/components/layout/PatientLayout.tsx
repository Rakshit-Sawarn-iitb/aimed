import { Outlet } from 'react-router-dom';
import { NavBar } from '@/components/layout/NavBar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { mockPatient } from '@/lib/mockData';

export default function PatientLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar userName={mockPatient.fullName} role="patient" />
      <Outlet />
      <BottomTabBar role="patient" />
    </div>
  );
}
