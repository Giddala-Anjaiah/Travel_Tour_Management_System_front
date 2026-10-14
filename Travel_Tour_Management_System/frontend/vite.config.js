import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    // Code-split to reduce unused JS and break render-blocking chains
    rollupOptions: {
      output: {
        // Split heavy third-party libs into separate chunks so they're
        // only loaded when actually needed (e.g. html2canvas for invoice download)
        manualChunks(id) {
          if (id.includes('html2canvas')) return 'html2canvas'
          if (id.includes('purify-html') || id.includes('dompurify')) return 'purify'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router') || id.includes('node_modules/lucide-react')) {
            return 'vendor'
          }
        },
      },
    },
    // Inline small CSS/JS assets (< 4 KiB) to avoid render-blocking requests
    assetsInlineLimit: 4096,
    // Use modern esbuild target for smaller, faster JS
    target: 'es2020',
    // Enable CSS code splitting so unused CSS isn't shipped
    cssCodeSplit: true,
    // Use rolldown's built-in minifier (esbuild no longer bundled in Vite 8)
    minify: 'oxc',
    // Report chunk sizes to catch regressions
    chunkSizeWarningLimit: 500,
  },
  // Preload CSS/JS to break critical request chains
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react'],
  },
  server: {
    host: true,
  },
})