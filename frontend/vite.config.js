import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In dev, /api/* → http://localhost:8000/api/*
      // So the frontend never needs CORS headers in development
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
