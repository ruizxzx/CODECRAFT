import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const version = readFileSync(path.resolve(__dirname, 'VERSION.md'), 'utf8').match(/V\d+(?:\.\d+)?/)?.[0] ?? 'unknown';
  return {
    plugins: [react(), tailwindcss()],
    root: path.resolve(__dirname, 'src'),
    publicDir: path.resolve(__dirname, 'public'),
    define: {
      __OFFSCRPT_VERSION__: JSON.stringify(version),
      __OFFSCRPT_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      // Vite's root is src/, but Vercel serves the repository-root dist/.
      // Keep the active source root while emitting the production bundle
      // exactly where vercel.json expects it.
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
