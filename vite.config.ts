import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'

import { cloudflare } from '@cloudflare/vite-plugin'
import pkg from './package.json' with { type: 'json' }

function getGitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Keep watching for cache invalidation, but never push updates to play tabs.
  server: mode === 'play' ? { hmr: false, ws: false } : undefined,
  plugins: [
    react(),
    ...(process.env.CLOUDFLARE_ENV ? [cloudflare()] : []),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__: JSON.stringify(getGitCommit()),
    __DEPLOY_ENV__: JSON.stringify(process.env.DEPLOY_ENV || 'LOCAL'),
  },
}))
