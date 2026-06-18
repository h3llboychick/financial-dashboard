import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseAllowedHosts(value) {
  return String(value || '')
    .split(',')
    .map(host => host.trim())
    .filter(Boolean)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const allowedHosts = parseAllowedHosts(env.VITE_ALLOWED_HOSTS)

  return {
    plugins: [react()],
    server: {
      ...(allowedHosts.length > 0 ? { allowedHosts } : {}),
      proxy: {
        '/api': 'http://localhost:3001',
      },
    },
  }
})
