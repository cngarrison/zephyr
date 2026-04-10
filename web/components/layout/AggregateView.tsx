import { Head } from 'fresh/runtime';
import Header from '@/components/layout/Header.tsx';
import NavTabs from '@/components/layout/NavTabs.tsx';
import AggregateChartsGrid from '@/components/conditions/AggregateChartsGrid.tsx';
import type { AlmanacData } from '@/lib/types.ts';

interface Props {
  stationName: string;
  serverTime: string;
  timezone?: string;
  pathname: string;
  from: string;
  to: string;
  bucket: 'hour' | 'day';
  title: string;
  almanac?: AlmanacData | null;
}

export default function AggregateView(
  { stationName, serverTime, timezone, pathname, from, to, bucket, title, almanac }: Props,
) {
  return (
    <>
      <Head>
        <title>{stationName} — {title} — Zephyr Weather</title>
      </Head>
      <Header stationName={stationName} serverTime={serverTime} timezone={timezone} almanac={almanac} />
      <NavTabs current={pathname} />
      <main class="max-w-5xl mx-auto px-4 py-8">
        <h2
          class="text-xl font-semibold mb-4"
          style="color: var(--color-text);"
        >
          {title}
        </h2>
        <AggregateChartsGrid from={from} to={to} bucket={bucket} />
      </main>
    </>
  );
}
