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
  <v-dialog v-model="isOpen" max-width="750" scrollable>
    <v-card class="rounded-xl elevation-10 legal-dialog">
      <v-card-title class="d-flex align-center pa-5 border-b bg-white">
        <v-icon color="orange-darken-4" class="mr-3" size="28"
          >mdi-shield-check-outline</v-icon
        >
        <span class="text-h5 font-weight-bold text-grey-darken-4 tracking-tight"
          >Kebijakan Privasi</span
        >
        <v-spacer></v-spacer>
        <v-btn
          icon="mdi-close"
          variant="text"
          density="comfortable"
          @click="isOpen = false"
        ></v-btn>
      </v-card-title>

      <v-card-text class="pa-8 bg-grey-lighten-5" style="max-height: 65vh">
        <div class="legal-content">
          <p class="mb-6 intro-text text-subtitle-2 text-grey-darken-1">
            Terakhir diubah: <strong>Januari 2026</strong>
          </p>

          <p class="mb-6 intro-text">
            <strong>Sistem Manajemen Waralaba Priority</strong> ("kami", "milik
            kami", atau "kita") berkomitmen untuk melindungi privasi data
            operasional cabang dan kredensial pengguna ("pengguna" atau "Anda").
            Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan,
            menggunakan, mengungkapkan, dan melindungi informasi Anda saat
            menggunakan aplikasi kami.
          </p>

          <section class="mb-6">
            <h3>1. Informasi yang Kami Kumpulkan</h3>
            <p>
              Kami dapat mengumpulkan data yang Anda berikan langsung ke dalam
              sistem atau terekam secara otomatis, seperti:
            </p>
            <ul>
              <li>
                <em>User ID</em>, peran (hak akses), dan data identitas cabang
                saat Admin mendaftarkan Anda.
              </li>
              <li>
                Informasi transaksi ritel, pergerakan inventaris barang, dan
                data pelanggan operasional cabang.
              </li>
              <li>
                Data aktivitas sesi (Token JWT), alamat IP, dan riwayat tindakan
                pengguna untuk keperluan audit keamanan jaringan.
              </li>
            </ul>
          </section>

          <section class="mb-6">
            <h3>2. Penggunaan Informasi</h3>
            <p>Kami menggunakan informasi yang dikumpulkan untuk:</p>
            <ul>
              <li>
                Menyediakan dan memastikan kelancaran operasional layanan ritel
                di cabang Anda.
              </li>
              <li>
                Memproses transaksi kasir dan mengirimkan rekapitulasi data
                secara <em>real-time</em> (<em>Dynamic Pooling</em>).
              </li>
              <li>
                Memverifikasi identitas pengguna untuk mengamankan isolasi data
                antar cabang (<em>Multi-Tenant Architecture</em>).
              </li>
            </ul>
          </section>

          <section class="mb-6">
            <h3>3. Berbagi Informasi dengan Pihak Ketiga</h3>
            <p>
              Kami sangat menjaga kerahasiaan data bisnis Anda dan
              <strong>tidak menjual</strong> data tersebut. Kami hanya
              membagikan data kepada pihak ketiga dalam hal:
            </p>
            <ul>
              <li>
                Kepatuhan terhadap hukum, audit internal perusahaan, atau
                permintaan otoritas pemerintah yang diwajibkan secara legal.
              </li>
            </ul>
          </section>

          <section class="mb-6">
            <h3>4. Keamanan Data</h3>
            <p>
              Kami menerapkan langkah-langkah keamanan teknis tingkat tinggi,
              termasuk enkripsi kata sandi secara satu arah (<em>Hashing</em>),
              pembatasan akses basis data (hanya dari jaringan lokal/<em
                >localhost</em
              >
              server), dan perlindungan <em>firewall</em> untuk melindungi data
              Anda dari intrusi tidak sah. Namun, perlu diingat bahwa tidak ada
              metode transmisi internet yang 100% aman.
            </p>
          </section>

          <section class="mb-6">
            <h3>5. Hak-Hak Pengguna</h3>
            <p>
              Sesuai dengan regulasi perlindungan data, Anda melalui Admin
              Cabang berhak untuk:
            </p>
            <ul>
              <li>
                Mengakses data transaksi operasional yang tersimpan di ruang
                lingkup cabang Anda.
              </li>
              <li>
                Memperbarui atau memperbaiki informasi akun pengguna yang tidak
                akurat.
              </li>
              <li>
                Meminta penonaktifan atau pembatasan akses hak guna aplikasi
                pada pengguna tertentu.
              </li>
            </ul>
          </section>

          <section class="mb-6">
            <h3>6. Perubahan Kebijakan Privasi</h3>
            <p>
              Kami dapat memperbarui kebijakan privasi ini sewaktu-waktu seiring
              dengan peningkatan fitur keamanan dan migrasi sistem. Perubahan
              akan diinformasikan secara langsung melalui pembaruan di halaman
              ini.
            </p>
          </section>

          <section class="mb-2">
            <h3>7. Kontak Kami</h3>
            <p>
              Jika Anda memiliki pertanyaan mengenai privasi data atau menemukan
              indikasi celah keamanan, hubungi administrator pusat infrastruktur
              kami segera.
            </p>
          </section>
        </div>
      </v-card-text>

      <v-card-actions class="pa-5 border-t bg-white">
        <v-spacer></v-spacer>
        <v-btn
          color="orange-darken-4"
          variant="flat"
          class="px-8 rounded-lg text-none font-weight-bold"
          @click="isOpen = false"
        >
          Tutup Kebijakan
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.legal-dialog {
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Oxygen,
    Ubuntu,
    Cantarell,
    sans-serif;
}

.tracking-tight {
  letter-spacing: -0.5px !important;
}

.legal-content {
  color: #374151; /* text-gray-700 */
  line-height: 1.6;
  font-size: 14px;
}

.intro-text {
  font-size: 15px;
  color: #111827;
}

.legal-content h3 {
  color: #111827; /* text-gray-900 */
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}

.legal-content p {
  margin-bottom: 0;
  text-align: justify;
}

.legal-content ul {
  padding-left: 20px;
  margin-top: 8px;
}

.legal-content li {
  margin-bottom: 6px;
  text-align: justify;
}
</style>
