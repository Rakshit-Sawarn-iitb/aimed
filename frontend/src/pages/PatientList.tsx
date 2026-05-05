import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PatientList() {
  const [search, setSearch] = useState('');

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 pb-20 md:pb-6">
        <div className="flex items-center justify-between">
          <h1>All patients</h1>
          <Button
            className="min-h-[44px] gap-2"
            onClick={() => toast.message('Patient management is not yet wired to the backend.')}
          >
            <Plus className="h-4 w-4" />
            Add patient
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full h-11 pl-10 pr-4 rounded-md border border-input bg-card text-sm"
            placeholder="Search patients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">No patients yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            The patient roster API isn't built yet — once it is, your patients will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
