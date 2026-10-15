import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the built app work from any GitHub Pages address.
export default defineConfig({
  plugins: [react()],
  base: './',
});
