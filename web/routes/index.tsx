import { page } from 'fresh';
import { Head } from 'fresh/runtime';
import { define } from '@/utils.ts';
import { fetchAlmanac, fetchLatest, fetchStationConfig } from '@/lib/api.ts';
import type { AlmanacData, Observation, StationConfig } from '@/lib/types.ts';
import Header from '@/islands/Header.tsx';
import NavTabs from '@/components/layout/NavTabs.tsx';
import CurrentConditions from '@/islands/CurrentConditions.tsx';
import ChartsGrid from '@/components/conditions/ChartsGrid.tsx';

interface PageData {
  station: StationConfig;
  latestObs: Observation | null;
  url: string;
  from: string;
  to: string;
  almanac: AlmanacData | null;
}

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const [station, latestObs, almanac] = await Promise.all([
      fetchStationConfig(),
      fetchLatest(),
      fetchAlmanac(),
    ]);
    const to = new Date().toISOString();
    const from = new Date(Date.now() - 86400000).toISOString();
    return page({ station, latestObs, url: ctx.req.url, from, to, almanac });
  },
});

export default define.page(function Home({ data }: { data: PageData }) {
  const { station, latestObs, url, from, to, almanac } = data ?? {
    station: { name: 'Zephyr Weather', lat: 0, lon: 0, altitude: 0, timezone: 'UTC', extras: [] },
    latestObs: null,
    url: '/',
    from: new Date(Date.now() - 86400000).toISOString(),
    to: new Date().toISOString(),
    almanac: null,
  };
  const pathname = new URL(url).pathname;

  return (
    <>
      <Head>
        <title>{station.name} — Zephyr Weather</title>
      </Head>
      <Header
        stationName={station.name}
        initialTime={new Date().toISOString()}
        timezone={station.timezone}
        almanac={almanac}
      />
      <NavTabs current={pathname} />
      <main class='max-w-5xl mx-auto px-4 py-8'>
        <CurrentConditions initial={latestObs} />
        <section class='mt-10'>
          <h2
            class='text-xl font-semibold mb-4'
            style='color: var(--color-text);'
          >
            Last 24 Hours
          </h2>
          <ChartsGrid from={from} to={to} />
        </section>
      </main>
    </>
  );
});
