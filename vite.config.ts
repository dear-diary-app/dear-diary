import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { diaryPwa } from './pwa-build';

export default defineConfig({
  base: '/dear-diary/',
  plugins: [react(), diaryPwa()],
});
