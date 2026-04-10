'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  formatDurationMs,
  getBestCycleTime,
  getCompletedCycleCount,
  getLatestCompletedCycle,
  isMastered,
} from '@/lib/cycleTracker';
import { PUZZLE_SETS, type PuzzleSetMeta } from '@/lib/puzzleEngine';
import { loadSetProgress } from '@/lib/storage';
import type { SetProgress } from '@/lib/types';

export function SetSelector() {
  const [progressMap, setProgressMap] = useState<Record<string, SetProgress | null>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const map: Record<string, SetProgress | null> = {};
    for (const set of PUZZLE_SETS) {
      map[set.id] = loadSetProgress(set.id);
    }
    setProgressMap(map);
    setHydrated(true);
  }, []);

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            pypecker
          </p>
          <h1 className="text-3xl font-semibold text-fg">
            Drill Python patterns the Woodpecker way.
          </h1>
          <p className="text-fg-muted leading-relaxed max-w-2xl">
            Solve a fixed set of syntax puzzles in cycles. Halve your time each
            pass. After five to seven cycles, the patterns run on muscle memory.
          </p>
        </header>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-xs uppercase tracking-widest text-fg-subtle">
              Puzzle sets
            </h2>
            <Link
              href="/progress"
              className="font-mono text-xs uppercase tracking-widest text-fg-subtle hover:text-fg transition-colors duration-150"
            >
              progress →
            </Link>
          </div>
          <div className="space-y-3">
            {PUZZLE_SETS.map((set) => (
              <SetCard
                key={set.id}
                meta={set}
                progress={progressMap[set.id] ?? null}
                hydrated={hydrated}
              />
            ))}
          </div>
        </section>

        <footer className="pt-4 border-t border-line">
          <p className="font-mono text-xs text-fg-subtle leading-relaxed">
            Progress is stored locally in your browser. No account, no server.
            Clearing site data resets your cycles.
          </p>
        </footer>
      </div>
    </main>
  );
}

interface SetCardProps {
  meta: PuzzleSetMeta;
  progress: SetProgress | null;
  hydrated: boolean;
}

function SetCard({ meta, progress, hydrated }: SetCardProps) {
  const completedCount = progress ? getCompletedCycleCount(progress) : 0;
  const bestMs = progress ? getBestCycleTime(progress) : null;
  const latest = progress ? getLatestCompletedCycle(progress) : null;
  const mastered = progress ? isMastered(progress) : false;

  const hasActive =
    progress &&
    progress.cycles.length > 0 &&
    !progress.cycles[progress.cycles.length - 1].completed &&
    progress.currentPuzzleIndex > 0;

  const nextCycleNumber = completedCount + 1;
  const buttonLabel = hasActive
    ? `Resume Cycle ${nextCycleNumber}`
    : completedCount === 0
      ? 'Start Cycle 1'
      : `Start Cycle ${nextCycleNumber}`;

  return (
    <Link
      href={`/train/${meta.id}`}
      className="group block rounded-md border border-line bg-bg-elev p-5 hover:border-line-strong hover:bg-bg-muted transition-colors duration-150"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-widest text-fg-subtle">
              Tier {meta.tier}
            </span>
            <span className="font-mono text-xs text-fg-subtle">
              {meta.size} puzzles
            </span>
            {mastered && (
              <span className="font-mono text-xs uppercase tracking-widest text-accent border border-accent-muted rounded px-2 py-0.5">
                mastered
              </span>
            )}
          </div>
          <h3 className="text-lg font-medium text-fg group-hover:text-accent transition-colors duration-150">
            {meta.title.replace(/^Tier \d — /, '')}
          </h3>
          <p className="text-sm text-fg-muted leading-relaxed">{meta.tagline}</p>
        </div>
        <div className="text-right font-mono text-xs space-y-1 shrink-0">
          {!hydrated ? (
            <span className="text-fg-subtle">&nbsp;</span>
          ) : completedCount === 0 ? (
            <span className="text-fg-subtle">not started</span>
          ) : (
            <>
              <div className="text-fg-muted">
                {completedCount} cycle{completedCount !== 1 ? 's' : ''}
              </div>
              {bestMs !== null && (
                <div className="text-accent">best {formatDurationMs(bestMs)}</div>
              )}
              {latest && (
                <div className="text-fg-subtle">
                  last {formatDurationMs(latest.totalTimeMs)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-fg-muted leading-relaxed max-w-xl">
          {meta.description}
        </p>
        <span className="font-mono text-xs text-accent group-hover:text-accent-hover shrink-0 ml-4">
          {buttonLabel} →
        </span>
      </div>
    </Link>
  );
}
