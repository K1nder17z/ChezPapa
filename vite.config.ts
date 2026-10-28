import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function commandesApi(): Plugin {
  return {
    name: 'commandes-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.envDir, '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) {
          next()
          return
        }
        server
          .ssrLoadModule('/src/server/nodeAdapter.ts')
          .then((mod) => (mod as { handleNode: (request: typeof req, response: typeof res) => Promise<void> }).handleNode(req, res))
          .catch(next)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), commandesApi()],
  server: { host: true, port: 5173 },
})
