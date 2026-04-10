import { useEffect, useRef, useState } from "preact/hooks";
import * as echarts from "echarts";
import type { AggregateObservation } from "@/lib/types.ts";

interface Props {
  from: string;
  to: string;
  bucket: 'hour' | 'day';
}

export default function TempAggChart({ from, to, bucket }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!divRef.current) return;

    const dark = document.documentElement.classList.contains("dark");
    const chart = echarts.init(divRef.current, dark ? "dark" : undefined);

    const handleResize = () => chart.resize();
    globalThis.addEventListener("resize", handleResize);

    const qs = new URLSearchParams({ from, to, bucket });
    fetch(`/api/observations/aggregate?${qs}`)
      .then((r) => r.json())
      .then((aggs: AggregateObservation[]) => {
        const minData = aggs
          .filter((a) => a.temp_c_min != null)
          .map((a) => [new Date(a.bucket).getTime(), a.temp_c_min]);
        const maxData = aggs
          .filter((a) => a.temp_c_max != null)
          .map((a) => [new Date(a.bucket).getTime(), a.temp_c_max]);
        const avgData = aggs
          .filter((a) => a.temp_c_avg != null)
          .map((a) => [new Date(a.bucket).getTime(), a.temp_c_avg]);
        const dewData = aggs
          .filter((a) => a.dew_point_c_avg != null)
          .map((a) => [new Date(a.bucket).getTime(), a.dew_point_c_avg]);

        chart.setOption({
          backgroundColor: "transparent",
          grid: { top: 8, right: 8, bottom: 24, left: 48, containLabel: false },
          tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
          xAxis: { type: "time", axisLabel: { fontSize: 11 } },
          yAxis: { name: "°C", nameLocation: "end" },
          series: [
            {
              name: "Min Temp",
              type: "line",
              smooth: true,
              data: minData,
              itemStyle: { color: "#38bdf8" },
              lineStyle: { color: "#38bdf8", type: "dashed", opacity: 0.5 },
              showSymbol: false,
            },
            {
              name: "Max Temp",
              type: "line",
              smooth: true,
              data: maxData,
              itemStyle: { color: "#38bdf8" },
              lineStyle: { color: "#38bdf8", type: "dashed", opacity: 0.5 },
              showSymbol: false,
            },
            {
              name: "Avg Temp",
              type: "line",
              smooth: true,
              data: avgData,
              itemStyle: { color: "#38bdf8" },
              lineStyle: { color: "#38bdf8" },
              areaStyle: { color: "#38bdf8", opacity: 0.15 },
              showSymbol: false,
            },
            {
              name: "Dew Point",
              type: "line",
              smooth: true,
              data: dewData,
              itemStyle: { color: "#818cf8" },
              lineStyle: { color: "#818cf8" },
              showSymbol: false,
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
      globalThis.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [from, to, bucket]);

  return (
    <div style="position: relative; height: 220px;">
      {loading && !error && (
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--color-muted); font-size: 13px;">
          Loading...
        </div>
      )}
      {error && (
        <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--color-muted); font-size: 13px;">
          No data
        </div>
      )}
      <div ref={divRef} style="width: 100%; height: 220px;" />
    </div>
  );
}
