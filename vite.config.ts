import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && !env.VITE_DMND_API_BASE?.trim()) {
    throw new Error('VITE_DMND_API_BASE must be explicitly set before building the dashboard.');
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      // Output the static frontend bundle served by nginx in production.
      outDir: 'dist',
      // Generate source maps for debugging
      sourcemap: true,
      // Ensure clean builds
      emptyOutDir: true,
    },
  };
});
