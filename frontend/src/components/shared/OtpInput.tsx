import { useCallback, useRef, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  disabled?: boolean;
}

export function OtpInput({ length = 6, onComplete, disabled = false }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback((idx: number) => {
    inputRefs.current[idx]?.focus();
  }, []);

  const handleChange = useCallback((idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...values];
    next[idx] = digit;
    setValues(next);

    if (digit && idx < length - 1) {
      focusInput(idx + 1);
    }

    if (next.every(v => v !== '')) {
      onComplete(next.join(''));
    }
  }, [values, length, onComplete, focusInput]);

  const handleKeyDown = useCallback((idx: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !values[idx] && idx > 0) {
      focusInput(idx - 1);
    }
  }, [values, focusInput]);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    const next = Array(length).fill('');
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setValues(next);
    if (pasted.length === length) {
      onComplete(next.join(''));
    } else {
      focusInput(Math.min(pasted.length, length - 1));
    }
  }, [length, onComplete, focusInput]);

  return (
    <div className="flex gap-2 justify-center">
      {values.map((val, idx) => (
        <input
          key={idx}
          ref={el => { inputRefs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          disabled={disabled}
          className={cn(
            'h-12 w-10 rounded-md border border-input bg-card text-center text-lg font-medium',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            'disabled:opacity-50'
          )}
          onChange={e => handleChange(idx, e.target.value)}
          onKeyDown={e => handleKeyDown(idx, e)}
          onPaste={idx === 0 ? handlePaste : undefined}
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
        />
      ))}
    </div>
  );
}
