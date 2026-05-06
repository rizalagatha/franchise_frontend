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
        <div class="d-flex align-center" style="gap: 14px">
          <div class="icon-badge">
            <v-icon color="white" size="18">mdi-shield-check-outline</v-icon>
          </div>
          <div>
            <div class="dialog-title">Privacy Policy</div>
            <div class="dialog-subtitle">Kebijakan Privasi</div>
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
              We respect your privacy and are committed to protecting your
              personal information. This Privacy Policy outlines how we collect,
              use, disclose, and safeguard your personal data when you use our
              application. It also explains your rights and choices regarding
              your personal information.
            </p>
            <p class="id-text">
              Kami menghormati privasi Anda dan berkomitmen untuk melindungi
              informasi pribadi Anda. Kebijakan Privasi ini menguraikan
              bagaimana kami mengumpulkan, menggunakan, mengungkapkan, dan
              menjaga data pribadi Anda saat Anda menggunakan aplikasi kami.
              Kebijakan ini juga menjelaskan hak dan pilihan Anda mengenai
              informasi pribadi Anda.
            </p>
            <p class="update-badge">
              Terakhir diperbarui: <strong>Januari 2026</strong>
            </p>
          </div>

          <!-- Section 1 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">1.</span>
              <div>
                <div class="section-title-en">INFORMATION WE COLLECT</div>
                <div class="section-title-id">
                  Informasi yang Kami Kumpulkan
                </div>
              </div>
            </div>
            <p class="section-body">
              Sistem ini dapat mengumpulkan data yang Anda masukkan secara
              langsung maupun yang terekam secara otomatis, meliputi:
            </p>
            <ul class="legal-list">
              <li>
                <em>User ID</em>, peran (hak akses), dan data identitas cabang
                yang didaftarkan oleh Admin.
              </li>
              <li>
                Informasi transaksi ritel, pergerakan inventaris barang, serta
                data pelanggan operasional cabang.
              </li>
              <li>
                Data aktivitas sesi (Token JWT), alamat IP, dan riwayat tindakan
                pengguna untuk keperluan audit keamanan jaringan.
              </li>
            </ul>
          </div>

          <!-- Section 2 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">2.</span>
              <div>
                <div class="section-title-en">USE OF INFORMATION</div>
                <div class="section-title-id">Penggunaan Informasi</div>
              </div>
            </div>
            <p class="section-body">
              Informasi yang dikumpulkan digunakan untuk:
            </p>
            <ul class="legal-list">
              <li>
                Menyediakan dan memastikan kelancaran operasional layanan ritel
                di cabang Anda.
              </li>
              <li>
                Memproses transaksi kasir dan mengirimkan rekapitulasi data
                secara <em>real-time</em> (<em>Dynamic Pooling</em>).
              </li>
              <li>
                Memverifikasi identitas pengguna guna mengamankan isolasi data
                antar cabang (<em>Multi-Tenant Architecture</em>).
              </li>
            </ul>
          </div>

          <!-- Section 3 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">3.</span>
              <div>
                <div class="section-title-en">SHARING WITH THIRD PARTIES</div>
                <div class="section-title-id">
                  Berbagi Informasi dengan Pihak Ketiga
                </div>
              </div>
            </div>
            <p class="section-body">
              Kami menjaga kerahasiaan data bisnis Anda dengan serius dan
              <strong>tidak menjual</strong>
              data tersebut kepada pihak mana pun. Data hanya dapat dibagikan
              dalam kondisi berikut:
            </p>
            <ul class="legal-list">
              <li>
                Kepatuhan terhadap hukum, audit internal perusahaan, atau
                permintaan otoritas pemerintah yang diwajibkan secara legal.
              </li>
            </ul>
          </div>

          <!-- Section 4 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">4.</span>
              <div>
                <div class="section-title-en">DATA SECURITY</div>
                <div class="section-title-id">Keamanan Data</div>
              </div>
            </div>
            <p class="section-body">
              Kami menerapkan langkah-langkah keamanan teknis tingkat tinggi,
              termasuk enkripsi kata sandi satu arah (<em>Hashing</em>),
              pembatasan akses basis data hanya dari jaringan lokal
              (<em>localhost</em>), serta perlindungan <em>firewall</em> untuk
              mencegah intrusi tidak sah. Perlu diperhatikan bahwa tidak ada
              metode transmisi internet yang sepenuhnya bebas dari risiko.
            </p>
          </div>

          <!-- Section 5 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">5.</span>
              <div>
                <div class="section-title-en">USER RIGHTS</div>
                <div class="section-title-id">Hak-Hak Pengguna</div>
              </div>
            </div>
            <p class="section-body">Melalui Admin Cabang, Anda berhak untuk:</p>
            <ul class="legal-list">
              <li>
                Mengakses data transaksi operasional yang tersimpan dalam ruang
                lingkup cabang Anda.
              </li>
              <li>
                Memperbarui atau memperbaiki informasi akun pengguna yang tidak
                akurat.
              </li>
              <li>
                Meminta penonaktifan atau pembatasan hak akses aplikasi pada
                pengguna tertentu.
              </li>
            </ul>
          </div>

          <!-- Section 6 -->
          <div class="legal-section">
            <div class="section-header">
              <span class="section-num">6.</span>
              <div>
                <div class="section-title-en">POLICY UPDATES</div>
                <div class="section-title-id">Perubahan Kebijakan Privasi</div>
              </div>
            </div>
            <p class="section-body">
              Kebijakan privasi ini dapat diperbarui sewaktu-waktu seiring
              dengan peningkatan fitur keamanan dan migrasi sistem. Setiap
              perubahan akan diinformasikan langsung melalui pembaruan di
              halaman ini.
            </p>
          </div>

          <!-- Section 7 -->
          <div class="legal-section last-section">
            <div class="section-header">
              <span class="section-num">7.</span>
              <div>
                <div class="section-title-en">CONTACT</div>
                <div class="section-title-id">Hubungi Kami</div>
              </div>
            </div>
            <p class="section-body">
              Apabila Anda memiliki pertanyaan mengenai kebijakan privasi ini
              atau menemukan indikasi celah keamanan, segera hubungi
              administrator pusat infrastruktur kami.
            </p>
          </div>
        </div>
      </v-card-text>

      <!-- Footer -->
      <v-card-actions class="pa-5 border-t bg-white">
        <v-spacer />
        <v-btn
          color="deep-orange-darken-3"
          variant="flat"
          class="px-8 rounded-lg text-none font-weight-bold close-btn"
          @click="isOpen = false"
        >
          Tutup Kebijakan
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
  background: linear-gradient(135deg, #ea580c, #c2410c);
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
  margin-bottom: 12px;
}

.update-badge {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 8px;
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
  color: #ea580c;
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
.close-btn {
  font-family: "Source Sans 3", sans-serif;
  letter-spacing: 0.3px;
  font-size: 14px;
}
</style>
