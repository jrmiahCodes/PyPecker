'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CycleHistory } from '@/components/CycleHistory';
import {
  formatDurationMs,
  getBestCycleTime,
  getCompletedCycleCount,
  getLatestCompletedCycle,
  isMastered,
} from '@/lib/cycleTracker';
import { PUZZLE_SETS } from '@/lib/puzzleEngine';
import { loadSetProgress } from '@/lib/storage';
import type { SetProgress } from '@/lib/types';

interface SetEntry {
  meta: (typeof PUZZLE_SETS)[number];
  progress: SetProgress | null;
}

export function ProgressOverview() {
  const [entries, setEntries] = useState<SetEntry[]>(() =>
    PUZZLE_SETS.map((meta) => ({ meta, progress: null })),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const next: SetEntry[] = PUZZLE_SETS.map((meta) => ({
      meta,
      progress: loadSetProgress(meta.id),
    }));
    setEntries(next);
    setHydrated(true);
  }, []);

  const totals = entries.reduce(
    (acc, { progress }) => {
      if (!progress) return acc;
      const completed = getCompletedCycleCount(progress);
      acc.cycles += completed;
      if (completed > 0) acc.setsStarted += 1;
      if (isMastered(progress)) acc.mastered += 1;
      return acc;
    },
    { cycles: 0, setsStarted: 0, mastered: 0 },
  );

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-mono text-xs uppercase tracking-widest text-fg-subtle hover:text-fg transition-colors duration-150"
            >
              ← home
            </Link>
          </div>
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            progress
          </p>
          <h1 className="text-3xl font-semibold text-fg">Cycle history</h1>
          <p className="text-fg-muted leading-relaxed max-w-2xl">
            Track your times across every set. A set is mastered after five
            cycles at 90% accuracy with the latest time near half of the one
            before.
          </p>
        </header>

        {hydrated && (
          <section className="grid grid-cols-3 gap-3">
            <StatCard label="Sets started" value={`${totals.setsStarted}`} />
            <StatCard label="Cycles done" value={`${totals.cycles}`} />
            <StatCard
              label="Mastered"
              value={`${totals.mastered}`}
              accent={totals.mastered > 0}
            />
          </section>
        )}

        <section className="space-y-5">
          {entries.map(({ meta, progress }) => (
            <div key={meta.id} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <Link
                  href={`/train/${meta.id}`}
                  className="font-mono text-xs uppercase tracking-widest text-fg-subtle hover:text-accent transition-colors duration-150"
                >
                  train →
                </Link>
                {progress && (
                  <SetSummary progress={progress} />
                )}
              </div>
              <CycleHistory
                progress={progress ?? emptyProgress(meta.id)}
                meta={meta}
              />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatCard({ label, value, accent = false }: StatCardProps) {
  return (
    <div className="rounded-md border border-line bg-bg-elev p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl tabular-nums ${
          accent ? 'text-accent' : 'text-fg'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SetSummary({ progress }: { progress: SetProgress }) {
  const best = getBestCycleTime(progress);
  const latest = getLatestCompletedCycle(progress);
  if (!best || !latest) return null;
  return (
    <div className="font-mono text-xs text-fg-subtle">
      best {formatDurationMs(best)} · last {formatDurationMs(latest.totalTimeMs)}
    </div>
  );
}

function emptyProgress(setId: string): SetProgress {
  return { setId, cycles: [], currentPuzzleIndex: 0 };
}
