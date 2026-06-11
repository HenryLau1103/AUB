import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [normalizeDaybrushPureAnnotations(), react()],
  resolve: {
    alias: {
      '@aub/schema': resolve(__dirname, '../../schema'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-moveable') || id.includes('react-selecto') || id.includes('@daybrush')) {
            return 'canvas-tools';
          }
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});

function normalizeDaybrushPureAnnotations() {
  return {
    name: 'normalize-daybrush-pure-annotations',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.includes('@daybrush/utils/dist/utils.esm.js')) return null;
      return code.replaceAll('= /*#__PURE__*/function', '= function');
    },
  };
}
