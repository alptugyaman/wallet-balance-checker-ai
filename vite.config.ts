import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/moralis': {
          target: 'https://deep-index.moralis.io/api/v2',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/moralis/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('X-API-Key', env.VITE_MORALIS_API_KEY)
            })
          }
        },
        '/coingecko': {
          target: 'https://api.coingecko.com/api/v3',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/coingecko/, ''),
          headers: {
            'Accept': 'application/json'
          }
        }
      }
    }
  }
})
