<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import api from '@/services/api';
import { format, parseISO } from 'date-fns';
import Logo from '@/assets/logo.png';
import InstagramLogo from '@/assets/instagram.jpg';
import FacebookLogo from '@/assets/facebook.jpg';
import { formatRupiah } from "@/utils/formatRupiah";
import QRCode from "qrcode";
import { useToast } from 'vue-toastification';

const route = useRoute();
const toast = useToast();
const printData = ref<any>(null);
const isLoading = ref(true);
const qrCodeData = ref<string | null>(null);

const fetchPrintData = async (nomor: string) => {
  isLoading.value = true;
  try {
    const response = await api.get(`/kasir/print-a4/${nomor}`);
    const rawData = response.data;

    // FIX Type Error: Paksa konversi ke Number satu per satu agar TS tidak mengeluh
    if (rawData.summary) {
      const s = rawData.summary;
      // Gunakan casting Number() untuk menghindari error operator '+'
      s.total = Number(s.total || 0);
      s.diskon = Number(s.diskon || 0);
      s.netto = Number(s.netto || 0);
      s.biayaKirim = Number(s.biayaKirim || 0);
      s.grandTotal = Number(s.grandTotal || 0);
      s.bayar = Number(s.bayar || 0);
      s.kembali = Number(s.kembali || 0);
    }

    printData.value = rawData;
    document.title = `Invoice_${nomor}`;

    // Generate QR Code
    qrCodeData.value = await QRCode.toDataURL(nomor, { width: 150, margin: 1 });

    // FIX Print Kosong:
    // 1. Tunggu siklus render Vue selesai
    await nextTick();

    // 2. Beri jeda ekstra agar browser selesai me-render gambar (Logo & QR)
    setTimeout(() => {
      window.print();
    }, 1500);

  } catch (error: any) {
    console.error("Error Detail:", error);
    toast.error("Gagal memuat data cetak.");
  } finally {
    // JANGAN langsung set isLoading = false, biarkan overlay hilang setelah dialog print muncul
    setTimeout(() => { isLoading.value = false; }, 2000);
  }
};

onMounted(() => {
  const nomor = route.params.nomor as string;
  if (nomor) fetchPrintData(nomor);
});
</script>

<template>
  <div class="print-container">
    <div v-if="isLoading">Loading...</div>
    <div v-if="printData" class="page">
      <div class="header">
        <div class="header-left">
          <img src="@/assets/logo.png" class="logo" @load="console.log('Logo loaded')" />
          <div class="company-info">
            <strong>{{ printData?.header?.perusahaanNama }}</strong>
            <div>{{ printData?.header?.perusahaanAlamat }}</div>
            <div>{{ printData?.header?.perusahaanTelp }}</div>
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
          <div class="d-flex">
            <span class="label">Customer</span>
            <span>: {{ printData.header.customer }}</span>
          </div>
          <div class="alamat-detail">{{ printData.header.alamatCustomer }}</div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Kode</th>
            <th>Nama Barang</th>
            <th>Ukuran</th>
            <th>Qty</th>
            <th class="text-end">Harga</th>
            <th class="text-end">Diskon</th>
            <th class="text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in printData?.details" :key="index">
            <td class="text-center">{{ index + 1 }}</td>
            <td>{{ item.kode }}</td>
            <td>{{ item.nama }}</td>
            <td class="text-center">{{ item.ukuran }}</td>
            <td class="text-center">{{ item.qty }}</td>
            <td class="text-end">{{ formatRupiah(item.harga) }}</td>
            <td class="text-end">{{ formatRupiah(item.diskon) }}</td>
            <td class="text-end">{{ formatRupiah(item.total) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer-grid">
        <div class="terbilang"><strong>Terbilang:</strong> <em>{{ printData.terbilang }}</em></div>
        <div class="summary">
          <div class="summary-item"><span>Total :</span> <span>{{ formatRupiah(printData.summary.total) }}</span></div>
          <div class="summary-item"><span>Netto :</span> <span>{{ formatRupiah(printData.summary.netto) }}</span></div>
          <div class="summary-item grand-total"><span>Grand Total :</span> <span>{{
            formatRupiah(printData.summary.grandTotal) }}</span></div>
          <div class="summary-item"><span>Bayar :</span> <span>{{ formatRupiah(printData.summary.bayar) }}</span></div>
          <div class="summary-item"><span>Sisa :</span> <span>{{ formatRupiah(printData.summary.kembali) }}</span></div>
        </div>
      </div>

      <div class="signatures">
        <div class="sig-box">Dibuat Oleh,<br><br><br>( {{ printData.header.userNama }} )</div>
        <div class="sig-box">Mengetahui,<br><br><br>( .................... )</div>
        <div class="sig-box">Customer,<br><br><br>( .................... )</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.print-container {
  background: #f0f0f0;
  padding: 20px 0;
  min-height: 100vh;
}

.page {
  width: 210mm;
  min-height: 297mm;
  padding: 15mm;
  margin: 20px auto;
  background: white;
  font-family: Arial, sans-serif;
  font-size: 9.5pt;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  border: 1px solid #ddd;
}

.header {
  display: flex;
  justify-content: space-between;
  border-bottom: 2px solid #000;
  padding-bottom: 10px;
}

.logo {
  height: 50px;
}

.qr-code {
  height: 60px;
}

.title {
  text-align: center;
  font-size: 16pt;
  font-weight: bold;
  margin: 15px 0;
  text-decoration: underline;
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
  border: 1px solid #000;
  padding: 5px;
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
  border-top: 1px solid #000;
  padding-top: 5px;
  margin-top: 5px;
}

.signatures {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  text-align: center;
  margin-top: 30px;
}

.alamat-detail {
  padding-left: 75px;
  font-size: 9pt;
}
</style>

<style>
@media print {

  html,
  body {
    display: block !important;
    visibility: visible !important;
    height: auto !important;
    overflow: visible !important;
  }

  body {
    background: white !important;
  }

  /* Pastikan root Vue hidup */
  #app,
  #__nuxt,
  .v-application,
  .v-application__wrap {
    display: block !important;
    visibility: visible !important;
    height: auto !important;
  }

  /* Pastikan page tampil */
  .print-container,
  .page {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  }

}
</style>
