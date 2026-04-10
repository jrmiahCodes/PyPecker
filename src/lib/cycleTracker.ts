import type { CycleState, PuzzleResult, SetProgress } from './types';

export function createEmptyProgress(setId: string): SetProgress {
  return {
    setId,
    cycles: [],
    currentPuzzleIndex: 0,
  };
}

export function getCurrentCycle(progress: SetProgress): CycleState | null {
  if (progress.cycles.length === 0) return null;
  const last = progress.cycles[progress.cycles.length - 1];
  return last.completed ? null : last;
}

export function getLatestCompletedCycle(progress: SetProgress): CycleState | null {
  for (let i = progress.cycles.length - 1; i >= 0; i--) {
    if (progress.cycles[i].completed) return progress.cycles[i];
  }
  return null;
}

export function getCompletedCycles(progress: SetProgress): CycleState[] {
  return progress.cycles.filter((c) => c.completed);
}

export function getCompletedCycleCount(progress: SetProgress): number {
  return getCompletedCycles(progress).length;
}

export function getTargetTime(progress: SetProgress): number | null {
  const last = getLatestCompletedCycle(progress);
  return last ? Math.round(last.totalTimeMs / 2) : null;
}

export function getBestCycleTime(progress: SetProgress): number | null {
  const completed = getCompletedCycles(progress);
  if (completed.length === 0) return null;
  return Math.min(...completed.map((c) => c.totalTimeMs));
}

export function calculateCycleAccuracy(cycle: CycleState): number {
  if (cycle.puzzleResults.length === 0) return 0;
  const correct = cycle.puzzleResults.filter((r) => r.correct).length;
  return correct / cycle.puzzleResults.length;
}

export interface CycleStats {
  totalTimeMs: number;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  avgTimePerPuzzleMs: number;
}

export function getCycleStats(cycle: CycleState): CycleStats {
  const totalCount = cycle.puzzleResults.length;
  const correctCount = cycle.puzzleResults.filter((r) => r.correct).length;
  const accuracy = totalCount === 0 ? 0 : correctCount / totalCount;
  const avgTimePerPuzzleMs = totalCount === 0 ? 0 : Math.round(cycle.totalTimeMs / totalCount);
  return {
    totalTimeMs: cycle.totalTimeMs,
    correctCount,
    totalCount,
    accuracy,
    avgTimePerPuzzleMs,
  };
}

export function getWeakestResults(cycle: CycleState, limit = 5): PuzzleResult[] {
  return [...cycle.puzzleResults]
    .sort((a, b) => {
      if (a.correct !== b.correct) return a.correct ? 1 : -1;
      if (b.attempts !== a.attempts) return b.attempts - a.attempts;
      return b.timeMs - a.timeMs;
    })
    .slice(0, limit);
}

export function isMastered(
  progress: SetProgress,
  minCycles = 5,
  minAccuracy = 0.9,
): boolean {
  const completed = getCompletedCycles(progress);
  if (completed.length < minCycles) return false;
  if (!completed.every((c) => calculateCycleAccuracy(c) >= minAccuracy)) return false;

  const prev = completed[completed.length - 2];
  const latest = completed[completed.length - 1];
  const target = prev.totalTimeMs / 2;
  return latest.totalTimeMs <= target * 1.1;
}

function appendNewCycle(progress: SetProgress): SetProgress {
  const cycleNumber = getCompletedCycleCount(progress) + 1;
  const newCycle: CycleState = {
    setId: progress.setId,
    cycleNumber,
    startedAt: new Date().toISOString(),
    puzzleResults: [],
    totalTimeMs: 0,
    completed: false,
  };
  return {
    ...progress,
    cycles: [...progress.cycles, newCycle],
    currentPuzzleIndex: 0,
  };
}

export function ensureActiveCycle(progress: SetProgress): SetProgress {
  if (getCurrentCycle(progress)) return progress;
  return appendNewCycle(progress);
}

export function restartCurrentCycle(progress: SetProgress): SetProgress {
  const completedOnly = progress.cycles.filter((c) => c.completed);
  return appendNewCycle({
    ...progress,
    cycles: completedOnly,
    currentPuzzleIndex: 0,
  });
}

export function recordPuzzleResult(
  progress: SetProgress,
  result: PuzzleResult,
): SetProgress {
  const current = getCurrentCycle(progress);
  if (!current) return progress;
  const updatedCycle: CycleState = {
    ...current,
    puzzleResults: [...current.puzzleResults, result],
    totalTimeMs: current.totalTimeMs + result.timeMs,
  };
  return replaceCurrentCycle(progress, updatedCycle);
}

export function advanceToNextPuzzle(progress: SetProgress): SetProgress {
  return { ...progress, currentPuzzleIndex: progress.currentPuzzleIndex + 1 };
}

export function completeCycle(progress: SetProgress): SetProgress {
  const current = getCurrentCycle(progress);
  if (!current) return progress;
  const updated: CycleState = { ...current, completed: true };
  return replaceCurrentCycle(progress, updated);
}

function replaceCurrentCycle(progress: SetProgress, cycle: CycleState): SetProgress {
  const nextCycles = [...progress.cycles];
  nextCycles[nextCycles.length - 1] = cycle;
  return { ...progress, cycles: nextCycles };
}

export function formatDurationMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
