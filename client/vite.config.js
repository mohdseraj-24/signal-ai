import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Local dev: /api calls backend (port 8000) par jaati hain
  server: { host: "localhost", proxy: { "/api": "http://localhost:8000" } }
});
