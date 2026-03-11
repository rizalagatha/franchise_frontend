<script setup lang="ts">
import { ref, watch } from 'vue';
import api from '@/services/api';
import { useToast } from 'vue-toastification';
import logoUrl from '@/assets/logo.png'; // Pastikan path logo Anda benar

const props = defineProps<{ modelValue: boolean; nomor: string }>();
const emit = defineEmits(['update:modelValue']);

const toast = useToast();
const isPrinting = ref(false);
const printData = ref<any>(null);

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('id-ID').format(val || 0);
};

const loadPrintData = async () => {
  if (!props.nomor) return;
  isPrinting.value = true;
  try {
    // PERBAIKAN: Gunakan endpoint /print yang baru saja kita buat
    const response = await api.get(`/setoran-pembayaran/${props.nomor}/print`);
    printData.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data cetak.');
    emit('update:modelValue', false);
  } finally {
    isPrinting.value = false;
  }
};

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) loadPrintData();
});

const triggerPrint = () => {
  const printContent = document.getElementById('print-area-setoran');
  if (!printContent) return;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  const css = `
    body { font-family: 'Arial', sans-serif; font-size: 11px; margin: 0; padding: 0; color: #000; }
    .print-wrapper { width: 210mm; padding: 10mm; }
    .receipt-section { margin-bottom: 20mm; }
    .header-logo { width: 40px; height: 40px; margin-right: 10px; }
    .company-header { display: flex; align-items: center; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
    .title { text-align: center; font-weight: bold; font-size: 14px; text-decoration: underline; margin-bottom: 15px; }
    .info-table { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
    .info-table td { padding: 2px 5px; vertical-align: top; }
    .info-table td:first-child { width: 150px; }
    .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .detail-table th, .detail-table td { border: 1px solid #000; padding: 4px; }
    .detail-table th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .footer-signs { display: flex; justify-content: space-between; margin-top: 20px; padding: 0 50px; }
    .footer-signs > div { text-align: center; width: 150px; }
    .signature-line { margin-top: 50px; border-bottom: 1px solid #000; }
    @page { size: A4 portrait; margin: 0; }
  `;

  doc.open();
  doc.write(`
    <html>
      <head>
        <title>Cetak Cash Receipt</title>
        <style>${css}</style>
      </head>
      <body>
        ${printContent.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
};
</script>

<template>
  <v-dialog :model-value="modelValue" @update:modelValue="$emit('update:modelValue', $event)" max-width="900px"
    scrollable>
    <v-card style="height: 90vh;">
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title>Preview Cetak Setoran</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-printer" @click="triggerPrint" class="mr-2"></v-btn>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)"></v-btn>
      </v-toolbar>

      <v-card-text class="bg-grey-lighten-3 pa-4 d-flex justify-center" style="overflow-y: auto;">
        <v-progress-circular v-if="isPrinting" indeterminate color="primary"></v-progress-circular>

        <div v-else-if="printData" id="print-area-setoran" class="bg-white elevation-2 print-wrapper">
          <div v-for="copy in [1, 2]" :key="copy" class="receipt-section">
            <div class="company-header">
              <img :src="logoUrl" class="header-logo" />
              <div>
                <strong>CABANG KAOSAN</strong><br>
                JL. KARYA NO.182 B, KARANG BEROMBAK, KEC. MEDAN BARAT, KOTA MEDAN<br>
                087784216266
              </div>
            </div>

            <div class="title">CASH RECEIPT</div>

            <table class="info-table">
              <tr>
                <td>Nomor Dokumen</td>
                <td>: {{ printData.header.sh_nomor }}</td>
              </tr>
              <tr>
                <td>Tanggal Dokumen</td>
                <td>: {{ printData.header.sh_tanggal.substring(0, 10) }}</td>
              </tr>
              <tr>
                <td>Nama Customer</td>
                <td>: ({{ printData.header.sh_cus_kode }}) {{ printData.header.cus_nama }}</td>
              </tr>
              <tr>
                <td>Alamat</td>
                <td>: {{ printData.header.cus_alamat || '-' }}</td>
              </tr>
              <tr>
                <td>No. Kontak</td>
                <td>: {{ printData.header.cus_telp || '-' }}</td>
              </tr>
              <tr>
                <td>Nominal yang Diterima</td>
                <td>: Rp {{ formatCurrency(printData.header.sh_nominal) }}</td>
              </tr>
              <tr>
                <td>Terbilang</td>
                <td>: {{ printData.header.terbilang || '..............................' }}</td>
              </tr>
              <tr>
                <td>Keterangan</td>
                <td>: {{ printData.header.sh_ket || '-' }}</td>
              </tr>
            </table>

            <table class="detail-table">
              <thead>
                <tr>
                  <th width="40">No.</th>
                  <th width="150">No. Invoice</th>
                  <th width="120" class="text-right">Nominal</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in printData.details" :key="idx">
                  <td class="text-center">{{ idx + 1 }}</td>
                  <td>{{ item.invoice }}</td>
                  <td class="text-right">{{ formatCurrency(item.bayar) }}</td>
                  <td>{{ item.ket || '' }}</td>
                </tr>
                <tr>
                  <td colspan="2" class="text-right" style="font-weight:bold; background:#f0f0f0;">Grand Total</td>
                  <td class="text-right" style="font-weight:bold; background:#f0f0f0;">{{
                    formatCurrency(printData.header.sh_nominal) }}</td>
                  <td style="background:#f0f0f0;"></td>
                </tr>
              </tbody>
            </table>

            <div class="footer-signs">
              <div>
                Yang Menyerahkan,<br><br><br>
                <div class="signature-line"></div>
              </div>
              <div>
                Penerima,<br><br><br>
                <div class="signature-line"></div>
              </div>
            </div>

            <div v-if="copy === 1" style="border-bottom: 1px dashed #ccc; margin-top: 30mm; margin-bottom: 20mm;"></div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* --- CSS UNTUK TAMPILAN PREVIEW DI LAYAR --- */
.print-wrapper {
  font-family: 'Arial', sans-serif;
  font-size: 11px;
  color: #000;
  width: 210mm;
  /* Ukuran lebar A4 */
  min-height: 297mm;
  margin: 0 auto;
  padding: 15mm;
  background-color: white;
}

.receipt-section {
  margin-bottom: 20mm;
}

.company-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #000;
  padding-bottom: 5px;
  margin-bottom: 10px;
}

.header-logo {
  width: 45px;
  height: 45px;
  margin-right: 10px;
  object-fit: contain;
}

.title {
  text-align: center;
  font-weight: bold;
  font-size: 14px;
  text-decoration: underline;
  margin-bottom: 15px;
}

.info-table {
  width: 100%;
  margin-bottom: 10px;
  border-collapse: collapse;
}

.info-table td {
  padding: 2px 5px;
  vertical-align: top;
  border: none;
  /* Pastikan tidak ada border di tabel info */
}

.info-table td:first-child {
  width: 150px;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 15px;
}

.detail-table th,
.detail-table td {
  border: 1px solid #000;
  padding: 4px 6px;
}

.detail-table th {
  background-color: #f0f0f0;
  text-align: center;
  font-weight: bold;
}

.text-right {
  text-align: right !important;
}

.text-center {
  text-align: center !important;
}

.footer-signs {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  padding: 0 50px;
}

.footer-signs>div {
  text-align: center;
  width: 150px;
}

.signature-line {
  margin-top: 50px;
  border-bottom: 1px solid #000;
}
</style>
