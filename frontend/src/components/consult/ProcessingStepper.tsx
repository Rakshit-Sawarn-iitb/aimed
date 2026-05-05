import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessingStepperProps {
  currentStep: number; // 0, 1, 2
}

const steps = [
  { label: 'Uploading audio', desc: 'Sending your recording securely.' },
  { label: 'Transcribing in Hindi-English (Sarvam)', desc: 'This usually takes 60 seconds for a 10-minute consult.' },
  { label: 'Extracting medical facts (Claude)', desc: 'Identifying facts from the conversation.' },
];

export function ProcessingStepper({ currentStep }: ProcessingStepperProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8 max-w-md mx-auto">
      <h2 className="text-lg font-medium text-foreground">Processing your consult</h2>

      <div className="w-full space-y-4">
        {steps.map((step, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;

          return (
            <div key={idx} className={cn('flex items-start gap-3 p-3 rounded-lg', isCurrent && 'bg-secondary')}>
              <div className="mt-0.5">
                {isDone ? (
                  <div className="h-5 w-5 rounded-full bg-success flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-border" />
                )}
              </div>
              <div>
                <p className={cn('text-sm font-medium', isCurrent ? 'text-foreground' : isDone ? 'text-success' : 'text-muted-foreground')}>
                  {step.label}
                </p>
                {isCurrent && <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
