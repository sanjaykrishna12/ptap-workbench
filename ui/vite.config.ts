import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the BFF runs on :8000; in AWS the BFF serves the built UI and /api behind CloudFront.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1600 },
});
