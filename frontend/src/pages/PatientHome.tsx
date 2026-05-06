import { useState, useEffect } from 'react';
import { useMe, profileName } from '@/hooks/useMe';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { FileText, Calendar, User } from 'lucide-react';

interface PatientProfileFields {
  age?: number;
  blood_group?: string;
  phone?: string;
}

interface ConsultListResponse {
  id: string;
  status: string;
  created_at: string;
  finalized_at: string | null;
  doctor_name: string;
  report?: {
    plain_language_summary?: string;
    followup_questions?: string[];
  };
}

export default function PatientHome() {
  const { me, loading } = useMe();
  const [consults, setConsults] = useState<ConsultListResponse[]>([]);
  const [consultsLoading, setConsultsLoading] = useState(true);

  const name = profileName(me);
  const firstName = name ? name.split(' ')[0] : '';
  const profile = (me?.profile ?? {}) as PatientProfileFields;

  useEffect(() => {
    async function loadConsults() {
      try {
        const res = await api.get<ConsultListResponse[]>('/patients/me/consults');
        setConsults(res);
      } catch (err) {
        console.error("Failed to load consults", err);
      } finally {
        setConsultsLoading(false);
      }
    }
    loadConsults();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{loading ? 'Loading…' : `Welcome${firstName ? `, ${firstName}` : ''}`}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {profile.age ? `${profile.age} years` : ''}
            {profile.blood_group ? ` · ${profile.blood_group}` : ''}
            {profile.phone ? ` · ${profile.phone}` : ''}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium mb-4">Your Consultations</h2>
          
          {consultsLoading ? (
            <div className="text-center py-12 border border-border rounded-lg bg-card/50">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading records...</p>
            </div>
          ) : consults.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground">No consults yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Once your doctor finalizes a consult, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {consults.map(c => (
                <div key={c.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow transition-shadow">
                  <div className="flex items-start justify-between border-b border-border pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 text-primary font-medium mb-1">
                        <User className="h-4 w-4" />
                        {c.doctor_name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(c.created_at), 'MMM d, yyyy · h:mm a')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {c.report?.plain_language_summary ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          <FileText className="h-3.5 w-3.5" />
                          Visit Summary
                        </div>
                        <p className="text-sm leading-relaxed text-foreground">
                          {c.report.plain_language_summary}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">No summary available.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
