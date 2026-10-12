import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Versión de cada publicación. El mostrador la compara con /version.json para
// avisar cuando hay una nueva (el iPad puede tener el menú abierto días).
const VERSION = Date.now().toString(36)

const archivoVersion = () => ({
  name: 'buba-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) })
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), archivoVersion()],
  define: { __VERSION__: JSON.stringify(VERSION) },
})
