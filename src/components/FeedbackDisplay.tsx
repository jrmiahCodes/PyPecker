'use client';

import type { ValidationResult } from '@/lib/types';

interface FeedbackDisplayProps {
  result: ValidationResult | null;
  revealed: boolean;
  solution: string;
}

export function FeedbackDisplay({ result, revealed, solution }: FeedbackDisplayProps) {
  if (revealed) {
    return (
      <div className="rounded-md border border-accent-muted bg-bg-elev p-4 space-y-2 transition-opacity duration-150">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          Solution
        </p>
        <pre className="font-mono text-sm text-fg whitespace-pre-wrap break-words">
          {solution}
        </pre>
      </div>
    );
  }

  if (!result) return null;

  if (result.error) {
    return (
      <div className="rounded-md border border-err/40 bg-err/5 p-4 space-y-2 transition-opacity duration-150">
        <p className="font-mono text-xs uppercase tracking-widest text-err">
          Runtime error
        </p>
        <pre className="font-mono text-xs text-err whitespace-pre-wrap overflow-x-auto">
          {result.error}
        </pre>
      </div>
    );
  }

  if (result.correct) {
    return (
      <div className="rounded-md border border-ok/40 bg-ok/5 p-4 transition-opacity duration-150">
        <p className="font-mono text-xs uppercase tracking-widest text-ok">
          Correct
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-err/40 bg-err/5 p-4 space-y-3 transition-opacity duration-150">
      <p className="font-mono text-xs uppercase tracking-widest text-err">
        Not quite
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="font-mono text-xs text-fg-subtle mb-1">Your output</p>
          <pre className="font-mono text-sm text-fg whitespace-pre-wrap break-all">
            {result.actualSerialized || '—'}
          </pre>
        </div>
        <div>
          <p className="font-mono text-xs text-fg-subtle mb-1">Expected</p>
          <pre className="font-mono text-sm text-fg whitespace-pre-wrap break-all">
            {result.expectedSerialized}
          </pre>
        </div>
      </div>
    </div>
  );
}
