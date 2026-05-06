import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Phone, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '@/lib/api';

interface PatientListItem {
  id: string;
  name: string;
  phone?: string;
  last_seen?: string;
  consult_count: number;
}

export default function PatientList() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<PatientListItem[]>('/patients')
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.replace(/^\+91/, '').includes(q))
    );
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 pb-20 md:pb-6">

        <div className="flex items-center justify-between">
          <div>
            <h1>All patients</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${patients.length} patient${patients.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full h-11 pl-10 pr-4 rounded-md border border-input bg-card text-sm"
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              {search ? 'No patients match your search.' : 'No patients yet.'}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground mt-1">
                Patients appear here after their first consult.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/doctor/patients/${p.id}`, {
                  state: { patientName: p.name },
                })}
                className="w-full text-left bg-card border border-border rounded-lg px-4 py-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {p.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {p.phone.replace(/^\+91/, '')}
                        </span>
                      )}
                      {p.last_seen && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last seen {format(parseISO(p.last_seen), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium bg-muted text-muted-foreground rounded-full px-2.5 py-1">
                    {p.consult_count} consult{p.consult_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
