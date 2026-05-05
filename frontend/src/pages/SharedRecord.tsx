import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/shared/OtpInput';
import { FactCard } from '@/components/consult/FactCard';
import { TierBadge } from '@/components/shared/TierBadge';
import { AuditBadge } from '@/components/patient/AuditBadge';
import { mockFinalizedConsult, mockPatient, mockPatientFlags } from '@/lib/mockData';
import { CATEGORY_LABELS } from '@/types';
import { formatDistanceToNow } from 'date-fns';

type SharedStep = 'phone' | 'otp' | 'record';

export default function SharedRecord() {
  const { token } = useParams();
  const [step, setStep] = useState<SharedStep>('phone');
  const [phone, setPhone] = useState('+91 ');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const consult = mockFinalizedConsult;
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

  const handleSendOtp = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setStep('otp');
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
    }, 1000);
  };

  const handleVerify = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setStep('record');
  };

  if (step !== 'record') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">AIMED</h1>
            <p className="text-sm text-muted-foreground">
              This record was shared by {mockPatient.fullName}.
            </p>
          </div>

          {step === 'phone' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Enter your phone number to verify</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm" />
              </div>
              <Button className="w-full min-h-[44px]" disabled={loading} onClick={handleSendOtp}>
                {loading ? 'Sending...' : 'Send OTP'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">Enter OTP sent to {phone}</p>
              <OtpInput onComplete={handleVerify} disabled={loading} />
              {countdown > 0 && <p className="text-xs text-muted-foreground text-center">Resend in 0:{countdown.toString().padStart(2, '0')}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Record view
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 flex items-center justify-between px-4 bg-card border-b border-border">
        <span className="text-lg font-semibold tracking-tight text-primary">AIMED</span>
        <span className="text-xs text-muted-foreground">Read-only</span>
      </header>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="bg-secondary/50 rounded-lg p-3 text-sm text-muted-foreground">
          Shared by {mockPatient.fullName} · Expires {formatDistanceToNow(expiresAt, { addSuffix: true })} · Read-only
        </div>

        <AuditBadge facts={consult.facts} />

        <div className="space-y-3">
          {consult.facts.map(fact => {
            const flag = mockPatientFlags.find(f => f.factId === fact.id);
            return (
              <div key={fact.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                    {CATEGORY_LABELS[fact.category]}
                  </span>
                  <TierBadge tier={fact.riskTier} />
                </div>
                <p className="text-[15px] text-foreground mb-1">{fact.text}</p>
                {flag && (
                  <div className="mt-2 p-2 rounded bg-tier2-bg border border-tier2-border text-xs text-tier2-text">
                    <span className="font-medium">Patient-disputed:</span> {flag.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border">
          <Button className="w-full min-h-[44px]">
            Start new consult with this patient →
          </Button>
        </div>
      </div>
    </div>
  );
}
