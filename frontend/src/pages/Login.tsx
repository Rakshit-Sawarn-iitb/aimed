import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/shared/OtpInput';

type Step = 'phone' | 'otp';

export default function Login() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+91 ');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  const handleSendOtp = useCallback(async () => {
    setLoading(true);
    // Mock: simulate OTP send
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setStep('otp');
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleVerify = useCallback(async (otp: string) => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    // Mock: navigate to onboarding or dashboard
    navigate('/onboarding');
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card border border-border rounded-xl p-8 space-y-6">
          {/* Logo */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-primary">AIMED</h1>
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
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-xs text-muted-foreground">Resend in 0:{countdown.toString().padStart(2, '0')}</p>
                ) : (
                  <button className="text-xs text-primary font-medium hover:underline min-h-[44px]" onClick={handleSendOtp}>
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 max-w-xs mx-auto">
          By continuing you agree to our terms. Your data is yours — see our privacy policy.
        </p>
      </div>
    </div>
  );
}
