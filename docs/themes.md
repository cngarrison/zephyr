# Creating a Theme

Zephyr's UI uses Tailwind v4 with a small set of CSS custom properties (vars) for colours. Adding a theme means defining a new set of those vars under a CSS class.

---

## CSS variables

All theme-relevant vars are declared in `web/assets/styles.css`.

| Variable | Used for |
|---|---|
| `--color-bg` | Page background |
| `--color-card` | Card / panel background |
| `--color-card-border` | Card border colour |
| `--color-label` | Secondary / label text |
| `--color-nav-bg` | Navigation bar background |
| `--color-nav-text` | Navigation bar text / icon colour |

The built-in themes are defined as:

```css
/* Light (default) */
:root {
  --color-bg:          #f1f5f9;
  --color-card:        #ffffff;
  --color-card-border: #e2e8f0;
  --color-label:       #64748b;
  --color-nav-bg:      #1e293b;
  --color-nav-text:    #94a3b8;
}

/* Dark */
.dark {
  --color-bg:          #0f172a;
  --color-card:        #1e293b;
  --color-card-border: #334155;
  --color-label:       #94a3b8;
  --color-nav-bg:      #020617;
  --color-nav-text:    #64748b;
}
```

---

## Adding a new theme

### 1. Add a CSS class in `web/assets/styles.css`

```css
/* Solarized theme */
.theme-solarized {
  --color-bg:          #fdf6e3;
  --color-card:        #eee8d5;
  --color-card-border: #93a1a1;
  --color-label:       #657b83;
  --color-nav-bg:      #073642;
  --color-nav-text:    #839496;
}
```

Choose a class name with a `theme-` prefix to avoid conflicts.

### 2. Register the theme in `ThemeToggle`

The theme toggle lives in `web/islands/ThemeToggle.tsx`. It cycles through a list of modes stored in `localStorage` under the key `zephyr-theme`.

Current cycle: `light` → `dark` → `system` → `light` …

To add your theme, extend the `MODES` array and the corresponding `applyTheme` logic:

```typescript
// web/islands/ThemeToggle.tsx

const MODES = ["light", "dark", "solarized", "system"] as const;
type Mode = typeof MODES[number];

function applyTheme(mode: Mode) {
  const html = document.documentElement;
  // Remove all known theme classes first
  html.classList.remove("dark", "theme-solarized");

  if (mode === "dark") {
    html.classList.add("dark");
  } else if (mode === "solarized") {
    html.classList.add("theme-solarized");
  } else if (mode === "system") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      html.classList.add("dark");
    }
  }
  // "light" — no class needed (`:root` defaults are light)
}
```

Update the toggle button icon/label for the new mode as well.

### 3. FOUC prevention

The inline script in `web/routes/_app.tsx` applies the saved theme class before the page renders to prevent flash-of-unstyled-content. Update it to handle the new class:

```typescript
// Inside the inline <script> in _app.tsx
const theme = localStorage.getItem('zephyr-theme');
if (theme === 'dark') document.documentElement.classList.add('dark');
else if (theme === 'solarized') document.documentElement.classList.add('theme-solarized');
else if (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.add('dark');
```

---

## Chart colours

Chart colours are compile-time constants used by the ECharts island components. They are **not** driven by CSS vars — ECharts operates on a canvas and cannot read CSS custom properties directly.

To customise chart colours, update the constants in each chart island under `web/islands/charts/`:

| Series | Constant value | Used in |
|---|---|---|
| Temperature | `#38bdf8` | `TemperatureChart`, `TempAggChart` |
| Dew point | `#818cf8` | `TemperatureChart`, `TempAggChart` |
| Pressure | `#34d399` | `PressureChart`, `PressureAggChart` |
| Rain | `#60a5fa` | `RainChart`, `RainAggChart` |
| Wind speed | `#fb923c` | `WindChart`, `WindAggChart` |
| Wind gust | `#f87171` | `WindChart`, `WindAggChart` |
| Humidity | `#a78bfa` | `HumidityChart`, `HumidityAggChart` |
| UV index | `#facc15` | `UVChart`, `UVAggChart` |

If you need chart colours to follow your theme, one pattern is to read a CSS var at island init time via `getComputedStyle(document.documentElement).getPropertyValue('--my-chart-temp')`.
