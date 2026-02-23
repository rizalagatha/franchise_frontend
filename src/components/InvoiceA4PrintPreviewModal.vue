<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import api from '@/services/api';
import { formatRupiah } from "@/utils/formatRupiah";
import QRCode from "qrcode";
import { useToast } from 'vue-toastification';

const props = defineProps<{
  modelValue: boolean;
  nomorInvoice: string | null;
}>();

const emit = defineEmits(['update:modelValue']);
const toast = useToast();

const printData = ref<any>(null);
const isLoading = ref(false);
const qrCodeData = ref<string | null>(null);

// CSS Khusus A4 untuk dimasukkan ke Iframe
const a4Styles = `
  @page { size: A4 portrait; margin: 10mm; } /* Margin halaman diperkecil */
  body { font-family: Arial, sans-serif; font-size: 9pt; color: black; margin: 0; padding: 0; } /* Font dasar diubah ke 9pt */
  .header { display: flex; justify-content: space-between; border-bottom: 1px solid black; padding-bottom: 5px; margin-bottom: 10px; }
  .logo { height: 40px; }
  .qr-code { height: 50px; }
  .company-info { line-height: 1.2; }
  .title { text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px; } /* Font judul diubah ke 14pt */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px; }
  .label { display: inline-block; width: 65px; font-weight: bold; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 8.5pt; } /* Font tabel sedikit lebih kecil */
  .items-table th, .items-table td { border: 1px solid black; padding: 4px; } /* Padding sel tabel diperkecil */
  .text-end { text-align: right; }
  .text-center { text-align: center; }
  .footer-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 15px; align-items: flex-start; margin-top: 15px; }
  .summary-item { display: flex; justify-content: space-between; margin-bottom: 2px; }
  .grand-total { font-weight: bold; border-top: 1px solid black; padding-top: 4px; margin-top: 4px; font-size: 10pt; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; margin-top: 25px; }
  .sig-box { height: 70px; display: flex; flex-direction: column; justify-content: space-between; font-size: 9pt; }
  .terbilang-box { border: 1px dashed #ccc; padding: 6px; font-style: italic; font-size: 8pt; line-height: 1.3; } /* Font terbilang diubah ke 8pt */
`;

const fetchPrintData = async () => {
  if (!props.nomorInvoice) return;
  isLoading.value = true;
  try {
    const response = await api.get(`/kasir/print-a4/${props.nomorInvoice}`);
    printData.value = response.data;
    qrCodeData.value = await QRCode.toDataURL(props.nomorInvoice, { width: 150, margin: 1 });
  } catch (error) {
    toast.error("Gagal memuat data invoice.");
    emit('update:modelValue', false);
  } finally {
    isLoading.value = false;
  }
};

const triggerPrint = async () => {
  const content = document.getElementById("a4-print-area");
  if (!content) return;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0"; iframe.style.bottom = "0";
  iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`<html><head><style>${a4Styles}</style></head><body>${content.innerHTML}</body></html>`);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
};

watch(() => props.modelValue, (val) => {
  if (val) fetchPrintData();
});
</script>

