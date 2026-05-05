import { Calendar, Users, Bell } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { title: "Today's consults", url: '/doctor', icon: Calendar },
  { title: 'All patients', url: '/doctor/patients', icon: Users },
];

export function DoctorSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card shrink-0">
      <nav className="flex-1 py-4 px-3 space-y-1">
        {items.map(item => {
          const isActive = pathname === item.url || (item.url !== '/doctor' && pathname.startsWith(item.url));
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px]',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
