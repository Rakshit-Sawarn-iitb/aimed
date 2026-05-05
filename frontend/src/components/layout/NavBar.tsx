import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavBarProps {
  userName?: string;
  hasNotifications?: boolean;
  role?: 'doctor' | 'patient';
}

export function NavBar({ userName, hasNotifications = false, role }: NavBarProps) {
  const navigate = useNavigate();
  const initials = userName
    ? userName.replace(/^Dr\.\s*/, '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-card border-b border-border shrink-0">
      <button
        onClick={() => navigate(role === 'doctor' ? '/doctor' : '/patient')}
        className="flex items-center gap-2 min-h-[44px]"
      >
        <span className="text-lg font-semibold tracking-tight text-primary">AIMED</span>
      </button>

      <div className="flex items-center gap-3">
        <button
          className={cn('relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-secondary')}
          title="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground" />
          {hasNotifications && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger" />
          )}
        </button>

        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
          {initials}
        </div>
        {userName && (
          <span className="hidden md:block text-sm font-medium text-foreground">{userName}</span>
        )}
      </div>
    </header>
  );
}
