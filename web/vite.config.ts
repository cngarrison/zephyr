import { defineConfig } from 'vite';
import { fresh } from '@fresh/plugin-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [fresh(), tailwindcss()],
  server: {
    port: 9081,
    fs: {
      // Deno stores npm packages at the workspace root (node_modules/.deno),
      // one level above web/. Vite's default allow list only covers web/ and
      // its own client dist, so we extend it to the workspace root.
      allow: ['..'],
    },
  },
});
