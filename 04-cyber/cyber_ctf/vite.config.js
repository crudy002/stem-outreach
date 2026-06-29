import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true makes Vite listen on all network interfaces, so you can open
// the dashboard from a laptop/phone on the same WiFi at http://<pi-ip>:5173
// instead of only on the Pi itself.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
})
