import { PUZZLE_SETS } from '@/lib/puzzleEngine';
import { TrainingSession } from './training-session';

export function generateStaticParams() {
  return PUZZLE_SETS.map((s) => ({ setId: s.id }));
}

export const dynamicParams = false;

export default function Page({ params }: { params: { setId: string } }) {
  return <TrainingSession setId={params.setId} />;
}
