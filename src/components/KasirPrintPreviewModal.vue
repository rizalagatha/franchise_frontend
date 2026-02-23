<script setup lang="ts">
import { ref, watch } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import Logo from "@/assets/logo.png";
import InstagramLogo from "@/assets/instagram.jpg";
import FacebookLogo from "@/assets/facebook.jpg";

const props = defineProps<{
  modelValue: boolean;
  nomorInvoice: string | null;
}>();

const emit = defineEmits(["update:modelValue"]);
const toast = useToast();

const printData = ref<any>(null);
const isLoading = ref(false);

// Helper Format Angka (Mencegah NaN)
const formatRupiah = (val: any) => {
  const num = Number(val);
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("id-ID").format(num);
};

// CSS Thermal Struk - Dioptimalkan untuk presisi 58mm
const thermalCss = `
  @page { size: 58mm auto; margin: 0; }
  body {
    margin: 0; padding: 2mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt; line-height: 1.2; color: black; width: 54mm;
  }
  .text-center { text-align: center; }
  /* Logo diperkecil agar tidak raksasa */
  .logo-img { max-width: 15mm; height: auto; display: block; margin: 0 auto 2mm; }
  .dashed-line { border-bottom: 1px dashed black; margin: 2mm 0; }
  /* Flexbox untuk merapikan sisi kiri & kanan */
  .flex-row { display: flex; justify-content: space-between; align-items: flex-start; }
  .font-bold { font-weight: bold; }
  .footer { font-size: 8pt; margin-top: 4mm; }
  .medsos-row { display: flex; align-items: center; justify-content: center; gap: 3px; margin-top: 1mm; }
  .medsos-icon { height: 8pt; width: auto; }
`;

const fetchData = async () => {
  if (!props.nomorInvoice) return;
  isLoading.value = true;
  try {
    const res = await api.get(`/kasir/print/${props.nomorInvoice}`);
    printData.value = res.data;
  } catch (err) {
    toast.error("Gagal memuat data struk.");
  } finally {
    isLoading.value = false;
  }
};

const printReceipt = () => {
  const printContent = document.getElementById("thermal-print-area");
  if (!printContent) return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`<html><head><style>${thermalCss}</style></head><body>${printContent.innerHTML}</body></html>`);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
};

