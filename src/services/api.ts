import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { useAuthStore } from "@/stores/authStore";

// Buat instance Axios dengan tipe yang jelas
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  withCredentials: true,
  validateStatus: function (status) {
    // Anggap sukses jika status 2xx ATAU 304
    return (status >= 200 && status < 300) || status === 304;
  },
});

// Buat Interceptor dengan parameter yang sudah diberi tipe
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Ambil store. Pinia akan menangani inisialisasi jika diperlukan.
    const authStore = useAuthStore();
    const token = authStore.token;

    // Jika token ada, tambahkan ke header
    if (token) {
      // Pastikan headers tidak undefined sebelum diakses
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    // Lakukan sesuatu jika ada error pada request
    return Promise.reject(error);
  },
);

// Versi baru yang lebih "pintar"
// Versi baru yang lebih "pintar"
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const authStore = useAuthStore();

    // Cek error 401 (Unauthorized) ATAU 403 (Forbidden / Cabang Tidak Valid)
    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      // Jika errornya dari cabang tidak valid, beri notifikasi (bisa lewat store atau console)
      if (
        error.response.data?.message?.includes("Informasi cabang tidak valid")
      ) {
        console.error(
          "Sesi ditolak: Konfigurasi Database Cabang tidak valid atau berubah.",
        );
      }

      // Cek apakah URL yang error BUKAN URL validasi PIN
      if (!error.config.url.includes("/auth-pin/validate")) {
        // Jika BUKAN dari validasi PIN, baru anggap sesi habis
        authStore.isSessionExpired = true;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
