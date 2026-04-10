import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { Observation, TodayStats } from "@/lib/types.ts";
import ConditionsGrid from "@/components/conditions/ConditionsGrid.tsx";

interface CurrentConditionsProps {
  initial: Observation | null;
}

export default function CurrentConditions({ initial }: CurrentConditionsProps) {
  const obs = useSignal<Observation | null>(initial);
  const todayStats = useSignal<TodayStats | null>(null);

  async function refresh() {
    const [obsResp, statsResp] = await Promise.allSettled([
      fetch("/api/observations/latest"),
      fetch("/api/observations/today"),
    ]);

    if (obsResp.status === "fulfilled" && obsResp.value.ok) {
      obs.value = await obsResp.value.json() as Observation;
    }
    if (statsResp.status === "fulfilled" && statsResp.value.ok) {
      todayStats.value = await statsResp.value.json() as TodayStats;
    }
  }

  useEffect(() => {
    // Fetch immediately on mount, then every 60s
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  return <ConditionsGrid obs={obs.value} todayStats={todayStats.value} />;
}
