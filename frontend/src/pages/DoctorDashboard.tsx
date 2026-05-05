import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useMe, profileName } from '@/hooks/useMe';
import { api } from '@/lib/api';
import type { ConsultListItem, ConsultStatus } from '@/types';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { me } = useMe();
  const name = profileName(me);
  const firstName = name ? name.split(' ').slice(-1)[0] : '';

  const [consults, setConsults] = useState<ConsultListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ConsultListItem[]>('/consults')
      .then(setConsults)
      .catch(() => {/* silent — empty list is fine */})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1>{format(new Date(), 'EEEE, MMM d')}</h1>
            <p className="text-sm text-muted-foreground">
              {firstName ? `Welcome back, Dr. ${firstName}` : "Today's consults"}
            </p>
          </div>
          <Button className="min-h-[44px] gap-2" onClick={() => navigate('/doctor/consult/new')}>
            <Plus className="h-4 w-4" />
            New consult
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : consults.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">No consults yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Tap "New consult" to record your first one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {consults.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/doctor/consult/${c.id}`)}
                className="w-full text-left bg-card border border-border rounded-lg px-4 py-3 hover:bg-secondary/50 transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    Patient <span className="font-mono">{c.patient_id.slice(0, 8)}…</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.created_at ? format(parseISO(c.created_at), 'MMM d, h:mm a') : '—'}
                  </p>
                </div>
                <StatusBadge status={c.status as ConsultStatus} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
