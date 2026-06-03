import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@aub/schema': resolve(__dirname, '../../schema'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
