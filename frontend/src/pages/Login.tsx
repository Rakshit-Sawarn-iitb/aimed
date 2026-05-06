import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/shared/OtpInput';
import { api, auth, ApiError } from '@/lib/api';

type Step = 'phone' | 'otp';

interface VerifyResponse {
  access_token: string;
  refresh_token: string;
  is_new: boolean;
  role: 'doctor' | 'patient' | null;
  user: { id: string; phone?: string };
}

export default function Login() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+91 ');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  const e164 = (raw: string) => raw.replace(/\s+/g, '');

  const handleSendOtp = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/otp/start', { phone: e164(phone) });
      setStep('otp');
      setCountdown(30);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const handleVerify = useCallback(async (otp: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<VerifyResponse>('/auth/otp/verify', {
        phone: e164(phone),
        token: otp,
      });
      auth.setSession(res.access_token, res.refresh_token, res.role);
      if (res.is_new || res.role === null) {
        navigate('/onboarding');
      } else if (res.role === 'doctor') {
        navigate('/doctor');
      } else {
        navigate('/patient');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }, [phone, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2 mb-2">
              <img src="/aimed-logo.jpeg" alt="AIMED Logo" className="w-8 h-8 rounded-md object-cover" />
              <h1 className="text-2xl font-semibold tracking-tight text-primary">AIMED</h1>
            </div>
            <p className="text-sm text-muted-foreground">Medical record verification</p>
          </div>

          {step === 'phone' ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="mt-1.5 w-full h-11 px-3 rounded-md border border-input bg-background text-sm"
                  placeholder="+91 98765 43210"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                className="w-full min-h-[44px]"
                disabled={phone.replace(/\D/g, '').length < 10 || loading}
                onClick={handleSendOtp}
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Enter 6-digit OTP</label>
                <p className="text-xs text-muted-foreground mt-0.5">Sent to {phone}</p>
              </div>
              <OtpInput onComplete={handleVerify} disabled={loading} />
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-xs text-muted-foreground">Resend in 0:{countdown.toString().padStart(2, '0')}</p>
                ) : (
                  <button className="text-xs text-primary font-medium hover:underline min-h-[44px]" onClick={handleSendOtp}>
                    Resend OTP
                  </button>
                )}
              </div>
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setStep('phone'); setError(null); }}
              >
                Change phone number
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 max-w-xs mx-auto">
          By continuing you agree to our terms. Your data is yours — see our privacy policy.
        </p>
        
        <div className="mt-8 bg-primary/5 border border-primary/10 rounded-md p-3 text-xs text-center text-muted-foreground max-w-xs mx-auto">
          <strong>Testing Credentials:</strong><br />
          Doctor: <code>99999 99999</code> (OTP: <code>676767</code>)<br />
          Patient: <code>11111 11111</code> (OTP: <code>676767</code>)
        </div>
      </div>
    </div>
  );
}
