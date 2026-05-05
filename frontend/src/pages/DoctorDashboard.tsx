import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useMe, profileName } from '@/hooks/useMe';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { me } = useMe();
  const name = profileName(me);
  const firstName = name ? name.split(' ').slice(-1)[0] : '';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1>{format(new Date(), 'EEEE, MMM d')}</h1>
            <p className="text-sm text-muted-foreground">
              {firstName ? `Welcome back, Dr. ${firstName}` : 'Today\'s consults'}
            </p>
          </div>
          <Button className="min-h-[44px] gap-2" onClick={() => navigate('/doctor/consult/new')}>
            <Plus className="h-4 w-4" />
            New consult
          </Button>
        </div>

        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">No consults yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Tap "New consult" to record your first one.</p>
        </div>
      </div>
    </div>
  );
}
