import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, auth, ApiError } from '@/lib/api';
import type { UserRole } from '@/types';

export default function Onboarding() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [city, setCity] = useState('');
  const [age, setAge] = useState<string>('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (role === 'doctor') {
        await api.post('/auth/doctor/complete-profile', {
          name,
          clinic_name: clinicName,
          city,
        });
        auth.setRole('doctor');
        navigate('/doctor');
      } else if (role === 'patient') {
        await api.post('/auth/patient/complete-profile', {
          name,
          age: parseInt(age, 10),
          blood_group: bloodGroup,
        });
        auth.setRole('patient');
        navigate('/patient');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save profile');
    } finally {
      setSubmitting(false);
    }
  };

  const doctorReady = !!name && !!clinicName && !!city;
  const patientReady = !!name && !!age && !!bloodGroup;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-primary">AIMED</h1>
          <p className="text-sm text-muted-foreground">Let's set up your profile</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setRole('doctor')}
            className={`p-6 rounded-xl border bg-card text-left transition-all min-h-[44px] ${
              role === 'doctor' ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-primary/30'
            }`}
          >
            <Stethoscope className="h-8 w-8 text-primary mb-3" />
            <h3 className="text-base font-medium text-foreground">I am a Doctor</h3>
            <p className="text-sm text-muted-foreground mt-1">Record, transcribe, and verify consult notes with AI assistance.</p>
          </button>

          <button
            onClick={() => setRole('patient')}
            className={`p-6 rounded-xl border bg-card text-left transition-all min-h-[44px] ${
              role === 'patient' ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-primary/30'
            }`}
          >
            <User className="h-8 w-8 text-primary mb-3" />
            <h3 className="text-base font-medium text-foreground">I am a Patient</h3>
            <p className="text-sm text-muted-foreground mt-1">View your verified medical records and share them securely.</p>
          </button>
        </div>

        {role === 'doctor' && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Full name</label>
              <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Priya Verma" />
            </div>
            <div>
              <label className="text-sm font-medium">Clinic name</label>
              <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="Verma Clinic" />
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={city} onChange={e => setCity(e.target.value)} placeholder="Mumbai" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full min-h-[44px]" disabled={!doctorReady || submitting} onClick={handleSubmit}>
              {submitting ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        )}

        {role === 'patient' && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Full name</label>
              <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Asha Sharma" />
            </div>
            <div>
              <label className="text-sm font-medium">Age</label>
              <input
                type="number"
                min={0}
                max={150}
                className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
                value={age}
                onChange={e => setAge(e.target.value)}
                placeholder="34"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Blood group</label>
              <select className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
                <option value="">Select</option>
                {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button className="w-full min-h-[44px]" disabled={!patientReady || submitting} onClick={handleSubmit}>
              {submitting ? 'Saving...' : 'Continue'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
