import { useEffect, useRef, useState } from 'preact/hooks';
import * as echarts from 'echarts';
import { initRecentObservations, recentObservations } from '@/lib/hooks/useObservationState.ts';
import type { Observation } from '@/lib/types.ts';

interface Props {
  from: string;
  to: string;
}

export default function WindChart({ from, to }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!divRef.current) return;

    setLoading(true);
    setError(false);

    const dark = document.documentElement.classList.contains('dark');
    chartRef.current = echarts.init(divRef.current, dark ? 'dark' : undefined);

    const handleResize = () => chartRef.current?.resize();
    globalThis.addEventListener('resize', handleResize);

    const unsub = recentObservations.subscribe((obs: Observation[] | null) => {
      if (!obs || !chartRef.current) return;

      const speedData = obs
        .filter((o) => o.windSpeed != null)
        .map((o) => [o.timestamp * 1000, o.windSpeed]);
      const gustData = obs
        .filter((o) => o.windGust != null)
        .map((o) => [o.timestamp * 1000, o.windGust]);

      chartRef.current.setOption({
        backgroundColor: 'transparent',
        grid: { top: 8, right: 8, bottom: 24, left: 48, containLabel: false },
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        xAxis: { type: 'time', axisLabel: { fontSize: 11 } },
        yAxis: { name: 'm/s', nameLocation: 'end', min: 0 },
        series: [
          {
            name: 'Wind Speed',
            type: 'line',
            smooth: true,
            data: speedData,
            itemStyle: { color: '#fb923c' },
            lineStyle: { color: '#fb923c' },
            showSymbol: false,
          },
          {
            name: 'Wind Gust',
            type: 'line',
            smooth: true,
            data: gustData,
            itemStyle: { color: '#f87171' },
            lineStyle: { color: '#f87171', type: 'dashed' },
            showSymbol: false,
          },
        ],
      });
      setLoading(false);
    });

    initRecentObservations(from, to).then((ok) => {
      if (!ok) setError(true);
    });

    return () => {
      unsub();
      globalThis.removeEventListener('resize', handleResize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [from, to]);

  return (
    <div style='position: relative; height: 200px;'>
      {loading && !error && (
        <div style='position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--color-muted); font-size: 13px;'>
          Loading...
        </div>
      )}
      {error && (
        <div style='position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--color-muted); font-size: 13px;'>
          No data
        </div>
      )}
      <div ref={divRef} style='width: 100%; height: 200px;' />
    </div>
  );
}
