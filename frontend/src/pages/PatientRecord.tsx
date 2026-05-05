import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { ConsultTimeline } from '@/components/patient/ConsultTimeline';
import { FactPanel } from '@/components/consult/FactPanel';
import { mockPatient, mockConsults, mockPatientFlags } from '@/lib/mockData';
import { CATEGORY_LABELS } from '@/types';

export default function PatientRecord() {
  const { patientId } = useParams();
  const patient = mockPatient; // In real app, fetch by patientId
  const consults = mockConsults;
  const [selectedConsultId, setSelectedConsultId] = useState<string | null>(null);
  const selectedConsult = consults.find(c => c.id === selectedConsultId);
  const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        {/* Patient header */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg">{patient.fullName}</h1>
              <p className="text-sm text-muted-foreground">
                {age ? `${age} years` : ''}{patient.sex ? ` · ${patient.sex}` : ''}{patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}{patient.dob ? ` · DOB: ${patient.dob}` : ''}
              </p>
            </div>
            {patient.openFlagCount > 0 && (
              <div className="flex items-center gap-1 text-warning text-xs font-medium">
                <Flag className="h-3.5 w-3.5" />
                {patient.openFlagCount} flagged items
              </div>
            )}
          </div>
        </div>

        {/* Consult timeline */}
        <div>
          <h2 className="text-base font-medium mb-3">Consult history</h2>
          <ConsultTimeline consults={consults} onSelect={setSelectedConsultId} selectedId={selectedConsultId || undefined} />
        </div>

        {/* Expanded consult */}
        {selectedConsult && selectedConsult.status === 'finalized' && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-secondary/50 px-4 py-2 text-sm font-medium">Facts summary</div>
            <FactPanel
              facts={selectedConsult.facts}
              onApprove={() => {}}
              onReject={() => {}}
              onEdit={() => {}}
              onAudioPlay={() => {}}
              onFocusFact={() => {}}
              onBulkApproveTier1={() => {}}
              readOnly
            />
          </div>
        )}

        {/* Patient flags inline */}
        {mockPatientFlags.length > 0 && (
          <div>
            <h2 className="text-base font-medium mb-3">Patient flags</h2>
            <div className="space-y-2">
              {mockPatientFlags.map(flag => {
                const fact = mockConsults.flatMap(c => c.facts).find(f => f.id === flag.factId);
                return (
                  <div key={flag.id} className="p-3 rounded-lg border border-tier2-border bg-tier2-bg">
                    <p className="text-sm font-medium text-tier2-text">
                      {fact ? CATEGORY_LABELS[fact.category] : 'Unknown'}: {fact?.text}
                    </p>
                    <p className="text-xs text-tier2-text mt-1">Patient note: "{flag.note}"</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
