import { useEffect } from 'preact/hooks';
import type { Observation } from '@/lib/types.ts';
import ConditionsGrid from '@/components/conditions/ConditionsGrid.tsx';
import { latestObservation, startObservationPolling, todayStats } from '@/lib/hooks/useObservationState.ts';

interface CurrentConditionsProps {
  initial: Observation | null;
}

export default function CurrentConditions({ initial }: CurrentConditionsProps) {
  // Seed the shared signal with the SSR-fetched observation so the UI is
  // populated immediately without waiting for the first client-side poll.
  if (latestObservation.value === null && initial !== null) {
    latestObservation.value = initial;
  }

  useEffect(() => {
    return startObservationPolling();
  }, []);

  return <ConditionsGrid obs={latestObservation.value} todayStats={todayStats.value} />;
}
