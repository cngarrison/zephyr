import { page } from 'fresh';
import { define } from '@/utils.ts';
import { fetchAlmanac, fetchStationConfig } from '@/lib/api.ts';
import type { AlmanacData } from '@/lib/types.ts';
import AggregateView from '@/components/layout/AggregateView.tsx';

interface PageData {
  stationName: string;
  serverTime: string;
  timezone: string;
  from: string;
  to: string;
  bucket: 'hour';
  pathname: string;
  almanac: AlmanacData | null;
}

export const handler = define.handlers<PageData>({
  async GET() {
    const station = await fetchStationConfig();
    const tz = station.timezone;

    const todayStart = Temporal.Now.plainDateISO(tz).toZonedDateTime(tz);
    const to = todayStart.add({ days: 1 }).toInstant().toString();
    const from = todayStart.subtract({ days: 7 }).toInstant().toString();

    const almanac = await fetchAlmanac();

    return page({
      stationName: station.name,
      serverTime: Temporal.Now.instant().toString(),
      timezone: tz,
      from,
      to,
      bucket: 'hour',
      pathname: '/week',
      almanac,
    });
  },
});

export default define.page(function WeekPage({ data }: { data: PageData }) {
  return <AggregateView {...data} title='Past 7 Days' initialTime={data.serverTime} />;
});
