import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Link, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { mockShareLink } from '@/lib/mockData';
import { format, formatDistanceToNow } from 'date-fns';

export default function PatientShares() {
  const [shares, setShares] = useState([mockShareLink]);
  const [showCreate, setShowCreate] = useState(false);
  const [duration, setDuration] = useState<'1h' | '24h' | '7d'>('24h');
  const [restrictPhone, setRestrictPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null);

  const handleCreate = () => {
    const link = `${window.location.origin}/shared/mock-token-${Date.now()}`;
    setGeneratedLink(link);
    toast.success('Share link created');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleRevoke = (id: string) => {
    setShares(prev => prev.filter(s => s.id !== id));
    setConfirmingRevoke(null);
    toast.success('Link revoked');
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        <div className="flex items-center justify-between">
          <h1>My shared links</h1>
          <Button className="min-h-[44px] gap-2" onClick={() => { setShowCreate(true); setGeneratedLink(null); }}>
            <Link className="h-4 w-4" />
            Share my record
          </Button>
        </div>

        {/* Share list */}
        <div className="space-y-3">
          {shares.map(s => {
            const isExpired = new Date(s.expiresAt) < new Date();
            return (
              <div key={s.id} className={`p-4 rounded-lg border bg-card ${isExpired ? 'border-border opacity-60' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{isExpired ? 'Expired' : `Expires ${formatDistanceToNow(new Date(s.expiresAt), { addSuffix: true })}`}</p>
                  {!isExpired && (
                    confirmingRevoke === s.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Are you sure?</span>
                        <button className="text-xs text-danger font-medium" onClick={() => handleRevoke(s.id)}>Yes, revoke</button>
                        <button className="text-xs text-muted-foreground" onClick={() => setConfirmingRevoke(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="text-xs text-danger font-medium min-h-[44px] px-2" onClick={() => setConfirmingRevoke(s.id)}>Revoke</button>
                    )
                  )}
                </div>
                {s.grantedToPhone && <p className="text-xs text-muted-foreground">Restricted to: {s.grantedToPhone}</p>}
                <div className="mt-2 space-y-1">
                  {s.accessLog.map((log, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      Opened {log.phone ? `by ${log.phone}` : ''} at {format(new Date(log.accessedAt), 'h:mm a')}
                    </p>
                  ))}
                  {s.accessLog.length === 0 && <p className="text-xs text-muted-foreground">No access yet</p>}
                </div>
              </div>
            );
          })}
          {shares.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No shared links yet.</p>}
        </div>

        {/* Create sheet */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-foreground/20" onClick={() => setShowCreate(false)} />
            <div className="relative w-full max-w-md bg-card rounded-t-xl md:rounded-xl border border-border p-6 space-y-4">
              <h3 className="text-base font-medium">Share my record</h3>

              <div>
                <label className="text-sm font-medium">Duration</label>
                <div className="flex gap-2 mt-1.5">
                  {(['1h', '24h', '7d'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 h-10 rounded-md border text-sm font-medium transition-colors ${
                        duration === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'
                      }`}
                    >
                      {d === '1h' ? '1 hour' : d === '24h' ? '24 hours' : '7 days'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium flex-1">Restrict to phone number</label>
                <button
                  onClick={() => setRestrictPhone(!restrictPhone)}
                  className={`h-6 w-11 rounded-full transition-colors ${restrictPhone ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`h-5 w-5 rounded-full bg-card shadow transition-transform ${restrictPhone ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {restrictPhone && (
                <input className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
              )}

              {generatedLink ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input className="flex-1 h-10 px-3 rounded-md border border-input bg-secondary text-sm" readOnly value={generatedLink} />
                    <Button variant="outline" className="h-10 w-10 p-0" onClick={() => handleCopy(generatedLink)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button className="w-full min-h-[44px]" onClick={() => setShowCreate(false)}>Done</Button>
                </div>
              ) : (
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" className="min-h-[44px]" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button className="min-h-[44px]" onClick={handleCreate}>Create link</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
