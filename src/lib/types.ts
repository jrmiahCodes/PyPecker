export type Tier = 1 | 2 | 3;

export type ExpectedOutputType =
  | 'list'
  | 'dict'
  | 'str'
  | 'int'
  | 'float'
  | 'set'
  | 'tuple'
  | 'bool';

export interface Puzzle {
  id: string;
  tier: Tier;
  title: string;
  domain_context: string;
  prompt: string;
  given_code: string;
  given_variables: string;
  expected_output: string;
  expected_output_type: ExpectedOutputType;
  hints: string[];
  tags: string[];
  solution: string;
}

export interface PuzzleSet {
  id: string;
  title: string;
  tier: Tier;
  description: string;
  puzzles: Puzzle[];
}

export interface PuzzleResult {
  puzzleId: string;
  correct: boolean;
  timeMs: number;
  attempts: number;
}

export interface CycleState {
  setId: string;
  cycleNumber: number;
  startedAt: string;
  puzzleResults: PuzzleResult[];
  totalTimeMs: number;
  completed: boolean;
}

export interface SetProgress {
  setId: string;
  cycles: CycleState[];
  currentPuzzleIndex: number;
}

export interface ExecutionResult {
  success: boolean;
  output: unknown;
  error?: string;
}

export interface ValidationResult {
  correct: boolean;
  actualOutput: unknown;
  actualSerialized: string;
  expectedSerialized: string;
  error?: string;
}
