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
    const tz = station.timezone; // IANA tz string, e.g. 'Australia/Brisbane'

    // Use Temporal to get exact local-midnight boundaries for yesterday.
    const today = Temporal.Now.plainDateISO(tz);
    const yesterday = today.subtract({ days: 1 });

    const from = yesterday.toZonedDateTime(tz).toInstant().toString();
    const to = today.toZonedDateTime(tz).toInstant().toString();

    const almanac = await fetchAlmanac(yesterday.toString());

    return page({
      stationName: station.name,
      serverTime: Temporal.Now.instant().toString(),
      timezone: tz,
      from,
      to,
      bucket: 'hour',
      pathname: '/yesterday',
      almanac,
    });
  },
});

export default define.page(function YesterdayPage({ data }: { data: PageData }) {
  return <AggregateView {...data} title='Yesterday' />;
});
