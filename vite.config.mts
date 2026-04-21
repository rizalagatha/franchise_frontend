import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools"; // 👈 Kita perlu ini

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(), // 👈 Tambahkan devtools
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // --- INI BAGIAN PENTING ---
  // Menambahkan proxy server untuk mengarahkan request /api
  server: {
    port: 3000, // Kita tetap pakai port 3000 untuk frontend
    proxy: {
      "/api": {
        // Arahkan ke backend FRANCHISE Anda
        target: "https://priorityapi.kaosanofficial.com",
        changeOrigin: true,
      },
    },
  },
});
