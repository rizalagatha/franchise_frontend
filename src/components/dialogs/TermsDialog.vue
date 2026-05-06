<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(["update:modelValue"]);

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});
</script>

<template>
  <v-dialog v-model="isOpen" max-width="600" scrollable>
    <v-card class="rounded-xl elevation-10">
      <v-card-title class="d-flex align-center pa-5 border-b">
        <v-icon color="primary" class="mr-3" size="28"
          >mdi-file-document-outline</v-icon
        >
        <span class="text-h6 font-weight-bold text-grey-darken-3"
          >Syarat dan Ketentuan</span
        >
        <v-spacer></v-spacer>
        <v-btn
          icon="mdi-close"
          variant="text"
          density="comfortable"
          @click="isOpen = false"
        ></v-btn>
      </v-card-title>

      <v-card-text class="pa-6" style="max-height: 60vh">
        <div class="text-body-2 text-grey-darken-2" style="line-height: 1.7">
          <h3 class="text-subtitle-1 font-weight-bold text-black mb-2 mt-2">
            1. Penerimaan Syarat
          </h3>
          <p class="mb-5">
            Dengan mengakses dan menggunakan aplikasi Franchise Management
            System ini, Anda menyetujui untuk terikat dengan seluruh syarat dan
            ketentuan yang berlaku. Jika Anda tidak setuju, harap tidak
            menggunakan layanan ini.
          </p>

          <h3 class="text-subtitle-1 font-weight-bold text-black mb-2">
            2. Pengelolaan Akun Cabang
          </h3>
          <p class="mb-5">
            Admin Cabang bertanggung jawab penuh atas pengelolaan akun staf di
            bawah naungannya (seperti Kasir atau Sales Counter), termasuk
            pemberian dan pencabutan hak akses sesuai kebijakan masing-masing
            cabang.
          </p>

          <h3 class="text-subtitle-1 font-weight-bold text-black mb-2">
            3. Keamanan Akun Anda
          </h3>
          <p class="mb-5">
            Anda wajib menjaga kerahasiaan User ID dan Kata Sandi Anda. Segala
            aktivitas transaksi atau perubahan data yang terjadi menggunakan
            akun Anda sepenuhnya menjadi tanggung jawab Anda sebagai pemilik
            akun.
          </p>

          <h3 class="text-subtitle-1 font-weight-bold text-black mb-2">
            4. Penggunaan Sistem yang Wajar
          </h3>
          <p class="mb-5">
            Pengguna dilarang keras melakukan tindakan yang dapat merusak,
            membebani, atau mencoba menembus celah keamanan sistem. Akses ke
            dalam sistem hanya diperbolehkan melalui antarmuka aplikasi resmi
            yang telah disediakan.
          </p>

          <h3 class="text-subtitle-1 font-weight-bold text-black mb-2">
            5. Penghentian Layanan
          </h3>
          <p class="mb-2">
            Pihak Pusat berhak menonaktifkan akun atau menangguhkan akses cabang
            apabila ditemukan aktivitas yang mencurigakan, melanggar ketentuan,
            atau berpotensi membahayakan keamanan data secara keseluruhan.
          </p>
        </div>
      </v-card-text>

      <v-card-actions class="pa-5 border-t bg-grey-lighten-4">
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          variant="flat"
          class="px-6 rounded-lg text-none font-weight-bold"
          @click="isOpen = false"
        >
          Saya Mengerti
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
