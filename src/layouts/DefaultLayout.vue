<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "vue-toastification";
import api from "@/services/api";

import Navbar from "@/components/Navbar.vue";
import ChangePasswordDialog from "@/components/ChangePasswordDialog.vue";
import MandatoryAgreement from "@/components/dialogs/MandatoryAgreement.vue"; // <-- Import Komponen

const authStore = useAuthStore();
const toast = useToast();

// Computed property untuk memunculkan dialog persetujuan
const showMandatoryAgreement = computed(() => {
  // Tampil HANYA jika user sudah login TAPI belum menyetujui terms
  return authStore.isAuthenticated && !authStore.termsAccepted;
});

// Fungsi saat user klik "Saya Setuju & Mengerti" di dialog
const handleAgreement = async () => {
  try {
    // 1. Tembak API untuk update status di database
    await api.post("/users/accept-terms");

    // 2. Update state di Pinia agar kotak otomatis hilang
    authStore.setTermsAccepted();
    toast.success("Terima kasih telah menyetujui Ketentuan Layanan kami.");
  } catch (error) {
    toast.error("Gagal menyimpan persetujuan. Silakan coba lagi.");
  }
};
</script>

<template>
  <div>
    <Navbar v-if="authStore.isAuthenticated" />

    <v-main style="background-color: #f8f9fa">
      <router-view />
    </v-main>

    <!-- Footer dari kode lamamu -->
    <v-footer
      v-if="authStore.isAuthenticated"
      app
      class="pa-2"
      style="font-size: 12px; border-top: 1px solid #e0e0e0"
    >
      <div class="d-flex align-center">
        <v-icon size="small" class="mr-2">mdi-account-circle-outline</v-icon>
        <strong>{{ authStore.userName }}</strong>
        <span class="mx-2 text-disabled">|</span>
        <span>{{ authStore.userCabangNama }}</span>
      </div>

      <v-spacer></v-spacer>

      <div class="d-flex align-center">
        <div v-if="authStore.isOnline" class="d-flex align-center">
          <v-icon color="success" size="small" class="mr-1">mdi-circle</v-icon>
          <span class="mr-4">Online</span>
        </div>
        <div v-else class="d-flex align-center">
          <v-icon color="error" size="small" class="mr-1"
            >mdi-circle-off-outline</v-icon
          >
          <span class="mr-4 font-weight-bold text-error">Offline</span>
        </div>
        <span class="text-medium-emphasis">© 2026 IT Kencana</span>
      </div>
    </v-footer>

    <ChangePasswordDialog v-if="authStore.isAuthenticated" />

    <!-- Dialog Persetujuan Wajib -->
    <MandatoryAgreement
      :model-value="showMandatoryAgreement"
      @agreed="handleAgreement"
    />
  </div>
</template>
