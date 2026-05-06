<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(["update:modelValue", "agreed"]);

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const hasReadToBottom = ref(false);

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  const currentScrollPosition = target.scrollTop + target.clientHeight;
  if (currentScrollPosition >= target.scrollHeight - 20) {
    hasReadToBottom.value = true;
  }
};

const submitAgreement = () => {
  emit("agreed");
  isOpen.value = false;
};
</script>

<template>
  <v-dialog v-model="isOpen" persistent max-width="820" scrollable>
    <v-card class="rounded-xl elevation-12 legal-dialog">
      <!-- Header -->
      <v-card-title
        class="d-flex align-center pa-6 border-b bg-white header-area"
      >
        <div class="d-flex align-center header-inner">
          <div class="icon-badge">
            <v-icon color="white" size="18"
              >mdi-file-document-check-outline</v-icon
            >
          </div>
          <div>
            <div class="dialog-title">New User Agreement</div>
            <div class="dialog-subtitle">Persetujuan Pengguna Baru</div>
          </div>
        </div>
      </v-card-title>

      <!-- Body -->
      <v-card-text
        class="pa-0 bg-white"
        style="max-height: 70vh; overflow-y: auto"
        @scroll="handleScroll"
      >
        <div class="legal-body">
          <!-- Alert info -->
          <v-alert
            type="info"
            variant="tonal"
            color="primary"
            class="mb-6 alert-notice"
            rounded="lg"
          >
            <strong>Perhatian:</strong> Silakan gulir dan baca seluruh Syarat
            Ketentuan serta Kebijakan Privasi di bawah ini hingga akhir untuk
            mengaktifkan tombol persetujuan.
          </v-alert>

          <!-- ── BAGIAN 1: TERMS OF SERVICE ── -->
          <div class="document-divider">
            <span class="document-label label-blue"
              >Bagian 1 — Terms of Service</span
            >
          </div>

          <div class="intro-block intro-blue">
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

          <div class="legal-section section-blue">
            <div class="section-header">
              <span class="section-num num-blue">1.</span>
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

          <div class="legal-section section-blue">
            <div class="section-header">
              <span class="section-num num-blue">2.</span>
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
                pembuatan dan pengaturan hak akses akun staf di cabangnya.
              </li>
              <li>
                Setiap pengguna bertanggung jawab penuh atas seluruh aktivitas
                transaksi dan pendataan yang terjadi di bawah akunnya.
              </li>
            </ul>
          </div>

          <div class="legal-section section-blue">
            <div class="section-header">
              <span class="section-num num-blue">3.</span>
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

          <div class="legal-section section-blue">
            <div class="section-header">
              <span class="section-num num-blue">4.</span>
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

          <div class="legal-section section-blue">
            <div class="section-header">
              <span class="section-num num-blue">5.</span>
              <div>
                <div class="section-title-en">GOVERNING LAW</div>
                <div class="section-title-id">Hukum yang Berlaku</div>
              </div>
            </div>
            <p class="section-body">
              Ketentuan ini diatur dan ditafsirkan berdasarkan hukum Republik
              Indonesia. Penggunaan sistem secara berkelanjutan setelah adanya
              perubahan dianggap sebagai bentuk persetujuan terhadap ketentuan
              yang telah diperbarui.
            </p>
          </div>

          <!-- ── BAGIAN 2: PRIVACY POLICY ── -->
          <div class="document-divider divider-top-gap">
            <span class="document-label label-orange"
              >Bagian 2 — Privacy Policy</span
            >
          </div>

          <div class="intro-block intro-orange">
            <p class="en-text">
              We respect your privacy and are committed to protecting your
              personal information. This Privacy Policy outlines how we collect,
              use, disclose, and safeguard your personal data when you use our
              application.
            </p>
            <p class="id-text">
              Kami menghormati privasi Anda dan berkomitmen untuk melindungi
              informasi pribadi Anda. Kebijakan Privasi ini menguraikan
              bagaimana kami mengumpulkan, menggunakan, mengungkapkan, dan
              menjaga data pribadi Anda saat menggunakan aplikasi kami.
            </p>
          </div>

          <div class="legal-section section-orange">
            <div class="section-header">
              <span class="section-num num-orange">1.</span>
              <div>
                <div class="section-title-en">INFORMATION WE COLLECT</div>
                <div class="section-title-id">
                  Informasi yang Kami Kumpulkan
                </div>
              </div>
            </div>
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
                pengguna untuk audit keamanan.
              </li>
            </ul>
          </div>

          <div class="legal-section section-orange">
            <div class="section-header">
              <span class="section-num num-orange">2.</span>
              <div>
                <div class="section-title-en">USE OF INFORMATION</div>
                <div class="section-title-id">Penggunaan Informasi</div>
              </div>
            </div>
            <ul class="legal-list">
              <li>
                Menyediakan dan memastikan kelancaran operasional layanan ritel
                di cabang Anda.
              </li>
              <li>
                Memproses transaksi kasir dan mengirimkan rekapitulasi data
                secara <em>real-time</em>.
              </li>
              <li>
                Memverifikasi identitas pengguna guna mengamankan isolasi data
                antar cabang.
              </li>
            </ul>
          </div>

          <div class="legal-section section-orange">
            <div class="section-header">
              <span class="section-num num-orange">3.</span>
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
              mencegah intrusi tidak sah.
            </p>
          </div>

          <div class="legal-section section-orange">
            <div class="section-header">
              <span class="section-num num-orange">4.</span>
              <div>
                <div class="section-title-en">USER RIGHTS</div>
                <div class="section-title-id">Hak-Hak Pengguna</div>
              </div>
            </div>
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

          <!-- End of document -->
          <div class="end-of-doc">
            <v-icon color="grey-lighten-1" size="28" class="mb-2"
              >mdi-check-circle-outline</v-icon
            >
            <p class="end-label">Akhir dari Dokumen</p>
          </div>
        </div>
      </v-card-text>

      <!-- Footer -->
      <v-card-actions class="pa-5 border-t bg-grey-lighten-5">
        <v-spacer />
        <v-btn
          :color="hasReadToBottom ? 'primary' : 'grey'"
          variant="flat"
          class="px-8 rounded-lg text-none font-weight-bold agree-btn"
          :disabled="!hasReadToBottom"
          height="44"
          @click="submitAgreement"
        >
          <v-icon start class="mr-2">{{
            hasReadToBottom ? "mdi-check-all" : "mdi-arrow-down-box"
          }}</v-icon>
          {{
            hasReadToBottom
              ? "Saya Setuju & Mengerti"
              : "Scroll ke bawah untuk menyetujui"
          }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600&display=swap");

/* ── Base ── */
.legal-dialog {
  font-family: "Source Sans 3", "Segoe UI", sans-serif;
  overflow: hidden;
}

/* ── Header ── */
.header-area {
  border-bottom: 1px solid #e5e7eb;
}

.header-inner {
  gap: 14px;
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

/* ── Body ── */
.legal-body {
  padding: 28px 40px 16px;
}

.alert-notice {
  font-family: "Source Sans 3", sans-serif;
  font-size: 14px;
}

/* ── Document Divider ── */
.document-divider {
  position: relative;
  text-align: center;
  border-bottom: 2px dashed #e5e7eb;
  margin-bottom: 24px;
  height: 24px;
}

.divider-top-gap {
  margin-top: 32px;
}

.document-label {
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  background: #ffffff;
  padding: 0 16px;
  font-family: "Source Sans 3", sans-serif;
  font-weight: 700;
  font-size: 13px;
  border-radius: 20px;
  white-space: nowrap;
}

.label-blue {
  color: #2563eb;
  border: 1.5px solid #2563eb;
}

.label-orange {
  color: #ea580c;
  border: 1.5px solid #ea580c;
}

/* ── Intro Block ── */
.intro-block {
  padding: 20px 0 20px;
  margin-bottom: 4px;
}

.intro-blue {
  border-bottom: 1.5px solid #e5e7eb;
}

.intro-orange {
  border-bottom: 1.5px solid #ffedd5;
}

.en-text {
  font-family: "Lora", Georgia, serif;
  font-size: 14px;
  line-height: 1.75;
  color: #1f2937;
  text-align: justify;
  margin-bottom: 12px;
}

.id-text {
  font-family: "Source Sans 3", sans-serif;
  font-size: 14px;
  line-height: 1.75;
  color: #374151;
  text-align: justify;
  margin-bottom: 0;
}

/* ── Sections ── */
.legal-section {
  padding: 20px 0;
}

.section-blue {
  border-bottom: 1px solid #f3f4f6;
}

.section-orange {
  border-bottom: 1px solid #fff7ed;
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
  padding-top: 1px;
  flex-shrink: 0;
}

.num-blue {
  color: #2563eb;
}

.num-orange {
  color: #ea580c;
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

/* ── End of Document ── */
.end-of-doc {
  margin-top: 32px;
  margin-bottom: 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.end-label {
  font-family: "Source Sans 3", sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #9ca3af;
  margin-bottom: 0;
}

/* ── Footer Button ── */
.agree-btn {
  font-family: "Source Sans 3", sans-serif;
  letter-spacing: 0.3px;
  font-size: 14px;
  transition: all 0.3s ease;
}
</style>
