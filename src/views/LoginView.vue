<script setup lang="ts">
import { ref } from "vue";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "vue-toastification";
import { useRouter } from "vue-router";
import { AxiosError } from "axios";
import logoUrl from "@/assets/logo.png";
import bgImage from "@/assets/login-bg.jpg";

const toast = useToast();
const router = useRouter();
const authStore = useAuthStore();

const kodeUser = ref("");
const password = ref("");
const isLoading = ref(false);
const showPassword = ref(false);
const rememberMe = ref(false);

// State untuk Dialog ToS dan Privacy Policy
const showToS = ref(false);
const showPrivacy = ref(false);

const handleLogin = async () => {
  if (!kodeUser.value || !password.value) {
    toast.error("User dan Password harus diisi.");
    return;
  }
  isLoading.value = true;
  try {
    const response = await api.post("/auth/login", {
      kodeUser: kodeUser.value,
      password: password.value,
    });

    authStore.setLoginData(response.data);
    toast.success("Login berhasil!");
    router.push("/");
  } catch (err) {
    const error = err as AxiosError<{ message: string }>;
    toast.error(
      error.response?.data?.message || "Terjadi kesalahan saat login.",
    );
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="login-page-wrapper"
    :style="{
      backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${bgImage})`,
    }"
  >
    <v-row no-gutters class="fill-height">
      <v-col
        cols="12"
        md="7"
        lg="8"
        class="d-none d-md-flex flex-column justify-center px-16 text-white"
      >
        <div class="welcome-content">
          <v-avatar size="80" color="white" class="mb-6 elevation-10">
            <v-img :src="logoUrl" alt="Company Logo" />
          </v-avatar>
          <h1 class="welcome-title font-weight-black mb-4">
            Selamat<br />Datang
          </h1>
          <p class="text-h6 mb-8 text-white-opacity">
            Kelola bisnis franchise Anda dengan lebih mudah,<br />
            cepat, dan terintegrasi dalam satu sistem cerdas.
          </p>
          <div class="d-flex social-icons">
            <v-icon size="28" class="mr-6 cursor-pointer hover-scale"
              >mdi-facebook</v-icon
            >
            <v-icon size="28" class="mr-6 cursor-pointer hover-scale"
              >mdi-twitter</v-icon
            >
            <v-icon size="28" class="mr-6 cursor-pointer hover-scale"
              >mdi-instagram</v-icon
            >
            <v-icon size="28" class="cursor-pointer hover-scale"
              >mdi-youtube</v-icon
            >
          </div>
        </div>
      </v-col>

      <v-col
        cols="12"
        md="5"
        lg="4"
        class="d-flex align-center justify-center px-8"
      >
        <v-card
          width="100%"
          max-width="400"
          elevation="0"
          color="transparent"
          class="text-white login-form-card"
        >
          <div class="text-center d-md-none mb-8">
            <v-avatar size="72" color="white" class="elevation-5 mb-3">
              <v-img :src="logoUrl" />
            </v-avatar>
            <h2 class="font-weight-bold">Franchise System</h2>
          </div>

          <h2 class="text-h3 font-weight-bold mb-10 d-none d-md-block">
            Masuk
          </h2>

          <v-form @submit.prevent="handleLogin">
            <div class="input-group mb-5">
              <label
                class="text-caption font-weight-black text-uppercase mb-2 d-block tracking-widest"
              >
                User ID
              </label>
              <v-text-field
                v-model="kodeUser"
                placeholder="Masukkan ID Pengguna"
                variant="solo"
                flat
                density="comfortable"
                class="custom-input-field"
                autofocus
                hide-details
              ></v-text-field>
            </div>

            <div class="input-group mb-2">
              <label
                class="text-caption font-weight-black text-uppercase mb-2 d-block tracking-widest"
              >
                Kata Sandi
              </label>
              <v-text-field
                v-model="password"
                placeholder="Masukkan kata sandi"
                :type="showPassword ? 'text' : 'password'"
                variant="solo"
                flat
                density="comfortable"
                class="custom-input-field"
                hide-details
                @click:append-inner="showPassword = !showPassword"
                :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              ></v-text-field>
            </div>

            <div class="d-flex align-center justify-space-between mb-8">
              <v-checkbox
                v-model="rememberMe"
                label="Ingat Saya"
                hide-details
                density="compact"
                color="white"
                class="remember-me-checkbox"
              ></v-checkbox>
              <a
                href="#"
                class="text-caption text-white text-decoration-none border-b"
              >
                Lupa kata sandi?
              </a>
            </div>

            <v-btn
              type="submit"
              color="orange-darken-4"
              block
              height="54"
              class="font-weight-black text-white elevation-8 mb-8"
              :loading="isLoading"
            >
              MASUK SEKARANG
            </v-btn>

            <p class="text-caption text-center text-white-opacity">
              Dengan klik "Masuk Sekarang", Anda menyetujui<br />
              <a
                href="#"
                @click.prevent="showToS = true"
                class="text-white font-weight-bold"
                >Syarat dan Ketentuan</a
              >
              |
              <a
                href="#"
                @click.prevent="showPrivacy = true"
                class="text-white font-weight-bold"
                >Kebijakan Privasi</a
              >
            </p>
          </v-form>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Syarat dan Ketentuan -->
    <v-dialog v-model="showToS" max-width="700" scrollable>
      <v-card>
        <v-card-title class="bg-primary text-white font-weight-bold py-4">
          Syarat dan Ketentuan Penggunaan Sistem
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text class="pa-6" style="max-height: 60vh">
          <div class="text-body-2 text-justify">
            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              1. Penerimaan Syarat
            </h3>
            <p class="mb-4">
              Dengan mengakses dan menggunakan sistem manajemen waralaba
              (Franchise Management System) ini, Anda selaku Pengguna (baik
              Admin Pusat maupun Admin Cabang) setuju untuk terikat dengan
              Syarat dan Ketentuan ini. Jika Anda tidak setuju, Anda tidak
              diperkenankan menggunakan sistem ini.
            </p>

            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              2. Pengelolaan Akun dan Hak Akses
            </h3>
            <p class="mb-4">
              Admin Cabang diberikan wewenang untuk mengelola pengguna (Master
              User) di lingkungan cabangnya sendiri secara mandiri. Admin Cabang
              bertanggung jawab penuh atas pembuatan, pembatasan hak akses, dan
              aktivitas operasional yang dilakukan oleh staf (Sales Counter,
              Kasir, dll) di bawah naungan cabangnya.
            </p>

            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              3. Keamanan Kredensial
            </h3>
            <p class="mb-4">
              Anda bertanggung jawab penuh untuk menjaga kerahasiaan *User ID*
              dan *Kata Sandi* Anda. Meskipun sistem kami telah mengenkripsi
              kata sandi menggunakan standar keamanan tinggi, segala aktivitas
              transaksi yang terjadi menggunakan akun Anda akan dianggap sebagai
              tindakan sah dari Anda.
            </p>

            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              4. Kepatuhan Infrastruktur dan Jaringan
            </h3>
            <p class="mb-4">
              Sistem ini dirancang dengan arsitektur jaringan internal yang
              tertutup. Pengguna dilarang keras mencoba melakukan *bypass*,
              pemindaian (*scanning*), atau upaya akses langsung ke gerbang
              pangkalan data (*database port*) dari luar aplikasi antarmuka yang
              telah disediakan. Akses manajemen data tingkat lanjut hanya
              diperbolehkan melalui jalur aman (seperti *SSH Tunneling*) yang
              disetujui oleh Pusat.
            </p>

            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              5. Penghentian Akses
            </h3>
            <p>
              Pihak Pusat berhak untuk menangguhkan atau menghentikan hak akses
              cabang atau pengguna tertentu secara sepihak apabila ditemukan
              adanya aktivitas mencurigakan, pelanggaran keamanan, atau
              penyalahgunaan wewenang yang merugikan integritas sistem.
            </p>
          </div>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="flat" @click="showToS = false"
            >Saya Mengerti</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Kebijakan Privasi -->
    <v-dialog v-model="showPrivacy" max-width="700" scrollable>
      <v-card>
        <v-card-title
          class="bg-orange-darken-4 text-white font-weight-bold py-4"
        >
          Kebijakan Privasi dan Keamanan Data
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text class="pa-6" style="max-height: 60vh">
          <div class="text-body-2 text-justify">
            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              1. Isolasi Data Cabang (Multi-Tenant Architecture)
            </h3>
            <p class="mb-4">
              Kami menjunjung tinggi kerahasiaan data bisnis Anda. Sistem ini
              beroperasi menggunakan arsitektur pangkalan data terdistribusi
              (*Dynamic Pooling*). Artinya, seluruh data transaksi, pelanggan,
              dan inventaris masing-masing cabang disimpan secara terpisah dalam
              ruang lingkup database yang diisolasi. Personel dari Cabang A
              tidak akan pernah memiliki kemampuan teknis maupun izin untuk
              mengakses, melihat, atau memanipulasi data operasional dari Cabang
              B.
            </p>

            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              2. Proteksi Infrastruktur Server
            </h3>
            <p class="mb-4">
              Keamanan pangkalan data kami dilindungi oleh lapisan *firewall*
              yang ketat. Pangkalan data dikonfigurasi secara mutlak untuk
              menolak segala bentuk koneksi langsung dari jaringan publik (hanya
              menerima akses dari lalu lintas internal atau *localhost*).
              Langkah ini diterapkan guna memastikan bahwa ancaman eksternal
              seperti serangan otomatis (*scanning bot*) atau intrusi siber
              tidak dapat menyentuh data cabang Anda.
            </p>

            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              3. Enkripsi Kredensial
            </h3>
            <p class="mb-4">
              Data autentikasi pengguna dan hak akses diverifikasi secara
              terpusat. Setiap kata sandi yang Anda buat akan langsung
              dienkripsi menggunakan algoritma *hashing* kriptografis (*Bcrypt*)
              sebelum disimpan. Tim pengembang maupun sistem administrator kami
              tidak dapat melihat atau mendekripsi kata sandi asli Anda.
            </p>

            <h3 class="text-subtitle-1 font-weight-bold mb-2">
              4. Penggunaan Data dan Token Keamanan
            </h3>
            <p class="mb-4">
              Sesi *login* Anda dijamin menggunakan *JSON Web Token* (JWT).
              Token ini memastikan bahwa setiap instruksi yang Anda kirimkan
              (seperti melihat stok atau membuat tagihan) selalu divalidasi dan
              secara otomatis diarahkan ke pangkalan data cabang Anda secara
              presisi, tanpa memerlukan pertukaran kredensial berulang kali.
            </p>
          </div>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer></v-spacer>
          <v-btn
            color="orange-darken-4"
            variant="flat"
            @click="showPrivacy = false"
            >Tutup</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
/* Paksa Full Viewport */
.login-page-wrapper {
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  overflow: hidden;
}

.fill-height {
  height: 100vh !important;
}

/* Typography Kiri */
.welcome-title {
  font-size: 5.5rem !important;
  line-height: 0.95;
  letter-spacing: -3px !important;
  text-shadow: 2px 2px 10px rgba(0, 0, 0, 0.3);
}

.text-white-opacity {
  color: rgba(255, 255, 255, 0.8) !important;
}

/* Custom Input (Putih Bersih) */
.custom-input-field :deep(.v-field) {
  background-color: white !important;
  border-radius: 4px !important;
  color: #222 !important;
  font-weight: 600;
}

.custom-input-field :deep(.v-field__input) {
  padding-top: 12px !important;
  padding-bottom: 12px !important;
}

.tracking-widest {
  letter-spacing: 1.5px !important;
}

/* Checkbox & Helpers */
.remember-me-checkbox :deep(.v-label) {
  font-size: 13px !important;
  opacity: 1 !important;
  color: white !important;
}

.hover-scale:hover {
  transform: scale(1.25);
  transition: all 0.2s ease-in-out;
  color: #ff6d00 !important;
}

/* Animasi Fade In */
.welcome-content,
.login-form-card {
  animation: fadeIn 1s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive: Gambarnya tetep full tapi layout berubah */
@media (max-width: 959px) {
  .login-page-wrapper {
    overflow-y: auto;
  }
}
</style>
