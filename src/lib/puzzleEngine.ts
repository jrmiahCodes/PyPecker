import type { Puzzle, SetProgress, Tier, ValidationResult } from './types';
import { validateAnswer } from './pyodide';

export interface PuzzleSetMeta {
  id: string;
  title: string;
  tier: Tier;
  tagline: string;
  description: string;
  size: number;
}

export const PUZZLE_SETS: PuzzleSetMeta[] = [
  {
    id: 'tier1-atomic',
    title: 'Tier 1 — Atomic Patterns',
    tier: 1,
    tagline: 'Single expressions. The building blocks.',
    description:
      'Thirty one-expression drills covering f-strings, comprehensions, unpacking, and the stdlib primitives you reach for every day.',
    size: 30,
  },
  {
    id: 'tier2-combinations',
    title: 'Tier 2 — Combinations',
    tier: 2,
    tagline: 'Two concepts, one line.',
    description:
      'Twenty-five drills chaining a primitive with a method — comprehensions over Path globs, Counters, regex, datetime, itertools.',
    size: 25,
  },
  {
    id: 'tier3-compound',
    title: 'Tier 3 — Compound Tactics',
    tier: 3,
    tagline: 'Multi-step blocks. Putting it together.',
    description:
      'Fifteen short scripts. Parse, transform, aggregate. Assign your answer to `result`.',
    size: 15,
  },
];

const puzzleCache = new Map<string, Puzzle[]>();

export function getPuzzleSetMeta(setId: string): PuzzleSetMeta | null {
  return PUZZLE_SETS.find((s) => s.id === setId) ?? null;
}

export async function loadPuzzleSet(setId: string): Promise<Puzzle[]> {
  const cached = puzzleCache.get(setId);
  if (cached) return cached;

  const response = await fetch(`/puzzles/${setId}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load puzzle set "${setId}": ${response.status}`);
  }
  const data = (await response.json()) as Puzzle[];
  if (!Array.isArray(data)) {
    throw new Error(`Invalid puzzle set "${setId}": expected array`);
  }
  puzzleCache.set(setId, data);
  return data;
}

export function getNextPuzzle(
  puzzles: Puzzle[],
  progress: SetProgress,
): Puzzle | null {
  if (progress.currentPuzzleIndex >= puzzles.length) return null;
  return puzzles[progress.currentPuzzleIndex] ?? null;
}

export function isPuzzleSetComplete(
  progress: SetProgress,
  setSize: number,
): boolean {
  return progress.currentPuzzleIndex >= setSize;
}

export function validateSolution(
  puzzle: Puzzle,
  userCode: string,
): Promise<ValidationResult> {
  return validateAnswer(
    puzzle.given_variables,
    puzzle.given_code,
    userCode,
    puzzle.expected_output,
    puzzle.expected_output_type,
  );
}
