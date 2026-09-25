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
        name: 'AaharSetu — Real-Time Food Rescue',
        short_name: 'AaharSetu',
        description: 'AaharSetu turns unsold food into a shelter\'s next meal before it hits the dumpster. Real-time safety countdowns, smart matching, and verified dispatch.',
        theme_color: '#173e2c',
        background_color: '#173e2c',
        display: 'standalone',
        display_override: ['standalone', 'window-controls-overlay'],
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        id: '/',
        categories: ['food', 'productivity', 'utilities'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Post Food Donation',
            short_name: 'Donate',
            description: 'Post surplus food for immediate rescue',
            url: '/#post-donation',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Driver Dispatch',
            short_name: 'Deliver',
            description: 'Volunteer courier rescue missions',
            url: '/#dispatch',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ['/push-worker.js'],
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/frames/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3500000,
      },
      devOptions: {
        enabled: false,
      },
    })],
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    optimizeDeps: {
      include: ['maplibre-gl', 'react-map-gl/maplibre', 'recharts'],
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
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('maplibre-gl') || id.includes('react-map-gl')) {
                return 'vendor-maplibre'
              }
              if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
                return 'vendor-charts'
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide'
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase'
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('swr')) {
                return 'vendor-react'
              }
              return 'vendor-common'
            }
          },
        },
      },
    },
  }
})
