import ChartCard from "@/components/conditions/ChartCard.tsx";
import TempAggChart from "@/islands/charts/agg/TempAggChart.tsx";
import PressureAggChart from "@/islands/charts/agg/PressureAggChart.tsx";
import HumidityAggChart from "@/islands/charts/agg/HumidityAggChart.tsx";
import WindAggChart from "@/islands/charts/agg/WindAggChart.tsx";
import RainAggChart from "@/islands/charts/agg/RainAggChart.tsx";
import UVAggChart from "@/islands/charts/agg/UVAggChart.tsx";

interface Props {
  from: string;
  to: string;
  bucket: 'hour' | 'day';
}

export default function AggregateChartsGrid({ from, to, bucket }: Props) {
  return (
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartCard title="Temperature Range">
        <TempAggChart from={from} to={to} bucket={bucket} />
      </ChartCard>
      <ChartCard title="Pressure">
        <PressureAggChart from={from} to={to} bucket={bucket} />
      </ChartCard>
      <ChartCard title="Humidity">
        <HumidityAggChart from={from} to={to} bucket={bucket} />
      </ChartCard>
      <ChartCard title="Wind + Gust">
        <WindAggChart from={from} to={to} bucket={bucket} />
      </ChartCard>
      <ChartCard title="Rain Total">
        <RainAggChart from={from} to={to} bucket={bucket} />
      </ChartCard>
      <ChartCard title="UV Index">
        <UVAggChart from={from} to={to} bucket={bucket} />
      </ChartCard>
    </div>
  );
}
