import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const single = process.env.SINGLE === '1';

export default defineConfig({
  root: r('.'),
  base: './',
  resolve: {
    alias: {
      '@runeboom/core': r('../../packages/core/src/index.ts'),
      '@runeboom/render': r('../../packages/render/src/index.ts')
    }
  },
  plugins: single ? [viteSingleFile()] : [],
  worker: { format: 'es' },
  build: {
    outDir: r(single ? '../../dist-single' : '../../dist'),
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 2000
  },
  server: { host: true }
});