<template>
  <v-dialog :model-value="modelValue" @update:modelValue="$emit('update:modelValue', $event)" max-width="900px"
    persistent>
    <v-card class="bg-grey-lighten-4">
      <v-toolbar color="blue-grey-darken-4" density="compact">
        <v-toolbar-title class="text-body-2">Pratinjau Invoice A4</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" size="small"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-6 d-flex justify-center scroll-area">
        <div v-if="isLoading" class="text-center py-10">
          <v-progress-circular indeterminate color="primary" />
          <div class="mt-2">Mengambil data...</div>
        </div>

        <div v-else-if="printData" id="a4-print-area" class="a4-page shadow-lg bg-white">
          <div class="header">
            <div class="header-left d-flex ga-4">
              <img src="@/assets/logo.png" class="logo" />
              <div class="company-info">
                <strong>{{ printData.header.perusahaanNama }}</strong><br>
                <span>{{ printData.header.perusahaanAlamat }}</span><br>
                <span>{{ printData.header.perusahaanTelp }}</span>
              </div>
            </div>
            <img v-if="qrCodeData" :src="qrCodeData" class="qr-code" />
          </div>

          <div class="title">INVOICE</div>

          <div class="info-grid">
            <div class="info-column">
              <div><span class="label">Nomor</span>: {{ printData.header.nomor }}</div>
              <div><span class="label">Tanggal</span>: {{ printData.header.tanggal }}</div>
            </div>
            <div class="info-column">
              <div><strong>Customer :</strong> {{ printData.header.customer }}</div>
              <div style="font-size: 9pt; margin-left: 75px;">{{ printData.header.alamatCustomer }}</div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th width="30">No</th>
                <th>Kode</th>
                <th>Nama Barang</th>
                <th width="50">Size</th>
                <th width="40">Qty</th>
                <th class="text-end">Harga</th>
                <th class="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in printData.details" :key="idx">
                <td class="text-center">{{ idx + 1 }}</td>
                <td>{{ item.kode }}</td>
                <td>{{ item.nama }}</td>
                <td class="text-center">{{ item.ukuran }}</td>
                <td class="text-center">{{ item.qty }}</td>
                <td class="text-end">{{ formatRupiah(item.harga) }}</td>
                <td class="text-end font-weight-bold">{{ formatRupiah(item.total) }}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer-grid">
            <div class="terbilang-box">
              <strong>Terbilang:</strong><br>
              <span class="text-uppercase">{{ printData.terbilang }}</span>
            </div>
            <div class="summary">
              <div class="summary-item"><span>Total :</span> <span>{{ formatRupiah(printData.summary.total) }}</span>
              </div>
              <div v-if="printData.summary.diskon > 0" class="summary-item">
                <span>Diskon :</span> <span>-{{ formatRupiah(printData.summary.diskon) }}</span>
              </div>
              <div class="summary-item grand-total">
                <span>Grand Total :</span> <span>{{ formatRupiah(printData.summary.grandTotal) }}</span>
              </div>
              <div class="summary-item"><span>Bayar :</span> <span>{{ formatRupiah(printData.summary.bayar) }}</span>
              </div>
              <div class="summary-item"><span>Kembali :</span> <span>{{ formatRupiah(printData.summary.kembali)
                  }}</span></div>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">Dibuat Oleh,<br><br>( {{ printData.header.userNama }} )</div>
            <div class="sig-box">Mengetahui,<br><br>( .................... )</div>
            <div class="sig-box">Customer,<br><br>( .................... )</div>
          </div>
        </div>
      </v-card-text>

      <v-card-actions class="bg-white pa-4">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="elevated" prepend-icon="mdi-printer" @click="triggerPrint"
          :disabled="isLoading">
          Cetak Invoice (A4)
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.scroll-area {
  max-height: 80vh;
  overflow-y: auto;
}

.a4-page {
  width: 210mm;
  min-height: 297mm;
  padding: 15mm;
  font-family: Arial, sans-serif;
  font-size: 10pt;
  color: black;
}

.header {
  display: flex;
  justify-content: space-between;
  border-bottom: 2px solid black;
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.logo {
  height: 45px;
}

.qr-code {
  height: 60px;
}

.title {
  text-align: center;
  font-size: 16pt;
  font-weight: bold;
  text-decoration: underline;
  margin-bottom: 15px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 15px;
}

.label {
  display: inline-block;
  width: 70px;
  font-weight: bold;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 15px;
}

.items-table th,
.items-table td {
  border: 1px solid black;
  padding: 6px;
}

.footer-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
}

.grand-total {
  font-weight: bold;
  border-top: 1px solid black;
  padding-top: 4px;
  margin-top: 4px;
}

.signatures {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  text-align: center;
  margin-top: 30px;
}

.sig-box {
  height: 80px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
</style>
