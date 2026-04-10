'use client';

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = Math.max(1, total);
  const clamped = Math.max(0, Math.min(current, safeTotal));
  const pct = Math.round((clamped / safeTotal) * 100);
  return (
    <div className="flex items-center gap-3 min-w-[8rem]">
      <span className="font-mono text-xs tabular-nums text-fg-subtle">
        {clamped}/{safeTotal}
      </span>
      <div className="h-1 flex-1 bg-line overflow-hidden rounded">
        <div
          className="h-full bg-accent transition-all duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
