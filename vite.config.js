import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/SA_SlopeDeflectionMethod/',   // ← 加這行
  plugins: [react()],
})
