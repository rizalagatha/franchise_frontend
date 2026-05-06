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
  <v-dialog v-model="isOpen" max-width="780" scrollable>
    <v-card class="rounded-xl elevation-12 legal-dialog">
      <!-- Header -->
      <v-card-title
        class="d-flex align-center pa-6 border-b bg-white header-area"
      >
        <div class="d-flex align-center gap-3">
          <div class="icon-badge">
            <v-icon color="white" size="18">mdi-file-document-outline</v-icon>
          </div>
          <div>
            <div class="dialog-title">Terms of Service</div>
            <div class="dialog-subtitle">Ketentuan Layanan</div>
          </div>
        </div>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          density="comfortable"
          @click="isOpen = false"
        />
      </v-card-title>

      <!-- Body -->
      <v-card-text class="pa-0 bg-white" style="max-height: 68vh">
        <div class="legal-body">
          <!-- Intro bilingual -->
          <div class="intro-block">
            <p class="en-text">
              Welcome to <strong>Priority Franchise Management System</strong>.
              By accessing or using our web application, you are deemed to have
              read and agreed to comply with these Terms of Service. If you do
              not agree with any part of these terms, please refrain from using
              our system.
            </p>
            <p class="id-text">
              Selamat datang di
              <strong>Sistem Manajemen Waralaba Priority</strong>. Dengan
              mengakses atau menggunakan aplikasi web ini, Anda dianggap telah
              membaca dan menyetujui Ketentuan Layanan berikut. Apabila Anda
              tidak menyetujui ketentuan ini, mohon hentikan penggunaan sistem
              kami.
            </p>
          </div>

          <!-- Section 1 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">1.</span>
              <div>
                <div class="section-title-en">DEFINITIONS AND SERVICE USE</div>
                <div class="section-title-id">
                  Definisi dan Penggunaan Layanan
                </div>
              </div>
            </div>
            <p class="section-body">
              Layanan ini disediakan khusus untuk keperluan manajemen
              operasional ritel, inventaris, dan transaksi waralaba oleh pihak
              manajemen yang berwenang. Pengguna wajib menggunakan layanan ini
              hanya untuk tujuan yang sah dan sesuai dengan kewenangan
              operasional cabang masing-masing.
            </p>
          </div>

          <!-- Section 2 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">2.</span>
              <div>
                <div class="section-title-en">USER ACCOUNTS</div>
                <div class="section-title-id">Akun Pengguna</div>
              </div>
            </div>
            <ul class="legal-list">
              <li>
                Setiap pengguna bertanggung jawab menjaga kerahasiaan
                <em>User ID</em> dan kata sandi masing-masing.
              </li>
              <li>
                Admin Cabang berwenang penuh serta bertanggung jawab atas
                pembuatan dan pengaturan hak akses akun staf (seperti Kasir atau
                <em>Sales Counter</em>) di cabangnya.
              </li>
              <li>
                Setiap pengguna bertanggung jawab penuh atas seluruh aktivitas
                transaksi dan pendataan yang terjadi di bawah akunnya.
              </li>
            </ul>
          </div>

          <!-- Section 3 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">3.</span>
              <div>
                <div class="section-title-en">INTELLECTUAL PROPERTY</div>
                <div class="section-title-id">Kekayaan Intelektual</div>
              </div>
            </div>
            <p class="section-body">
              Seluruh konten, arsitektur basis data, logo, grafis, dan kode
              sumber aplikasi ini merupakan milik pengembang dan manajemen
              pusat, serta dilindungi oleh ketentuan hak cipta yang berlaku.
            </p>
          </div>

          <!-- Section 4 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">4.</span>
              <div>
                <div class="section-title-en">LIMITATION OF LIABILITY</div>
                <div class="section-title-id">Batasan Tanggung Jawab</div>
              </div>
            </div>
            <p class="section-body">
              Sistem ini tidak bertanggung jawab atas kerugian langsung maupun
              tidak langsung yang timbul akibat kelalaian pengguna, seperti
              membagikan kata sandi kepada pihak yang tidak berwenang, selama
              diizinkan oleh hukum yang berlaku di Republik Indonesia.
            </p>
          </div>

          <!-- Section 5 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">5.</span>
              <div>
                <div class="section-title-en">PROHIBITED CONDUCT</div>
                <div class="section-title-id">Larangan Penggunaan</div>
              </div>
            </div>
            <p class="section-body">
              Pengguna dilarang keras melakukan hal-hal berikut:
            </p>
            <ul class="legal-list">
              <li>
                Memanipulasi data transaksi atau mengakses data di luar ruang
                lingkup cabang yang ditetapkan.
              </li>
              <li>
                Melakukan pemindaian jaringan (<em>port scanning</em>) atau
                mengakses basis data secara langsung dari luar antarmuka
                aplikasi.
              </li>
              <li>
                Mengunggah kode berbahaya, virus, atau melakukan upaya peretasan
                terhadap infrastruktur server.
              </li>
            </ul>
          </div>

          <!-- Section 6 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">6.</span>
              <div>
                <div class="section-title-en">SUSPENSION OF ACCESS</div>
                <div class="section-title-id">Penghentian Layanan</div>
              </div>
            </div>
            <p class="section-body">
              Kami berhak menangguhkan atau menghentikan akun pengguna maupun
              akses jaringan cabang secara sepihak apabila ditemukan indikasi
              pelanggaran ketentuan ini, tanpa pemberitahuan sebelumnya, demi
              menjaga integritas dan keamanan sistem secara keseluruhan.
            </p>
          </div>

          <!-- Section 7 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">7.</span>
              <div>
                <div class="section-title-en">GOVERNING LAW</div>
                <div class="section-title-id">Hukum yang Berlaku</div>
              </div>
            </div>
            <p class="section-body">
              Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Republik
              Indonesia.
            </p>
          </div>

          <!-- Section 8 -->
          <div class="legal-section last-section">
            <div class="section-header">
              <span class="section-num">8.</span>
              <div>
                <div class="section-title-en">AMENDMENTS</div>
                <div class="section-title-id">Perubahan Ketentuan</div>
              </div>
            </div>
            <p class="section-body">
              Kami berhak mengubah ketentuan layanan ini kapan saja. Penggunaan
              sistem secara berkelanjutan setelah adanya perubahan dianggap
              sebagai bentuk persetujuan terhadap ketentuan yang telah
              diperbarui.
            </p>
          </div>
        </div>
      </v-card-text>

      <!-- Footer -->
      <v-card-actions class="pa-5 border-t bg-white">
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          class="px-8 rounded-lg text-none font-weight-bold agree-btn"
          @click="isOpen = false"
        >
          Saya Setuju & Mengerti
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600&display=swap");

