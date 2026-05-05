import { useMe, profileName } from '@/hooks/useMe';

interface PatientProfileFields {
  age?: number;
  blood_group?: string;
  phone?: string;
}

export default function PatientHome() {
  const { me, loading } = useMe();
  const name = profileName(me);
  const firstName = name ? name.split(' ')[0] : '';
  const profile = (me?.profile ?? {}) as PatientProfileFields;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        <div>
          <h1>{loading ? 'Loading…' : `Welcome${firstName ? `, ${firstName}` : ''}`}</h1>
          <p className="text-sm text-muted-foreground">
            {profile.age ? `${profile.age} years` : ''}
            {profile.blood_group ? ` · ${profile.blood_group}` : ''}
            {profile.phone ? ` · ${profile.phone}` : ''}
          </p>
        </div>

        <div>
          <h2 className="text-base font-medium mb-3">Your consults</h2>
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">No consults yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Once your doctor finalizes a consult, it will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
