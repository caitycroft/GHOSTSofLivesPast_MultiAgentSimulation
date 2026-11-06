import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset paths, so the build runs from any folder or host
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1600 },
})
