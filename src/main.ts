/**
 * main.ts
 *
 * Bootstraps Vue, Vuetify, dan semua plugin secara manual
 * (Sesuai setup 'retail')
 */

// 1. Buat App
import { createApp } from "vue";
import App from "./App.vue";
const app = createApp(App);

// 2. Setup Pinia (Store)
import { createPinia } from "pinia";
const pinia = createPinia();
app.use(pinia);

// 3. Setup Router
import router from "./router";
app.use(router);

// 4. Setup Vuetify (Manual)
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import retailVuetifyConfig from "./plugins/vuetify";
import type { VuetifyOptions } from "vuetify";

const vuetify = createVuetify({
  ...(retailVuetifyConfig as VuetifyOptions),
  components,
  directives,
});
app.use(vuetify);

// 5. Setup Toastification
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";

const toastOptions = {
  // ... (opsi toast Anda) ...
};
app.use(Toast, toastOptions);

// 6. Impor Global CSS
import "./styles/global.css";
import "./styles/desktop-theme.css";

// 7. IMPORT AUTHSTORE (TAMBAHKAN INI)
import { useAuthStore } from "./stores/authStore";

// 8. INISIALISASI AUTH & KONEKTIVITAS (TAMBAHKAN INI)
// Ini harus dipanggil SETELAH 'app.use(pinia)' dan 'app.use(router)'
const authStore = useAuthStore();
authStore.checkAuthStatus(); // Cek status login dari localStorage
authStore.initConnectivityCheck(); // Mulai cek koneksi server

// 9. Mount App (Pindahkan ke paling akhir)
app.mount("#app");
