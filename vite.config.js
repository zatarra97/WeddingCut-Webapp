import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import flowbiteReact from "flowbite-react/plugin/vite";
import { readFileSync } from 'fs'

// Leggi la versione dal package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), flowbiteReact()],
  build: {
    outDir: 'build'
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  }
})