// --- Fungsi Cetak yang Diperbaiki ---
const triggerPrint = () => {
  // Pastikan ID ini sesuai dengan yang ada di template
  const content = document.getElementById("receipt-preview-content");
  if (!content) {
    toast.error("Gagal menemukan konten struk.");
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  // PERBAIKAN: Gunakan thermalCss (sesuai definisi di line 31)
  doc.write(`
    <html>
      <head>
        <title>Cetak Struk Kasir</title>
        <style>${thermalCss}</style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
    </html>
  `);
  doc.close();

  const frameWindow = iframe.contentWindow;
  if (frameWindow) {
    iframe.onload = () => {
      frameWindow.focus();
      frameWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    };

    // Fallback jika onload tidak terpicu
    if (doc.readyState === 'complete') {
      frameWindow.focus();
      frameWindow.print();
    }
  }
};

watch(() => props.modelValue, (v) => { if (v) fetchData(); });
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="360px" persistent>
    <v-card>
      <v-toolbar color="blue-grey-darken-2" density="compact">
        <v-toolbar-title class="text-body-1 font-weight-bold">Preview Struk Kasir</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" density="compact"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-0 bg-grey-lighten-3 scrollable-container">
        <div v-if="isLoading" class="d-flex justify-center align-center pa-5" style="height: 200px;">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
        </div>

        <div v-else-if="printData" class="receipt-wrapper bg-white pa-3 mx-auto my-3 shadow-sm">
          <div id="receipt-preview-content" class="receipt-font">

            <div class="text-center">
              <img :src="Logo" alt="Logo" class="logo-img" />
              <div class="font-bold">{{ printData.header.perusahaanNama }}</div>
              <div>{{ printData.header.perusahaanAlamat }}</div>
              <div>WA: {{ printData.header.perusahaanTelp }}</div>
            </div>

            <div class="dashed-line"></div>

            <div>
              <div>NoBon: {{ printData.header.nomor }}</div>
              <div>Tgl : {{ printData.header.tanggal }}</div>
              <div>Kasir: {{ printData.header.userNama }}</div>
              <div>Cust : {{ printData.header.customer }}</div>
            </div>

            <div class="dashed-line"></div>

            <div class="items-list">
              <div v-for="(item, index) in printData.details" :key="index" class="mb-1">
                <div>{{ item.nama }} ({{ item.ukuran }})</div>
                <div class="flex-row">
                  <span>{{ formatRupiah(item.qty) }} x {{ formatRupiah(item.harga) }}</span>
                  <span>{{ formatRupiah(item.total) }}</span>
                </div>
              </div>
            </div>

            <div class="dashed-line"></div>

            <div class="summary-section">
              <div class="flex-row">
                <span>Total (Sblm Diskon)</span>
                <span>{{ formatRupiah(printData.summary.total) }}</span>
              </div>
              <div v-if="printData.summary.diskon > 0" class="flex-row">
                <span>Diskon Invoice</span>
                <span>-{{ formatRupiah(printData.summary.diskon) }}</span>
              </div>
              <div class="flex-row">
                <span>Netto</span>
                <span>{{ formatRupiah(printData.summary.netto) }}</span>
              </div>
              <div class="flex-row" v-if="printData.summary.biayaKirim > 0">
                <span>Biaya Kirim</span>
                <span>{{ formatRupiah(printData.summary.biayaKirim) }}</span>
              </div>

              <div class="dashed-line"></div>

              <div class="flex-row font-bold" style="font-size: 10pt;">
                <span>GRAND TOTAL</span>
                <span>{{ formatRupiah(printData.summary.grandTotal) }}</span>
              </div>

              <div class="flex-row mt-1">
                <span>Bayar</span>
                <span>{{ formatRupiah(printData.summary.bayar) }}</span>
              </div>
              <div class="flex-row">
                <span>Kembali</span>
                <span>{{ formatRupiah(printData.summary.kembaliGross) }}</span>
              </div>

              <div v-if="printData.summary.pundiAmal > 0" class="flex-row" style="font-style: italic; color: #666;">
                <span>Pundi Amal</span>
                <span>-{{ formatRupiah(printData.summary.pundiAmal) }}</span>
              </div>

              <div class="flex-row font-bold mt-1 pt-1" style="border-top: 1px solid #000;">
                <span>NETTO KEMBALI</span>
                <span>{{ formatRupiah(printData.summary.nettoKembali) }}</span>
              </div>
            </div>

            <div class="dashed-line"></div>

            <div class="footer text-center">
              <div class="mb-1">
                Dengan membeli produk ini, kami telah menyisihkan untuk Pundi Amal.
              </div>
              <div class="font-bold">
                BARANG YANG SUDAH DIBELI<br>TIDAK BISA DIKEMBALIKAN
              </div>

              <div class="mt-2">
                <div class="medsos-row">
                  <img :src="InstagramLogo" class="medsos-icon" />
                  <span>kaosanofficial.samarinda</span>
                </div>
                <div class="medsos-row">
                  <img :src="FacebookLogo" class="medsos-icon" />
                  <span>087784216266</span>
                </div>
              </div>

              <div class="mt-2 font-bold">TERIMAKASIH<br>ATAS KUNJUNGAN ANDA</div>
            </div>

          </div>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions class="pa-3">
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Tutup</v-btn>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="elevated" prepend-icon="mdi-printer" @click="triggerPrint">
          Cetak Struk
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Style untuk wadah preview di layar (bukan hasil cetak) */
.scrollable-container {
  max-height: 70vh;
  overflow-y: auto;
}

.receipt-wrapper {
  width: 70mm;
  /* Sedikit lebih lebar di layar agar mudah dibaca */
  max-width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Terapkan font monospace dan ukuran dasar pada preview */
.receipt-font {
  font-family: 'Courier New', Courier, monospace;
  /* Font struk */
  font-size: 11px;
  line-height: 1.3;
  color: #000;
}

/* Style pendukung agar preview mirip dengan hasil cetak */
.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.font-bold {
  font-weight: bold;
}

.flex-row {
  display: flex;
  justify-content: space-between;
}

.dashed-line {
  border-bottom: 1px dashed #333;
  margin: 6px 0;
}

/* Perbaikan Ukuran Logo di Preview */
.logo-img {
  max-width: 30mm;
  /* Dibatasi agar tidak raksasa */
  height: auto;
  display: block;
  margin: 0 auto 5px;
}

.medsos-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 2px;
}

.medsos-icon {
  height: 12px;
  width: auto;
}
</style>
