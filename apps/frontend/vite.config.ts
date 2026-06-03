import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Ne pas échouer sur les erreurs TypeScript — le type-check est fait séparément
    rollupOptions: {}
  }
})
