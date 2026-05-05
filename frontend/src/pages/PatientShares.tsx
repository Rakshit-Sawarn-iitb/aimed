import { Button } from '@/components/ui/button';
import { Link } from 'lucide-react';
import { toast } from 'sonner';

export default function PatientShares() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
        <div className="flex items-center justify-between">
          <h1>My shared links</h1>
          <Button
            className="min-h-[44px] gap-2"
            onClick={() => toast.message('Sharing is not yet wired to the backend.')}
          >
            <Link className="h-4 w-4" />
            Share my record
          </Button>
        </div>

        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground">No shared links yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            The <code>/shares</code> API isn't built yet — once it is, you'll be able to share records here.
          </p>
        </div>
      </div>
    </div>
  );
}
