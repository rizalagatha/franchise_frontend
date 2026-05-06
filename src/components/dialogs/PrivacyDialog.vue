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
        <v-icon color="orange-darken-4" class="mr-3" size="28"
          >mdi-shield-check-outline</v-icon
        >
        <span class="text-h6 font-weight-bold text-grey-darken-3"
          >Kebijakan Privasi & Keamanan</span
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
            1. Pemisahan Data Cabang yang Ketat
          </h3>
          <p class="mb-5">
            Kami sangat menghargai kerahasiaan bisnis Anda. Sistem kami
            dirancang secara khusus agar seluruh data transaksi, pelanggan, dan
            inventaris di cabang Anda tersimpan di ruang lingkup yang terpisah.
            Staf dari cabang lain tidak akan bisa melihat atau mengakses data
            operasional Anda.
          </p>

          <h3 class="text-subtitle-1 font-weight-bold text-black mb-2">
            2. Keamanan Jaringan dan Server
          </h3>
          <p class="mb-5">
            Data Anda dilindungi oleh sistem keamanan dan *firewall* berlapis.
            Kami menutup akses publik secara langsung ke tempat penyimpanan data
            untuk memastikan tidak ada pihak luar atau ancaman siber yang dapat
            menyentuh atau mencuri data bisnis Anda.
          </p>

          <h3 class="text-subtitle-1 font-weight-bold text-black mb-2">
            3. Perlindungan Kata Sandi (Enkripsi)
          </h3>
          <p class="mb-5">
            Kata sandi Anda dikonversi ke dalam kode acak (dienkripsi) dengan
            standar keamanan industri terkini secara otomatis. Tim teknis maupun
            administrator kami sekalipun tidak dapat melihat kata sandi asli
            Anda, sehingga akun Anda dipastikan aman dari penyalahgunaan.
          </p>

          <h3 class="text-subtitle-1 font-weight-bold text-black mb-2">
            4. Sesi Akses yang Terlindungi
          </h3>
          <p class="mb-2">
            Saat Anda masuk ke dalam aplikasi, sistem akan membuat "tiket aman"
            (Token) unik untuk perangkat Anda. Tiket ini memastikan bahwa setiap
            tindakan yang Anda lakukan dalam aplikasi telah tervalidasi
            kebenarannya dan menjauhkan Anda dari risiko pembajakan sesi.
          </p>
        </div>
      </v-card-text>

      <v-card-actions class="pa-5 border-t bg-grey-lighten-4">
        <v-spacer></v-spacer>
        <v-btn
          color="orange-darken-4"
          variant="flat"
          class="px-6 rounded-lg text-none font-weight-bold"
          @click="isOpen = false"
        >
          Tutup
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
