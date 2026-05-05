import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/types';

export default function Onboarding() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (role === 'doctor') navigate('/doctor');
    else navigate('/patient');
  };

  const specialties = ['General Medicine', 'Pediatrics', 'Cardiology', 'Dermatology', 'Orthopedics', 'ENT', 'Gynecology', 'Other'];
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

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
              <label className="text-sm font-medium">Specialty</label>
              <select className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={specialty} onChange={e => setSpecialty(e.target.value)}>
                <option value="">Select specialty</option>
                {specialties.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Registration number</label>
              <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={regNumber} onChange={e => setRegNumber(e.target.value)} placeholder="Self-attested for now" />
            </div>
            <div>
              <label className="text-sm font-medium">Clinic name</label>
              <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={clinicName} onChange={e => setClinicName(e.target.value)} />
            </div>
            <Button className="w-full min-h-[44px]" disabled={!name || !specialty} onClick={handleSubmit}>Continue</Button>
          </div>
        )}

        {role === 'patient' && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Full name</label>
              <input className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Asha Sharma" />
            </div>
            <div>
              <label className="text-sm font-medium">Date of birth</label>
              <input type="date" className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Sex</label>
              <div className="flex gap-3 mt-1.5">
                {['M', 'F', 'Other', 'Prefer not to say'].map(s => (
                  <label key={s} className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer min-h-[44px] text-sm ${sex === s ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <input type="radio" name="sex" value={s} checked={sex === s} onChange={e => setSex(e.target.value)} className="sr-only" />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Blood group</label>
              <select className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
                <option value="">Select</option>
                {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            <Button className="w-full min-h-[44px]" disabled={!name} onClick={handleSubmit}>Continue</Button>
          </div>
        )}
      </div>
    </div>
  );
}
