import { useEffect, useRef, useState } from "preact/hooks";
import * as echarts from "echarts";
import type { Observation } from "@/lib/types.ts";

interface Props {
  from: string;
  to: string;
}

export default function TemperatureChart({ from, to }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!divRef.current) return;

    const dark = document.documentElement.classList.contains("dark");
    const chart = echarts.init(divRef.current, dark ? "dark" : undefined);

    const handleResize = () => chart.resize();
    globalThis.addEventListener("resize", handleResize);

    fetch(`/api/observations/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((obs: Observation[]) => {
        const tempData = obs
          .filter((o) => o.tempOutdoor != null)
          .map((o) => [o.timestamp * 1000, o.tempOutdoor]);
        const dewData = obs
          .filter((o) => o.tempDewpoint != null)
          .map((o) => [o.timestamp * 1000, o.tempDewpoint]);

        chart.setOption({
          backgroundColor: "transparent",
          grid: { top: 8, right: 8, bottom: 24, left: 48, containLabel: false },
          tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
          xAxis: { type: "time", axisLabel: { fontSize: 11 } },
          yAxis: { name: "°C", nameLocation: "end" },
          series: [
            {
              name: "Temperature",
              type: "line",
              smooth: true,
              data: tempData,
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
              areaStyle: { color: "#818cf8", opacity: 0.1 },
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
  }, [from, to]);

  return (
    <div style="position: relative; height: 200px;">
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
      <div ref={divRef} style="width: 100%; height: 200px;" />
    </div>
  );
}