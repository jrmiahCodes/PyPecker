'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeInput } from '@/components/CodeInput';
import { FeedbackDisplay } from '@/components/FeedbackDisplay';
import { ProgressBar } from '@/components/ProgressBar';
import { PuzzleCard } from '@/components/PuzzleCard';
import { SessionTimer } from '@/components/SessionTimer';
import {
  advanceToNextPuzzle,
  completeCycle,
  createEmptyProgress,
  ensureActiveCycle,
  formatDurationMs,
  getCurrentCycle,
  getCycleStats,
  getLatestCompletedCycle,
  getTargetTime,
  getWeakestResults,
  recordPuzzleResult,
  restartCurrentCycle,
} from '@/lib/cycleTracker';
import {
  getPuzzleSetMeta,
  loadPuzzleSet,
  validateSolution,
} from '@/lib/puzzleEngine';
import {
  initPyodide,
  onPyodideStatusChange,
  type PyodideStatus,
} from '@/lib/pyodide';
import { loadSetProgress, saveSetProgress } from '@/lib/storage';
import type { CycleState, Puzzle, SetProgress, ValidationResult } from '@/lib/types';

const AUTO_ADVANCE_DELAY_MS = 500;

interface TrainingSessionProps {
  setId: string;
}

export function TrainingSession({ setId }: TrainingSessionProps) {
  const router = useRouter();
  const meta = getPuzzleSetMeta(setId);

  const [puzzles, setPuzzles] = useState<Puzzle[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SetProgress | null>(null);
  const [userCode, setUserCode] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hintsShown, setHintsShown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [puzzleStartedAt, setPuzzleStartedAt] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isValidating, setIsValidating] = useState(false);
  const [pyodideStatus, setPyodideStatus] = useState<PyodideStatus>('idle');
  const [completedCycle, setCompletedCycle] = useState<CycleState | null>(null);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<SetProgress | null>(null);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    loadPuzzleSet(setId)
      .then((data) => {
        if (!cancelled) setPuzzles(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setId, meta]);

  useEffect(() => {
    if (!meta) return;
    const existing = loadSetProgress(setId) ?? createEmptyProgress(setId);
    const withActive = ensureActiveCycle(existing);
    setProgress(withActive);
    progressRef.current = withActive;
    if (withActive !== existing) saveSetProgress(withActive);
    setPuzzleStartedAt(Date.now());
  }, [setId, meta]);

  useEffect(() => {
    const unsubscribe = onPyodideStatusChange(setPyodideStatus);
    setPyodideStatus('loading');
    initPyodide().catch((err) => {
      console.error('[pypecker] failed to initialize pyodide', err);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const currentCycle = useMemo(
    () => (progress ? getCurrentCycle(progress) : null),
    [progress],
  );

  const currentPuzzle = useMemo<Puzzle | null>(() => {
    if (!puzzles || !progress) return null;
    if (progress.currentPuzzleIndex >= puzzles.length) return null;
    return puzzles[progress.currentPuzzleIndex] ?? null;
  }, [puzzles, progress]);

  const totalPuzzles = puzzles?.length ?? meta?.size ?? 0;
  const isCycleComplete = !currentPuzzle && puzzles !== null && progress !== null;

  const elapsedThisPuzzleMs = nowMs - puzzleStartedAt;
  const totalElapsedMs = (currentCycle?.totalTimeMs ?? 0) + (currentPuzzle ? elapsedThisPuzzleMs : 0);
  const targetMs = progress ? getTargetTime(progress) : null;

  useEffect(() => {
    setUserCode('');
    setValidationResult(null);
    setRevealed(false);
    setHintsShown(0);
    setAttempts(0);
    setPuzzleStartedAt(Date.now());
  }, [progress?.currentPuzzleIndex, setId]);

  const persistProgress = useCallback((next: SetProgress) => {
    setProgress(next);
    progressRef.current = next;
    saveSetProgress(next);
  }, []);

  const handleAdvance = useCallback(() => {
    const latest = progressRef.current;
    if (!latest || !puzzles) return;
    const advanced = advanceToNextPuzzle(latest);
    if (advanced.currentPuzzleIndex >= puzzles.length) {
      const finished = completeCycle(advanced);
      persistProgress(finished);
      const justCompleted = finished.cycles[finished.cycles.length - 1];
      setCompletedCycle(justCompleted);
    } else {
      persistProgress(advanced);
    }
  }, [puzzles, persistProgress]);

  const handleSubmit = useCallback(async () => {
    if (!currentPuzzle || !progress || isValidating || revealed) return;
    if (userCode.trim().length === 0) return;
    if (pyodideStatus !== 'ready') return;

    setIsValidating(true);
    setValidationResult(null);
    try {
      const result = await validateSolution(currentPuzzle, userCode);
      setValidationResult(result);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (result.correct) {
        const elapsed = Date.now() - puzzleStartedAt;
        const next = recordPuzzleResult(progress, {
          puzzleId: currentPuzzle.id,
          correct: true,
          timeMs: elapsed,
          attempts: newAttempts,
        });
        persistProgress(next);
        advanceTimer.current = setTimeout(() => {
          handleAdvance();
        }, AUTO_ADVANCE_DELAY_MS);
      }
    } finally {
      setIsValidating(false);
    }
  }, [
    currentPuzzle,
    progress,
    userCode,
    attempts,
    puzzleStartedAt,
    pyodideStatus,
    isValidating,
    revealed,
    persistProgress,
    handleAdvance,
  ]);

  const revealAnswer = useCallback(() => {
    if (!currentPuzzle || !progress || revealed) return;
    setRevealed(true);
    setValidationResult(null);
    const elapsed = Date.now() - puzzleStartedAt;
    const next = recordPuzzleResult(progress, {
      puzzleId: currentPuzzle.id,
      correct: false,
      timeMs: elapsed,
      attempts: attempts + 1,
    });
    persistProgress(next);
  }, [currentPuzzle, progress, revealed, attempts, puzzleStartedAt, persistProgress]);

  const handleHint = useCallback(() => {
    if (!currentPuzzle || revealed) return;
    const nextCount = hintsShown + 1;
    if (nextCount >= currentPuzzle.hints.length) {
      setHintsShown(currentPuzzle.hints.length);
      revealAnswer();
    } else {
      setHintsShown(nextCount);
    }
  }, [currentPuzzle, revealed, hintsShown, revealAnswer]);

  const handleShowAnswer = revealAnswer;

  const handleSkipForward = useCallback(() => {
    handleAdvance();
  }, [handleAdvance]);

  const handleSkipPuzzle = useCallback(() => {
    if (!currentPuzzle || !progress) return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const elapsed = Date.now() - puzzleStartedAt;
    const withResult = recordPuzzleResult(progress, {
      puzzleId: currentPuzzle.id,
      correct: false,
      timeMs: elapsed,
      attempts: attempts + 1,
    });
    const advanced = advanceToNextPuzzle(withResult);
    if (puzzles && advanced.currentPuzzleIndex >= puzzles.length) {
      const finished = completeCycle(advanced);
      persistProgress(finished);
      setCompletedCycle(finished.cycles[finished.cycles.length - 1]);
    } else {
      persistProgress(advanced);
    }
  }, [currentPuzzle, progress, puzzles, attempts, puzzleStartedAt, persistProgress]);

  const handleRetryPyodide = useCallback(() => {
    setPyodideStatus('loading');
    initPyodide().catch((err) => {
      console.error('[pypecker] pyodide retry failed', err);
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const mod = event.metaKey || event.ctrlKey;

      if (event.key === 'Escape') {
        event.preventDefault();
        router.push('/');
        return;
      }

      if (!currentPuzzle || completedCycle) return;

      if (mod && (event.key === 'h' || event.key === 'H')) {
        event.preventDefault();
        if (!revealed) handleHint();
        return;
      }

      if (mod && event.key === 'ArrowRight') {
        event.preventDefault();
        if (revealed) {
          handleSkipForward();
        } else {
          handleSkipPuzzle();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [
    router,
    currentPuzzle,
    completedCycle,
    revealed,
    handleHint,
    handleSkipForward,
    handleSkipPuzzle,
  ]);

  const handleStartNextCycle = useCallback(() => {
    if (!progress) return;
    const next = restartCurrentCycle(progress);
    persistProgress(next);
    setCompletedCycle(null);
    setPuzzleStartedAt(Date.now());
  }, [progress, persistProgress]);

  if (!meta) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-err">
            Unknown set
          </p>
          <p className="text-fg-muted">No puzzle set with id &quot;{setId}&quot;.</p>
          <Link href="/" className="font-mono text-sm text-accent hover:text-accent-hover">
            ← back
          </Link>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-err">
            Failed to load puzzles
          </p>
          <p className="text-fg-muted">{loadError}</p>
          <Link href="/" className="font-mono text-sm text-accent hover:text-accent-hover">
            ← back
          </Link>
        </div>
      </main>
    );
  }

  if (!puzzles || !progress || !currentCycle) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-subtle">
            loading puzzles…
          </p>
          {pyodideStatus === 'loading' && (
            <p className="font-mono text-xs text-fg-subtle">
              initializing Python runtime — first load can take ~10s
            </p>
          )}
          {pyodideStatus === 'error' && (
            <div className="space-y-3">
              <p className="font-mono text-xs text-err">
                Python runtime failed to load. Check your connection — Pyodide loads
                from a CDN on first use.
              </p>
              <button
                type="button"
                onClick={handleRetryPyodide}
                className="font-mono text-xs px-4 py-2 rounded-md border border-line text-fg hover:border-line-strong transition-colors duration-150"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (completedCycle || isCycleComplete) {
    const cycle = completedCycle ?? currentCycle;
    return (
      <CycleCompleteView
        cycle={cycle}
        progress={progress}
        puzzles={puzzles}
        onStartNext={handleStartNextCycle}
      />
    );
  }

  if (!currentPuzzle) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-subtle">
          finalizing cycle…
        </p>
      </main>
    );
  }

  const inputMode: 'inline' | 'multiline' = currentPuzzle.tier === 3 ? 'multiline' : 'inline';
  const submitLabel =
    inputMode === 'multiline' ? 'Submit (⌘↵)' : 'Submit (↵)';
  const canSubmit =
    !isValidating &&
    !revealed &&
    pyodideStatus === 'ready' &&
    userCode.trim().length > 0;
  const hintAvailable = hintsShown < currentPuzzle.hints.length;

  return (
    <main className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 sm:gap-4 justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Link
              href="/"
              className="font-mono text-xs uppercase tracking-widest text-fg-subtle hover:text-fg shrink-0"
              aria-label="Back to sets"
            >
              ←
            </Link>
            <span className="font-mono text-xs uppercase tracking-widest text-fg-subtle shrink-0">
              Cycle {currentCycle.cycleNumber}
            </span>
            <div className="min-w-0 flex-1">
              <ProgressBar current={progress.currentPuzzleIndex} total={totalPuzzles} />
            </div>
          </div>
          <SessionTimer elapsedMs={totalElapsedMs} targetMs={targetMs} />
        </div>
      </div>

      <p className="sm:hidden mx-auto max-w-3xl px-4 pt-4 font-mono text-xs text-fg-subtle">
        tip: PyPecker works best on desktop with a physical keyboard.
      </p>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {pyodideStatus !== 'ready' && (
          <div
            className={`rounded-md border px-4 py-3 font-mono text-xs flex flex-wrap items-center gap-3 justify-between ${
              pyodideStatus === 'error'
                ? 'border-err/40 bg-err/5 text-err'
                : 'border-line bg-bg-elev text-fg-muted'
            }`}
          >
            <span>
              {pyodideStatus === 'loading' && 'loading Python runtime…'}
              {pyodideStatus === 'idle' && 'starting Python runtime…'}
              {pyodideStatus === 'error' &&
                'Python runtime failed to load — check your connection.'}
            </span>
            {pyodideStatus === 'error' && (
              <button
                type="button"
                onClick={handleRetryPyodide}
                className="font-mono text-xs px-3 py-1 rounded border border-err/60 text-err hover:bg-err/10 transition-colors duration-150"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <PuzzleCard puzzle={currentPuzzle} />

        <CodeInput
          key={currentPuzzle.id}
          value={userCode}
          onChange={setUserCode}
          onSubmit={handleSubmit}
          mode={inputMode}
          disabled={isValidating || revealed}
          placeholder={
            inputMode === 'multiline'
              ? 'assign your answer to `result` · ⌘↵ to submit'
              : 'type your expression · ↵ to submit'
          }
        />

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 sm:flex-none font-mono text-sm px-4 py-3 sm:py-2 rounded-md bg-accent text-bg hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {isValidating ? 'checking…' : submitLabel}
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={!hintAvailable || revealed}
            className="font-mono text-sm px-4 py-3 sm:py-2 rounded-md border border-line text-fg hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Hint {hintsShown > 0 && `(${hintsShown}/${currentPuzzle.hints.length})`}
          </button>
          <button
            type="button"
            onClick={handleShowAnswer}
            disabled={revealed}
            className="font-mono text-sm px-4 py-3 sm:py-2 rounded-md border border-line text-fg-muted hover:text-fg hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
          >
            Show Answer
          </button>
          {revealed && (
            <button
              type="button"
              onClick={handleSkipForward}
              className="sm:ml-auto font-mono text-sm px-4 py-3 sm:py-2 rounded-md bg-bg-elev text-fg hover:bg-bg-muted transition-colors duration-150"
            >
              Next →
            </button>
          )}
        </div>

        {hintsShown > 0 && !revealed && (
          <div className="rounded-md border border-line bg-bg-elev p-4 space-y-2">
            <p className="font-mono text-xs uppercase tracking-widest text-fg-subtle">
              Hints
            </p>
            <ul className="space-y-1 text-sm text-fg-muted">
              {currentPuzzle.hints.slice(0, hintsShown).map((hint, i) => (
                <li key={i}>· {hint}</li>
              ))}
            </ul>
          </div>
        )}

        <FeedbackDisplay
          result={validationResult}
          revealed={revealed}
          solution={currentPuzzle.solution}
        />
      </div>
    </main>
  );
}

interface CycleCompleteViewProps {
  cycle: CycleState;
  progress: SetProgress;
  puzzles: Puzzle[] | null;
  onStartNext: () => void;
}

function CycleCompleteView({ cycle, progress, puzzles, onStartNext }: CycleCompleteViewProps) {
  const stats = getCycleStats(cycle);
  const weakest = getWeakestResults(cycle, 5);
  const puzzleMap = useMemo(() => {
    if (!puzzles) return new Map<string, Puzzle>();
    return new Map(puzzles.map((p) => [p.id, p]));
  }, [puzzles]);

  const previousCycle = (() => {
    const completed = progress.cycles.filter((c) => c.completed);
    const currentIdx = completed.findIndex((c) => c.cycleNumber === cycle.cycleNumber);
    if (currentIdx <= 0) return null;
    return completed[currentIdx - 1];
  })();
  const latest = getLatestCompletedCycle(progress);
  const nextTarget = latest ? Math.round(latest.totalTimeMs / 2) : null;
  const previousTarget = previousCycle ? Math.round(previousCycle.totalTimeMs / 2) : null;
  const beatTarget =
    previousTarget !== null ? cycle.totalTimeMs <= previousTarget : null;
  const deltaVsPrevious = previousCycle ? cycle.totalTimeMs - previousCycle.totalTimeMs : null;
  const deltaVsTarget = previousTarget !== null ? cycle.totalTimeMs - previousTarget : null;

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-2 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">
            Cycle {cycle.cycleNumber} complete
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-fg font-mono tabular-nums">
            {formatDurationMs(stats.totalTimeMs)}
          </h1>
          <p className="text-fg-muted">
            {Math.round(stats.accuracy * 100)}% accuracy · {stats.correctCount}/{stats.totalCount}{' '}
            correct · avg {formatDurationMs(stats.avgTimePerPuzzleMs)} per puzzle
          </p>
        </header>

        <div className="rounded-md border border-line bg-bg-elev p-5 space-y-3 font-mono text-sm">
          {previousCycle && (
            <div className="flex justify-between text-fg-muted">
              <span>Previous cycle</span>
              <span>{formatDurationMs(previousCycle.totalTimeMs)}</span>
            </div>
          )}
          <div className="flex justify-between text-fg">
            <span>This cycle</span>
            <span>{formatDurationMs(cycle.totalTimeMs)}</span>
          </div>
          {deltaVsPrevious !== null && (
            <div
              className={`flex justify-between ${
                deltaVsPrevious < 0 ? 'text-ok' : deltaVsPrevious > 0 ? 'text-err' : 'text-fg-muted'
              }`}
            >
              <span>vs previous</span>
              <span>
                {deltaVsPrevious === 0
                  ? 'even'
                  : `${deltaVsPrevious < 0 ? '-' : '+'}${formatDurationMs(Math.abs(deltaVsPrevious))}`}
              </span>
            </div>
          )}
          {previousTarget !== null && (
            <div className="flex justify-between text-fg-muted">
              <span>Target (½ previous)</span>
              <span>{formatDurationMs(previousTarget)}</span>
            </div>
          )}
          {beatTarget !== null && deltaVsTarget !== null && (
            <div className={`flex justify-between ${beatTarget ? 'text-ok' : 'text-err'}`}>
              <span>vs target</span>
              <span>
                {beatTarget ? '-' : '+'}
                {formatDurationMs(Math.abs(deltaVsTarget))} {beatTarget ? 'under' : 'over'}
              </span>
            </div>
          )}
          {nextTarget !== null && (
            <div className="flex justify-between text-accent">
              <span>Next cycle target</span>
              <span>{formatDurationMs(nextTarget)}</span>
            </div>
          )}
        </div>

        {weakest.length > 0 && (
          <div className="rounded-md border border-line bg-bg-elev p-5 space-y-3">
            <p className="font-mono text-xs uppercase tracking-widest text-fg-subtle">
              Weakest puzzles
            </p>
            <ul className="space-y-2">
              {weakest.map((r) => {
                const puzzle = puzzleMap.get(r.puzzleId);
                return (
                  <li
                    key={r.puzzleId}
                    className="flex items-baseline justify-between gap-3 font-mono text-xs"
                  >
                    <span className="truncate text-fg">
                      {puzzle?.title ?? r.puzzleId}
                    </span>
                    <span className="shrink-0 text-fg-muted tabular-nums">
                      {r.attempts} {r.attempts === 1 ? 'try' : 'tries'} ·{' '}
                      {formatDurationMs(r.timeMs)}
                      {!r.correct && <span className="text-err"> · failed</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 justify-center">
          <button
            type="button"
            onClick={onStartNext}
            className="font-mono text-sm px-5 py-3 rounded-md bg-accent text-bg hover:bg-accent-hover transition-colors duration-150"
          >
            Start Cycle {cycle.cycleNumber + 1}
          </button>
          <Link
            href="/"
            className="font-mono text-sm px-5 py-3 rounded-md border border-line text-fg hover:border-line-strong transition-colors duration-150"
          >
            Back to sets
          </Link>
          <Link
            href="/progress"
            className="font-mono text-sm px-5 py-3 rounded-md border border-line text-fg hover:border-line-strong transition-colors duration-150"
          >
            Progress
          </Link>
        </div>
      </div>
    </main>
  );
}
