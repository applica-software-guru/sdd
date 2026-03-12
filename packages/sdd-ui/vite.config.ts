import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    fs: {
      // Allow serving files from any path so the preview panel can load
      // components from the user's project directory via /@fs/<absolute-path>
      allow: ['/'],
    },
  },
});
