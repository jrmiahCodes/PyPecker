'use client';

import { formatDurationMs } from '@/lib/cycleTracker';

interface SessionTimerProps {
  elapsedMs: number;
  targetMs: number | null;
}

export function SessionTimer({ elapsedMs, targetMs }: SessionTimerProps) {
  const overTarget = targetMs !== null && elapsedMs > targetMs;
  return (
    <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
      <span className="flex items-center gap-2">
        <span className="uppercase tracking-widest text-fg-subtle">Elapsed</span>
        <span className={overTarget ? 'text-err' : 'text-fg'}>
          {formatDurationMs(elapsedMs)}
        </span>
      </span>
      {targetMs !== null && (
        <span className="flex items-center gap-2">
          <span className="uppercase tracking-widest text-fg-subtle">Target</span>
          <span className="text-accent">{formatDurationMs(targetMs)}</span>
        </span>
      )}
    </div>
  );
}
