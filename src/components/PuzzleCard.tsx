'use client';

import type { Puzzle } from '@/lib/types';

interface PuzzleCardProps {
  puzzle: Puzzle;
}

export function PuzzleCard({ puzzle }: PuzzleCardProps) {
  const setupCode = [puzzle.given_code, puzzle.given_variables]
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join('\n');

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-fg-subtle">
          {puzzle.domain_context}
        </p>
        <p className="text-lg text-fg leading-relaxed">{puzzle.prompt}</p>
      </div>
      {setupCode && (
        <div className="rounded-md border border-line bg-bg-muted p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-fg-subtle mb-2">
            Given
          </p>
          <pre className="font-mono text-sm text-fg-muted whitespace-pre-wrap break-words">
            {setupCode}
          </pre>
        </div>
      )}
    </div>
  );
}
