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
        <v-icon color="primary" class="mr-3" size="28"
          >mdi-file-document-outline</v-icon
        >
        <span class="text-h5 font-weight-bold text-grey-darken-4 tracking-tight"
          >Ketentuan Layanan</span
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
          <p class="mb-6 intro-text">
            Selamat datang di
            <strong>Sistem Manajemen Waralaba Priority</strong>. Dengan
            mengakses atau menggunakan aplikasi web kami, Anda dianggap setuju
            untuk mematuhi Ketentuan Layanan ini. Jika Anda tidak setuju, mohon
            jangan gunakan layanan kami.
          </p>

          <section class="mb-6">
            <h3>1. Definisi dan Penggunaan Layanan</h3>
            <p>
              Layanan ini disediakan khusus untuk tujuan manajemen operasional
              ritel, inventaris, dan transaksi waralaba oleh pihak manajemen.
              Anda setuju untuk menggunakan layanan ini hanya untuk tujuan hukum
              yang diizinkan dan sesuai dengan kewenangan operasional cabang
              Anda.
            </p>
          </section>

          <section class="mb-6">
            <h3>2. Akun Pengguna</h3>
            <ul>
              <li>
                Anda bertanggung jawab menjaga kerahasiaan <em>User ID</em> dan
                kata sandi Anda.
              </li>
              <li>
                Admin Cabang berwenang penuh dan bertanggung jawab atas
                pembuatan serta pengaturan hak akses akun staf (seperti Kasir
                atau <em>Sales Counter</em>) di cabangnya.
              </li>
              <li>
                Anda bertanggung jawab penuh atas semua aktivitas transaksi dan
                pendataan yang terjadi di bawah akun Anda.
              </li>
            </ul>
          </section>

          <section class="mb-6">
            <h3>3. Kekayaan Intelektual</h3>
            <p>
              Semua konten, arsitektur basis data, logo, grafis, dan kode sumber
              aplikasi di situs ini adalah milik pengembang dan manajemen pusat,
              serta dilindungi oleh undang-undang hak cipta.
            </p>
          </section>

          <section class="mb-6">
            <h3>4. Batasan Tanggung Jawab</h3>
            <p>
              Sistem ini tidak bertanggung jawab atas kerugian langsung atau
              tidak langsung yang timbul dari kelalaian pengguna (seperti
              pembagian kata sandi kepada pihak yang tidak berwenang), selama
              diizinkan oleh hukum yang berlaku di Indonesia.
            </p>
          </section>

          <section class="mb-6">
            <h3>5. Larangan</h3>
            <p>Pengguna dilarang keras:</p>
            <ul>
              <li>
                Melakukan tindakan yang memanipulasi data transaksi lintas
                cabang.
              </li>
              <li>
                Mencoba melakukan pemindaian jaringan (<em>port scanning</em>)
                atau mengakses gerbang basis data secara langsung dari luar
                antarmuka aplikasi ini.
              </li>
              <li>
                Mengunggah virus, kode berbahaya, atau mencoba meretas
                infrastruktur <em>server</em> layanan.
              </li>
            </ul>
          </section>

          <section class="mb-6">
            <h3>6. Penghentian Layanan</h3>
            <p>
              Kami berhak menangguhkan atau menghentikan akun pengguna maupun
              akses jaringan cabang Anda secara sepihak jika ditemukan indikasi
              pelanggaran ketentuan ini tanpa pemberitahuan sebelumnya demi
              menjaga keamanan sistem pusat.
            </p>
          </section>

          <section class="mb-6">
            <h3>7. Hukum yang Berlaku</h3>
            <p>
              Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum Republik
              Indonesia.
            </p>
          </section>

          <section class="mb-2">
            <h3>8. Perubahan Ketentuan</h3>
            <p>
              Kami berhak mengubah ketentuan layanan ini kapan saja. Penggunaan
              berlanjut atas sistem ini menandakan persetujuan Anda terhadap
              perubahan tersebut.
            </p>
          </section>
        </div>
      </v-card-text>

      <v-card-actions class="pa-5 border-t bg-white">
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          variant="flat"
          class="px-8 rounded-lg text-none font-weight-bold"
          @click="isOpen = false"
        >
          Saya Setuju & Mengerti
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
