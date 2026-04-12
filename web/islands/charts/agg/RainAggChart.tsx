import { useEffect, useRef, useState } from 'preact/hooks';
import * as echarts from 'echarts';
import type { AggregateObservation } from '@/lib/types.ts';

interface Props {
  from: string;
  to: string;
  bucket: 'hour' | 'day';
}

export default function RainAggChart({ from, to, bucket }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!divRef.current) return;

    const dark = document.documentElement.classList.contains('dark');
    const chart = echarts.init(divRef.current, dark ? 'dark' : undefined);

    const handleResize = () => chart.resize();
    globalThis.addEventListener('resize', handleResize);

    const qs = new URLSearchParams({ from, to, bucket });
    fetch(`/api/observations/aggregate?${qs}`)
      .then((r) => r.json())
      .then((aggs: AggregateObservation[]) => {
        const data = aggs
          .filter((a) => a.rain_total_mm != null)
          .map((a) => [new Date(a.bucket).getTime(), a.rain_total_mm]);

        chart.setOption({
          backgroundColor: 'transparent',
          grid: { top: 8, right: 8, bottom: 24, left: 48, containLabel: false },
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          xAxis: { type: 'time', axisLabel: { fontSize: 11 } },
          yAxis: { name: 'mm', nameLocation: 'end' },
          series: [
            {
              name: 'Rain Total',
              type: 'bar',
              data,
              itemStyle: { color: '#60a5fa' },
            },
          ],
        });
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });

    return () => {
      globalThis.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [from, to, bucket]);

  return (
    <div style='position: relative; height: 220px;'>
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
      <div ref={divRef} style='width: 100%; height: 220px;' />
    </div>
  );
}
