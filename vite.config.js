import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["sb-1t6egnq6en39.vercel.run"],
  },
})
