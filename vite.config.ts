import { defineConfig } from 'vite';

// Use relative asset paths ("./assets/…") in production. The repo is named
// "Create" (capital C), so the Pages URL is case-sensitive (…/Create/); a
// relative base makes assets resolve correctly regardless of the URL's case
// or path depth. Override with BASE_PATH only if you need an absolute base.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.BASE_PATH ?? './' : '/',
  define: {
    __BUILD__: JSON.stringify(
      new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
    ),
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 4096,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
}));
