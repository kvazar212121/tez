import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  /** /admin to‘g‘ridan ochilganda ham modullar doim ildizdan (/src/...) yuklansin */
  base: '/',
  appType: 'spa',
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  resolve: {
    alias: {
      '@regions': path.resolve(__dirname, '../shared/regions.json'),
    },
  },
  server: {
    /** Telefon / boshqa qurilmadan bir Wi‑Fi orqali kirish: http://<LAN-IP>:5173 */
    host: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
