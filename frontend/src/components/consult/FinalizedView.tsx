import { CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export interface ReportData {
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
  drug_interactions: unknown[];
  followup_questions: string[];
  plain_language_summary?: string;
}

interface FinalizedViewProps {
  report: ReportData;
  patientName?: string | null;
  finalizedAt?: string | null;
}

const SOAP_SECTIONS: { key: keyof ReportData; label: string }[] = [
  { key: 'soap_subjective', label: 'Subjective' },
  { key: 'soap_objective',  label: 'Objective' },
  { key: 'soap_assessment', label: 'Assessment' },
  { key: 'soap_plan',       label: 'Plan' },
];

function drugLabel(d: unknown): string {
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && d !== null) {
    const obj = d as Record<string, unknown>;
    return (obj['note'] as string) || (obj['interaction'] as string) || JSON.stringify(d);
  }
  return String(d);
}

export function FinalizedView({ report, patientName, finalizedAt }: FinalizedViewProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4 pb-20 md:pb-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{patientName ?? 'Consult summary'}</h1>
            {finalizedAt && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Finalized {format(parseISO(finalizedAt), 'MMM d, yyyy · h:mm a')}
              </p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            Finalized
          </span>
        </div>

        {/* SOAP note */}
        {SOAP_SECTIONS.filter(s => report[s.key]).map(s => (
          <div key={s.key} className="bg-card border border-border rounded-lg p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {report[s.key] as string}
            </p>
          </div>
        ))}

        {/* Drug interactions */}
        {report.drug_interactions.length > 0 && (
          <div className="bg-tier3-bg border border-tier3-border rounded-lg p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tier3-text">
              Drug interactions
            </p>
            <ul className="space-y-1.5">
              {report.drug_interactions.map((d, i) => (
                <li key={i} className="text-sm text-tier3-text">• {drugLabel(d)}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Follow-up questions */}
        {report.followup_questions.length > 0 && (
          <div className="bg-tier2-bg border border-tier2-border rounded-lg p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tier2-text">
              Follow-up questions
            </p>
            <ul className="space-y-1.5">
              {report.followup_questions.map((q, i) => (
                <li key={i} className="text-sm text-tier2-text">• {q}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Patient-friendly summary */}
        {report.plain_language_summary && (
          <div className="bg-tier1-bg border border-tier1-border rounded-lg p-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-tier1-text">
              Patient-friendly summary
            </p>
            <p className="text-sm leading-relaxed text-tier1-text">
              {report.plain_language_summary}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