.legal-dialog {
  font-family: "Source Sans 3", "Segoe UI", sans-serif;
  overflow: hidden;
}

/* Header */
.header-area {
  border-bottom: 1px solid #e5e7eb;
}

.icon-badge {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dialog-title {
  font-family: "Lora", Georgia, serif;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
  letter-spacing: -0.3px;
}

.dialog-subtitle {
  font-family: "Source Sans 3", sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  letter-spacing: 0.3px;
  margin-top: 1px;
}

/* Body */
.legal-body {
  padding: 0 40px 32px;
}

.intro-block {
  border-bottom: 1.5px solid #e5e7eb;
  padding: 28px 0 24px;
  margin-bottom: 4px;
}

.en-text {
  font-family: "Lora", Georgia, serif;
  font-size: 14px;
  line-height: 1.75;
  color: #1f2937;
  text-align: justify;
  margin-bottom: 14px;
}

.id-text {
  font-family: "Source Sans 3", sans-serif;
  font-size: 14px;
  line-height: 1.75;
  color: #374151;
  text-align: justify;
  margin-bottom: 0;
}

/* Sections */
.legal-section {
  padding: 22px 0;
  border-bottom: 1px solid #f3f4f6;
}

.last-section {
  border-bottom: none;
  padding-bottom: 0;
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.section-num {
  font-family: "Lora", serif;
  font-size: 15px;
  font-weight: 700;
  color: #2563eb;
  padding-top: 1px;
  flex-shrink: 0;
}

.section-title-en {
  font-family: "Lora", Georgia, serif;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  letter-spacing: 0.4px;
  line-height: 1.3;
}

.section-title-id {
  font-family: "Source Sans 3", sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  letter-spacing: 0.2px;
  margin-top: 1px;
}

.section-body {
  font-family: "Source Sans 3", sans-serif;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  text-align: justify;
  margin-bottom: 0;
  padding-left: 24px;
}

.legal-list {
  padding-left: 44px;
  margin-top: 8px;
  margin-bottom: 0;
}

.legal-list li {
  font-family: "Source Sans 3", sans-serif;
  font-size: 14px;
  line-height: 1.7;
  color: #374151;
  text-align: justify;
  margin-bottom: 5px;
}

.legal-list li:last-child {
  margin-bottom: 0;
}

/* Button */
.agree-btn {
  font-family: "Source Sans 3", sans-serif;
  letter-spacing: 0.3px;
  font-size: 14px;
}
</style>
