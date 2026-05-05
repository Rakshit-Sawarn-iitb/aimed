import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { mockPatients } from '@/lib/mockData';
import { format } from 'date-fns';

export default function PatientList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const patients = mockPatients.filter(p =>
    p.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddPatient = () => {
    setShowAddSheet(false);
    setNewName('');
    setNewPhone('');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 pb-20 md:pb-6">
        <div className="flex items-center justify-between">
          <h1>All patients</h1>
          <Button className="min-h-[44px] gap-2" onClick={() => setShowAddSheet(true)}>
            <Plus className="h-4 w-4" />
            Add patient
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full h-11 pl-10 pr-4 rounded-md border border-input bg-card text-sm"
            placeholder="Search patients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Patient list */}
        <div className="space-y-2">
          {patients.map(p => {
            const age = p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : null;
            return (
              <button
                key={p.userId}
                className="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors min-h-[44px]"
                onClick={() => navigate(`/doctor/patients/${p.userId}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.fullName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {age ? `${age} years` : ''}{p.sex ? ` · ${p.sex}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.openFlagCount > 0 && (
                      <span className="h-5 min-w-[20px] px-1 rounded-full bg-danger text-primary-foreground text-[11px] font-medium flex items-center justify-center">
                        {p.openFlagCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Add patient sheet */}
        {showAddSheet && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-foreground/20" onClick={() => setShowAddSheet(false)} />
            <div className="relative w-full max-w-md bg-card rounded-t-xl md:rounded-xl border border-border p-6 space-y-4">
              <h3 className="text-base font-medium">Add patient</h3>
              <div>
                <label className="text-sm font-medium">Name</label>
                <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Phone number</label>
                <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <p className="text-xs text-muted-foreground">An SMS invite will be sent to the patient.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddSheet(false)} className="min-h-[44px]">Cancel</Button>
                <Button disabled={!newName || !newPhone} onClick={handleAddPatient} className="min-h-[44px]">Add patient</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
