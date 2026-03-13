<script setup lang="ts">
import { ref } from "vue";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "vue-toastification";
import { useRouter } from "vue-router";
import { AxiosError } from "axios";
import logoUrl from "@/assets/logo.png";
// Import gambar lokal agar diproses Vite
import bgImage from "@/assets/login-bg.jpg";

const toast = useToast();
const router = useRouter();
const authStore = useAuthStore();

const kodeUser = ref("");
const password = ref("");
const isLoading = ref(false);
const showPassword = ref(false);
const rememberMe = ref(false);

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
            Welcome<br />Back
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
            <v-avatar size="72" color="white" class="elevation-5 mb-3"
              ><v-img :src="logoUrl"
            /></v-avatar>
            <h2 class="font-weight-bold">Franchise System</h2>
          </div>

          <h2 class="text-h3 font-weight-bold mb-10 d-none d-md-block">
            Sign in
          </h2>

          <v-form @submit.prevent="handleLogin">
            <div class="input-group mb-5">
              <label
                class="text-caption font-weight-black text-uppercase mb-2 d-block tracking-widest"
                >User ID</label
              >
              <v-text-field
                v-model="kodeUser"
                placeholder="Masukkan kode user"
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
                >Password</label
              >
              <v-text-field
                v-model="password"
                placeholder="Masukkan password"
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
                label="Remember Me"
                hide-details
                density="compact"
                color="white"
                class="remember-me-checkbox"
              ></v-checkbox>
              <a
                href="#"
                class="text-caption text-white text-decoration-none border-b"
                >Lost your password?</a
              >
            </div>

            <v-btn
              type="submit"
              color="orange-darken-4"
              block
              height="54"
              class="font-weight-black text-white elevation-8 mb-8"
              :loading="isLoading"
            >
              SIGN IN NOW
            </v-btn>

            <p class="text-caption text-center text-white-opacity">
              By clicking on "Sign in now" you agree to<br />
              <a href="#" class="text-white font-weight-bold"
                >Terms of Service</a
              >
              |
              <a href="#" class="text-white font-weight-bold">Privacy Policy</a>
            </p>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
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
