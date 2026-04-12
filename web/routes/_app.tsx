// deno-lint-ignore-file react-no-danger
import { define } from '@/utils.ts';

// Runs before any CSS loads — reads localStorage and adds .dark to <html> if needed.
const FOUC_SCRIPT = `(function(){try{var t=localStorage.getItem('zephyr-theme');` +
  `if(t==='dark'||(t==='system'&&globalThis.matchMedia('(prefers-color-scheme:dark)').matches))` +
  `{document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default define.page(function App({ Component }) {
  return (
    <html>
      <head>
        <meta charset='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <title>Zephyr Weather</title>
        <link rel='icon' type='image/x-icon' href='/favicon.ico' />
        <link rel='icon' type='image/png' sizes='32x32' href='/favicon-32.png' />
        <link rel='apple-touch-icon' sizes='180x180' href='/apple-touch-icon.png' />
        <link rel='stylesheet' href='/weather-icons/weather-icons.min.css' />
        <link rel='stylesheet' href='/weather-icons/weather-icons-wind.min.css' />
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body class='min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]'>
        <Component />
      </body>
    </html>
  );
});
