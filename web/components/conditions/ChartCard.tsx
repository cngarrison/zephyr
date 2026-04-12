import type { ComponentChildren } from 'preact';

interface ChartCardProps {
  title: string;
  children: ComponentChildren;
}

export default function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div class='card rounded-xl p-4' style='border: 1px solid var(--color-border);'>
      <h3
        class='text-sm font-semibold mb-3 uppercase tracking-wide'
        style='color: var(--color-label);'
      >
        {title}
      </h3>
      {children}
    </div>
  );
}
