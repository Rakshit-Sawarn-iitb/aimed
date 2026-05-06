import { useRef, useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavBarProps {
  userName?: string;
  hasNotifications?: boolean;
  role?: 'doctor' | 'patient';
  onLogout?: () => void;
}

export function NavBar({ userName, hasNotifications = false, role, onLogout }: NavBarProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = userName
    ? userName.replace(/^Dr\.\s*/, '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  useEffect(() => {
    if (!menuOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [menuOpen]);

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-card border-b border-border shrink-0">
      <button
        onClick={() => navigate(role === 'doctor' ? '/doctor' : '/patient')}
        className="flex items-center gap-2 min-h-[44px] transition-opacity hover:opacity-80"
      >
        <img src="/aimed-logo.jpeg" alt="AIMED Logo" className="w-8 h-8 rounded-md object-cover" />
        <span className="text-lg font-semibold tracking-tight text-primary">AIMED</span>
      </button>

      <div className="flex items-center gap-2">
        <button
          className="relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-secondary"
          title="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground" />
          {hasNotifications && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger" />
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className={cn(
              'flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors hover:bg-secondary',
              menuOpen && 'bg-secondary'
            )}
          >
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
              {initials}
            </div>
            {userName && (
              <span className="hidden md:block text-sm font-medium text-foreground max-w-[140px] truncate">
                {userName}
              </span>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">
                  Signed in as
                </p>
                <p className="text-sm font-medium truncate mt-0.5">{userName ?? '—'}</p>
              </div>
              {onLogout && (
                <button
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                  Log out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
