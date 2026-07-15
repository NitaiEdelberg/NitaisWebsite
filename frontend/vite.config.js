import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths"

// The dev/preview server proxies /api to the backend. Defaults to a local
// backend but can point at any deployment via VITE_PROXY_TARGET, e.g.
//   VITE_PROXY_TARGET=https://nitaiswebsite.onrender.com npm run dev
const target = process.env.VITE_PROXY_TARGET || "http://localhost:5000"

// https://vite.dev/config/
const proxy = {
  "/api": {
    target,
    changeOrigin: true,
    secure: true,
  },
}

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: { proxy },
  preview: { proxy },
})
