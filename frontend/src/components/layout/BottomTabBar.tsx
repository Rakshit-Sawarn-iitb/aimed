import { Calendar, Users, Bell } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BottomTabBarProps {
  role: 'doctor' | 'patient';
}

const doctorTabs = [
  { title: 'Today', url: '/doctor', icon: Calendar },
  { title: 'Patients', url: '/doctor/patients', icon: Users },
  { title: 'Notifications', url: '/doctor/notifications', icon: Bell },
];

const patientTabs = [
  { title: 'Home', url: '/patient', icon: Calendar },
  { title: 'Shares', url: '/patient/shares', icon: Users },
];

export function BottomTabBar({ role }: BottomTabBarProps) {
  const { pathname } = useLocation();
  const tabs = role === 'doctor' ? doctorTabs : patientTabs;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border flex justify-around items-center h-16 z-50">
      {tabs.map(tab => {
        const isActive = pathname === tab.url;
        return (
          <NavLink
            key={tab.url}
            to={tab.url}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[64px] text-xs',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <tab.icon className="h-5 w-5" />
            {isActive && <span className="font-medium">{tab.title}</span>}
          </NavLink>
        );
      })}
    </nav>
  );
}
