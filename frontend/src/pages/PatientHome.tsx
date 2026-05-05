import { useState } from 'react';
import { Flag } from 'lucide-react';
import { ConsultTimeline } from '@/components/patient/ConsultTimeline';
import { AuditBadge } from '@/components/patient/AuditBadge';
import { FlagSheet } from '@/components/patient/FlagSheet';
import { FactCard } from '@/components/consult/FactCard';
import { TierBadge } from '@/components/shared/TierBadge';
import { mockPatient, mockFinalizedConsult, mockConsults, mockPatientFlags } from '@/lib/mockData';
import { CATEGORY_LABELS, type FlagType } from '@/types';
import { format } from 'date-fns';

export default function PatientHome() {
  const patient = mockPatient;
  const consults = mockConsults.filter(c => c.status === 'finalized');
  const [selectedConsultId, setSelectedConsultId] = useState<string | null>(null);
  const [flaggingFactId, setFlaggingFactId] = useState<string | null>(null);
  const selectedConsult = consults.find(c => c.id === selectedConsultId);
  const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : null;

  const handleFlag = (flagType: FlagType, note?: string) => {
    // In real app: POST /facts/:id/flag
    setFlaggingFactId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        <div>
          <h1>Welcome, {patient.fullName.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground">
            {age ? `${age} years` : ''}{patient.sex ? ` · ${patient.sex}` : ''}{patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
          </p>
        </div>

        <div>
          <h2 className="text-base font-medium mb-3">Your consults</h2>
          {consults.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No consults yet.</p>
          ) : (
            <div className="space-y-3">
              {consults.map(c => (
                <div key={c.id}>
                  <button
                    className={`w-full text-left p-4 rounded-lg border bg-card hover:bg-secondary/50 transition-colors min-h-[44px] ${selectedConsultId === c.id ? 'ring-1 ring-primary border-primary' : 'border-border'}`}
                    onClick={() => setSelectedConsultId(selectedConsultId === c.id ? null : c.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{format(new Date(c.startedAt), 'MMM d, yyyy')}</p>
                        <p className="text-xs text-muted-foreground">Dr. Priya Verma · Verma Family Clinic</p>
                      </div>
                      <span className="text-xs text-primary font-medium">{selectedConsultId === c.id ? 'Close' : 'View'}</span>
                    </div>
                    <AuditBadge facts={c.facts} />
                  </button>

                  {/* Expanded fact view */}
                  {selectedConsultId === c.id && (
                    <div className="mt-2 space-y-3 pl-2">
                      {c.facts.map(fact => {
                        const flag = mockPatientFlags.find(f => f.factId === fact.id);
                        return (
                          <div key={fact.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                                {CATEGORY_LABELS[fact.category]}
                              </span>
                              <div className="flex items-center gap-2">
                                <TierBadge tier={fact.riskTier} />
                                <button
                                  className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-warning"
                                  onClick={(e) => { e.stopPropagation(); setFlaggingFactId(fact.id); }}
                                  title="Flag this item"
                                >
                                  <Flag className={`h-4 w-4 ${flag ? 'fill-warning text-warning' : ''}`} />
                                </button>
                              </div>
                            </div>
                            <p className="text-[15px] text-foreground mb-1">{fact.text}</p>
                            {flag && (
                              <div className="mt-2 p-2 rounded bg-tier2-bg text-xs text-tier2-text">
                                You flagged: "{flag.note}"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <FlagSheet
        open={!!flaggingFactId}
        onClose={() => setFlaggingFactId(null)}
        onSubmit={handleFlag}
      />
    </div>
  );
}
