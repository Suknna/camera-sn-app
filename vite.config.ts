/// <reference types="vitest/config" />
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'
import fs from 'node:fs'
import { configDefaults } from 'vitest/config'

function appIndexHtmlPlugin(): Plugin {
  return {
    name: 'camera-sn-app-index-html',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!shouldServeAppHtml(req)) {
          next()
          return
        }

        try {
          const htmlPath = path.resolve(__dirname, 'index.app.html')
          const template = fs.readFileSync(htmlPath, 'utf-8')
          const html = await server.transformIndexHtml(req.url ?? '/', template)

          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(req.method === 'HEAD' ? undefined : html)
        } catch (error) {
          if (error instanceof Error) server.ssrFixStacktrace(error)
          next(error)
        }
      })
    },
    generateBundle(_, bundle) {
      const htmlAsset = bundle['index.app.html']
      if (htmlAsset?.type !== 'asset') return
      delete bundle['index.app.html']
      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: htmlAsset.source,
      })
    },
  }
}

function shouldServeAppHtml(req: {
  headers: { accept?: string | string[] }
  method?: string
  url?: string
}) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  if (!acceptsHtml(req.headers.accept)) return false

  const pathName = req.url?.split('?', 1)[0]
  if (!pathName) return false
  if (pathName.startsWith('/api/')) return false
  if (pathName.startsWith('/@') || pathName.startsWith('/src/')) return false

  return !path.extname(pathName)
}

function acceptsHtml(acceptHeader: string | string[] | undefined) {
  if (acceptHeader === undefined) return false
  const accept = Array.isArray(acceptHeader)
    ? acceptHeader.join(',')
    : acceptHeader
  return accept.includes('text/html') || accept.includes('*/*')
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_TARGET': JSON.stringify('app'),
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
      disableLogging: false,
    }),
    react(),
    tailwindcss(),
    appIndexHtmlPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@app': path.resolve(__dirname, './src/app'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.app.html'),
    },
  },
  optimizeDeps: {
    include: [
      '@capacitor/filesystem',
      '@capacitor/share',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'vitest-browser-react',
      'write-excel-file/browser',
    ],
  },
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    exclude: [...configDefaults.exclude, 'scripts/**/*.test.mjs'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      exclude: [
        'src/shared/components/ui/**',
        'src/app/routes/**',
        'src/app/routeTree.gen.ts',
        'src/test-utils/**',
      ],
    },
  },
})
