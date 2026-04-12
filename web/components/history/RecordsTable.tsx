/** All-time records table grouped by category. */

export interface WeatherRecord {
  label: string;
  value: number | null;
  unit: string;
  /** YYYY-MM-DD or null */
  date: string | null;
}

export interface RecordsGroup {
  heading: string;
  records: WeatherRecord[];
}

export interface RecordsTableProps {
  groups: RecordsGroup[];
  /** Heading for the section, e.g. "This Year Records" */
  title?: string;
}

function fmt(v: number | null, unit: string): string {
  if (v === null) return '—';
  return `${v.toFixed(1)} ${unit}`;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  // YYYY-MM-DD → DD Mon YYYY
  const [year, month, day] = d.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
}

export default function RecordsTable({ groups, title = 'Records' }: RecordsTableProps) {
  return (
    <section class='card p-4'>
      <h3 class='font-semibold text-base mb-3'>{title}</h3>
      <div class='grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3'>
        {groups.map((group) => (
          <div key={group.heading}>
            <h4 class='label-text text-xs font-semibold uppercase tracking-wide mb-1'>
              {group.heading}
            </h4>
            <table class='w-full text-sm border-collapse'>
              <tbody>
                {group.records.map((rec) => (
                  <tr
                    key={rec.label}
                    class='border-b border-[var(--color-card-border)] last:border-0'
                  >
                    <td class='py-1 pr-3 label-text'>{rec.label}</td>
                    <td class='py-1 pr-3 tabular-nums font-medium text-right'>
                      {fmt(rec.value, rec.unit)}
                    </td>
                    <td class='py-1 label-text text-right text-xs'>{fmtDate(rec.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
