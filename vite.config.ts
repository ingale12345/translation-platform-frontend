import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // `import.meta.dirname` rather than `__dirname`: this config is ESM, and Vite's
      // native config loader does not provide the CommonJS globals.
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
