import { defineConfig } from 'vite';

// GitHub Pages serves this project site from https://<user>.github.io/create/
// so production assets must be referenced under the "/create/" base path.
// Override with BASE_PATH if the repo is ever renamed or served elsewhere.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.BASE_PATH ?? '/create/' : '/',
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
