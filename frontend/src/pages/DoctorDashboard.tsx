import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { mockConsults, mockDoctor, mockPatient, mockPatients } from '@/lib/mockData';
import { format } from 'date-fns';

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [loading] = useState(false);
  const consults = mockConsults;
  const flaggedCount = mockPatients.reduce((sum, p) => sum + p.openFlagCount, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        {/* Notification banner */}
        {flaggedCount > 0 && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-tier2-bg border border-tier2-border">
            <AlertTriangle className="h-4 w-4 text-tier2-text mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-tier2-text">
                Asha flagged {flaggedCount} item from the May 3 visit.{' '}
                <button className="font-medium underline" onClick={() => navigate('/doctor/patients/pat-001')}>
                  Review before next consult →
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1>{format(new Date(), 'EEEE, MMM d')}</h1>
            <p className="text-sm text-muted-foreground">Today's consults</p>
          </div>
          <Button className="min-h-[44px] gap-2" onClick={() => navigate('/doctor/consult/new')}>
            <Plus className="h-4 w-4" />
            New consult
          </Button>
        </div>

        {/* Consult list */}
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : consults.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No consults today. Tap "New consult" to begin.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {consults.map(c => {
              const patient = mockPatients.find(p => p.userId === c.patientId) || mockPatient;
              const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : null;

              return (
                <button
                  key={c.id}
                  className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors min-h-[44px]"
                  onClick={() => navigate(c.status === 'in_review' ? `/doctor/consult/${c.id}` : `/doctor/consult/${c.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {patient.fullName}{age ? `, ${age}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(c.startedAt), 'h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-primary font-medium">
                        {c.status === 'finalized' ? 'View' : 'Continue'} →
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
