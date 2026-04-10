interface StatBox {
  value: string;
  label?: string;
}

interface ConditionCardProps {
  label: string;
  value: string | number;
  valueSupplemental?: string | number;
  unit?: string;
  trend?: "up" | "down" | "steady";
  meta?: string;
  icon?: string;       // wi icon class for label e.g. "wi-thermometer"
  rightIcon?: string;  // large icon shown on the right (e.g. wind direction arrow)
  topRight?: StatBox;  // stat shown top of right column
  bottomRight?: StatBox; // stat shown bottom of right column
}

const TREND_ICON: Record<string, string> = {
  up: "↑",
  down: "↓",
  steady: "→",
};

export default function ConditionCard(
  { label, value, valueSupplemental, unit, trend, meta, icon, rightIcon, topRight, bottomRight }: ConditionCardProps,
) {
  const hasRight = rightIcon || topRight || bottomRight;

  return (
    <div class="card flex flex-row gap-3">
      {/* Left column: label + value + optional meta */}
      <div class="flex flex-col justify-between flex-1 min-w-0">
        <p class="label-text flex items-center gap-1 whitespace-nowrap">
          {icon && <i class={`wi ${icon} text-lg mr-1`} />}
          {label}
        </p>
        <p class="text-2xl font-semibold" style="color: var(--color-text);">
          {value}
          {unit && <span class="text-base font-normal ml-0.5">{unit}</span>}
          {valueSupplemental && <span class="text-base font-normal ml-3">{valueSupplemental}</span>}
        </p>
        {(trend || meta) && (
          <p class="text-xs" style="color: var(--color-muted);">
            {trend && <span class="mr-1">{TREND_ICON[trend]}</span>}
            {meta}
          </p>
        )}
      </div>

      {/* Right column: large icon OR stacked stat boxes */}
      {hasRight && (
        <div class="flex flex-col items-end justify-between gap-4 shrink-0">
          {rightIcon
            ? (
              <i
                class={`wi ${rightIcon}`}
                style="font-size: 2.5rem; color: var(--color-label); margin: auto 0;"
              />
            )
            : (
              <>
                {topRight && (
                  <div class="text-right">
                    {topRight.label && (
                      <div class="text-[10px] leading-tight" style="color: color-mix(in srgb, var(--color-label) 55%, transparent);">
                        {topRight.label}
                      </div>
                    )}
                    <div class="text-xs font-medium leading-tight" style="color: color-mix(in srgb, var(--color-label) 55%, transparent);">
                      {topRight.value}
                    </div>
                  </div>
                )}
                {bottomRight && (
                  <div class="text-right">
                    {bottomRight.label && (
                      <div class="text-[10px] leading-tight" style="color: color-mix(in srgb, var(--color-label) 55%, transparent);">
                        {bottomRight.label}
                      </div>
                    )}
                    <div class="text-xs font-medium leading-tight" style="color: color-mix(in srgb, var(--color-label) 55%, transparent);">
                      {bottomRight.value}
                    </div>
                  </div>
                )}
              </>
            )}
        </div>
      )}
    </div>
  );
}
