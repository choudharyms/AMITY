import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AaharSetu', short_name: 'AaharSetu',
        description: 'AaharSetu: Turn unsold food into a shelter next meal before it hits the dumpster. Food-rescue coordination for Bengaluru.',
        theme_color: '#173e2c', background_color: '#f7f8f5', display: 'standalone',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ['/push-worker.js'],
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/frames/],
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    })],
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    optimizeDeps: {
      include: ['maplibre-gl', 'react-map-gl/maplibre'],
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? ''),
      'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_KEY ?? env.SUPABASE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''),
      'import.meta.env.VITE_AUTH_REDIRECT': JSON.stringify(env.VITE_AUTH_REDIRECT ?? env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? ''),
    },
    server: {
      host: '0.0.0.0', port: 3000,
      allowedHosts: ['.vusercontent.net', '.vercel.run', '.vercel.app', 'localhost'],
      watch: { ignored: ['**/scratch/**', '**/.edge-temp*/**'] },
      proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
    },
  }
})
