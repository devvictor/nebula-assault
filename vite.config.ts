import { defineConfig } from 'vite'

// base MUST stay relative: an absolute base is the #1 cause of a black screen
// inside the Capacitor WebView (assets 404). See
// .claude/skills/web-to-mobile-game/references/capacitor-port.md
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  server: {
    host: true, // so a phone on the same network can load the dev server
  },
})
