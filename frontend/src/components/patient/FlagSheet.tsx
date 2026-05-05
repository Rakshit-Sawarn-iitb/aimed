import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Flag } from 'lucide-react';
import type { FlagType } from '@/types';

interface FlagSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (flagType: FlagType, note?: string) => void;
}

const flagOptions: { value: FlagType; label: string }[] = [
  { value: 'didnt_say', label: "I didn't say this" },
  { value: 'missing', label: 'Something is missing' },
  { value: 'wrong', label: 'This seems wrong' },
  { value: 'unclear', label: "I'm not sure" },
];

export function FlagSheet({ open, onClose, onSubmit }: FlagSheetProps) {
  const [selectedType, setSelectedType] = useState<FlagType | null>(null);
  const [note, setNote] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!selectedType) return;
    onSubmit(selectedType, note || undefined);
    setSelectedType(null);
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-foreground/20" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card rounded-t-xl border border-border p-6 space-y-4 animate-in slide-in-from-bottom">
        <div className="flex items-center gap-2 mb-2">
          <Flag className="h-4 w-4 text-warning" />
          <h3 className="text-base font-medium">Flag this item</h3>
        </div>

        <div className="space-y-2">
          {flagOptions.map(opt => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer min-h-[44px] transition-colors ${
                selectedType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/50'
              }`}
            >
              <input
                type="radio"
                name="flag"
                checked={selectedType === opt.value}
                onChange={() => setSelectedType(opt.value)}
                className="sr-only"
              />
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                selectedType === opt.value ? 'border-primary' : 'border-border'
              }`}>
                {selectedType === opt.value && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>

        <textarea
          className="w-full h-20 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
          placeholder="Optional note..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="min-h-[44px]">Cancel</Button>
          <Button disabled={!selectedType} onClick={handleSubmit} className="min-h-[44px]">Submit flag</Button>
        </div>
      </div>
    </div>
  );
}
