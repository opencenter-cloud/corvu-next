import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { pilot } from 'vite-plugin-pilot'

export default defineConfig({
  plugins: [solid(), pilot({ locale: 'en' })],
  server: {
    port: 5173,
  },
})
