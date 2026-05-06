import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Phone, User, Droplets, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import type { ConsultStatus } from '@/types';

interface PatientProfile {
  id: string;
  name: string;
  phone?: string;
  age?: number;
  blood_group?: string;
}

interface ConsultReport {
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
  plain_language_summary?: string;
  followup_questions: string[];
  drug_interactions: unknown[];
}

interface ConsultSummary {
  id: string;
  status: string;
  created_at: string;
  finalized_at?: string;
  report?: ConsultReport;
}

interface PatientRecordData {
  patient: PatientProfile;
  consults: ConsultSummary[];
}

const SOAP_LABELS: { key: keyof ConsultReport; label: string }[] = [
  { key: 'soap_subjective', label: 'Subjective' },
  { key: 'soap_objective',  label: 'Objective' },
  { key: 'soap_assessment', label: 'Assessment' },
  { key: 'soap_plan',       label: 'Plan' },
];

export default function PatientRecord() {
  const { patientId } = useParams<{ patientId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const statePatientName = (location.state as { patientName?: string } | null)?.patientName;

  const [data, setData] = useState<PatientRecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    api.get<PatientRecordData>(`/patients/${patientId}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  const patient = data?.patient;
  const consults = data?.consults ?? [];
  const finalizedCount = consults.filter(c => c.status === 'finalized').length;

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-4 pb-20 md:pb-6">

        {/* Back */}
        <button
          onClick={() => navigate('/doctor/patients')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All patients
        </button>

        {/* Patient header */}
        {loading ? (
          <div className="h-28 rounded-xl bg-muted animate-pulse" />
        ) : patient ? (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">{patient.name}</h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  {patient.phone && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {patient.phone.replace(/^\+91/, '')}
                    </span>
                  )}
                  {patient.age && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      {patient.age} yrs
                    </span>
                  )}
                  {patient.blood_group && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Droplets className="h-3.5 w-3.5" />
                      {patient.blood_group}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="shrink-0 text-right space-y-0.5">
                <p className="text-2xl font-bold text-foreground">{consults.length}</p>
                <p className="text-xs text-muted-foreground">
                  {consults.length === 1 ? 'consult' : 'consults'}
                </p>
                {finalizedCount > 0 && (
                  <p className="text-xs text-success font-medium">{finalizedCount} finalized</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 border border-dashed border-border rounded-xl">
            <p className="text-sm text-muted-foreground">Patient not found.</p>
          </div>
        )}

        {/* Consult timeline */}
        {!loading && consults.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">No consults with this patient yet.</p>
          </div>
        )}

        {consults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Consult history
            </p>

            {consults.map(c => {
              const hasReport = !!c.report;
              const isExpanded = expandedId === c.id;
              const isActionable = c.status === 'in_review';

              return (
                <div key={c.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  {/* Row */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                    onClick={() => {
                      if (hasReport) {
                        toggleExpand(c.id);
                      } else {
                        navigate(`/doctor/consult/${c.id}`, {
                          state: { patientName: patient?.name ?? statePatientName },
                        });
                      }
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {format(parseISO(c.created_at), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(c.created_at), 'h:mm a')}
                        {c.finalized_at && (
                          <span className="ml-2">
                            · finalized {format(parseISO(c.finalized_at), 'h:mm a')}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={c.status as ConsultStatus} />
                      {hasReport ? (
                        <ChevronDown className={cn(
                          'h-4 w-4 text-muted-foreground transition-transform',
                          isExpanded && 'rotate-180'
                        )} />
                      ) : isActionable ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : null}
                    </div>
                  </button>

                  {/* Expanded SOAP note */}
                  {isExpanded && c.report && (
                    <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
                      {SOAP_LABELS.filter(s => c.report![s.key]).map(s => (
                        <div key={s.key}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            {s.label}
                          </p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {c.report![s.key] as string}
                          </p>
                        </div>
                      ))}

                      {c.report.followup_questions.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                            Follow-up
                          </p>
                          <ul className="space-y-1">
                            {c.report.followup_questions.map((q, i) => (
                              <li key={i} className="text-sm">• {q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {c.report.plain_language_summary && (
                        <div className="bg-tier1-bg border border-tier1-border rounded-lg p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-tier1-text mb-1">
                            Patient summary
                          </p>
                          <p className="text-sm leading-relaxed text-tier1-text">
                            {c.report.plain_language_summary}
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => navigate(`/doctor/consult/${c.id}`, {
                          state: { patientName: patient?.name ?? statePatientName },
                        })}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View full consult →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
