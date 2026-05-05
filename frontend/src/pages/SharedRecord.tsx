import { useParams } from 'react-router-dom';

export default function SharedRecord() {
  const { token } = useParams();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-3">
        <h1 className="text-lg font-semibold">Shared record</h1>
        <p className="text-sm text-muted-foreground">
          Share resolution is not yet wired to the backend. Once <code>/shared/:token</code> is implemented,
          the record will be displayed here after a phone-OTP gate.
        </p>
        <p className="text-xs text-muted-foreground break-all">Token: {token}</p>
      </div>
    </div>
  );
}
