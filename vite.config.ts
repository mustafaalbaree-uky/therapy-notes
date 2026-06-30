import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the app from https://<user>.github.io/<repo>/.
// Vite's `base` must therefore match the repository name. Override with
// VITE_BASE at build time if you deploy to a custom domain or repo name.
// Hash-based routing (see src/main.tsx) keeps deep links from 404-ing on Pages.
export default defineConfig(() => ({
  base: process.env.VITE_BASE ?? '/therapy-notes/',
  plugins: [react()],
}))
