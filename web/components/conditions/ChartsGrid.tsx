import ChartCard from '@/components/conditions/ChartCard.tsx';
import TemperatureChart from '@/islands/charts/TemperatureChart.tsx';
import PressureChart from '@/islands/charts/PressureChart.tsx';
import HumidityChart from '@/islands/charts/HumidityChart.tsx';
import WindChart from '@/islands/charts/WindChart.tsx';
import RainChart from '@/islands/charts/RainChart.tsx';
import UVChart from '@/islands/charts/UVChart.tsx';

interface Props {
  from: string;
  to: string;
}

export default function ChartsGrid({ from, to }: Props) {
  return (
    <div
      class='grid gap-4'
      style='grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));'
    >
      <ChartCard title='Temperature & Dew Point'>
        <TemperatureChart from={from} to={to} />
      </ChartCard>
      <ChartCard title='Rain Rate'>
        <RainChart from={from} to={to} />
      </ChartCard>
      <ChartCard title='Wind Speed & Gust'>
        <WindChart from={from} to={to} />
      </ChartCard>
      <ChartCard title='Humidity'>
        <HumidityChart from={from} to={to} />
      </ChartCard>
      <ChartCard title='Pressure'>
        <PressureChart from={from} to={to} />
      </ChartCard>
      <ChartCard title='UV Index'>
        <UVChart from={from} to={to} />
      </ChartCard>
    </div>
  );
}
