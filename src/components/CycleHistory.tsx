'use client';

import { formatDurationMs, getTargetTime, isMastered } from '@/lib/cycleTracker';
import type { PuzzleSetMeta } from '@/lib/puzzleEngine';
import type { Puzzle, SetProgress } from '@/lib/types';

interface CycleHistoryProps {
  progress: SetProgress;
  meta: PuzzleSetMeta;
  puzzles?: Puzzle[];
}

const CHART_WIDTH = 600;
const CHART_HEIGHT = 140;
const CHART_PADDING = 24;

export function CycleHistory({ progress, meta, puzzles }: CycleHistoryProps) {
  const completed = progress.cycles.filter((c) => c.completed);
  const mastered = isMastered(progress, puzzles);

  if (completed.length === 0) {
    return (
      <div className="rounded-md border border-line bg-bg-elev p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-medium text-fg">{meta.title}</h3>
          <span className="font-mono text-xs text-fg-subtle">not started</span>
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          Finish your first cycle to see cycle-over-cycle timing here.
        </p>
      </div>
    );
  }

  const maxTime = Math.max(...completed.map((c) => c.totalTimeMs));
  const points = completed.map((c, i) => {
    const denom = Math.max(1, completed.length - 1);
    const x = CHART_PADDING + (i / denom) * (CHART_WIDTH - 2 * CHART_PADDING);
    const y =
      CHART_HEIGHT -
      CHART_PADDING -
      (c.totalTimeMs / maxTime) * (CHART_HEIGHT - 2 * CHART_PADDING);
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');

  const nextTarget = getTargetTime(progress, puzzles) ?? completed[completed.length - 1].totalTimeMs / 2;
  const targetY =
    CHART_HEIGHT -
    CHART_PADDING -
    (nextTarget / maxTime) * (CHART_HEIGHT - 2 * CHART_PADDING);

  return (
    <div className="rounded-md border border-line bg-bg-elev p-5 space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="font-medium text-fg">{meta.title}</h3>
          <p className="font-mono text-xs text-fg-subtle mt-0.5">
            {completed.length} cycle{completed.length !== 1 ? 's' : ''} · best{' '}
            {formatDurationMs(Math.min(...completed.map((c) => c.totalTimeMs)))}
          </p>
        </div>
        {mastered && (
          <span className="font-mono text-xs uppercase tracking-widest text-accent border border-accent-muted rounded px-2 py-0.5">
            mastered
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Cycle times for ${meta.title}`}
      >
        <line
          x1={CHART_PADDING}
          y1={targetY}
          x2={CHART_WIDTH - CHART_PADDING}
          y2={targetY}
          stroke="#f0b429"
          strokeDasharray="4 4"
          strokeOpacity={0.3}
        />
        <path d={path} stroke="#f0b429" strokeWidth={2} fill="none" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#f0b429" />
        ))}
      </svg>

      <div className="space-y-1">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 font-mono text-xs uppercase tracking-widest text-fg-subtle border-b border-line pb-1">
          <span>Cycle</span>
          <span>Started</span>
          <span className="text-right">Time</span>
          <span className="text-right">Acc</span>
        </div>
        {completed.map((c) => {
          const correct = c.puzzleResults.filter((r) => r.correct).length;
          const accuracy = correct / Math.max(1, c.puzzleResults.length);
          return (
            <div
              key={c.cycleNumber}
              className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 font-mono text-xs tabular-nums text-fg"
            >
              <span className="text-fg-muted">#{c.cycleNumber}</span>
              <span className="text-fg-subtle truncate">
                {new Date(c.startedAt).toLocaleDateString()}
              </span>
              <span className="text-right">{formatDurationMs(c.totalTimeMs)}</span>
              <span className="text-right text-fg-muted">
                {Math.round(accuracy * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
