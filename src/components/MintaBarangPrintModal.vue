<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import logoUrl from "@/assets/logo.png";

const props = defineProps<{ modelValue: boolean; nomor: string }>();
const emit = defineEmits(["update:modelValue"]);
const toast = useToast();

const printData = ref<any>(null);
const isLoading = ref(false);

const loadData = async () => {
  if (!props.modelValue || !props.nomor) return;
  isLoading.value = true;
  try {
    const res = await api.get(`/minta-barang-kaosan/print/${props.nomor}`);
    printData.value = res.data;
  } catch (error) {
    toast.error("Gagal memuat data cetak.");
    emit("update:modelValue", false);
  } finally {
    isLoading.value = false;
  }
};

watch(() => props.modelValue, loadData);

const closePreview = () => emit("update:modelValue", false);

const triggerBrowserPrint = async () => {
  await nextTick();
  const printContent = document.querySelector("#print-area .print-layout");
  if (!printContent) return toast.error("Area cetak tidak ditemukan.");

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  const css = `
    .print-layout { font-family: Arial, sans-serif; font-size: 10pt; width: 210mm; margin: auto; padding: 1cm; color: #000; }
    .print-header { display: flex; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .print-logo { width: 50px; height: 50px; margin-right: 15px; object-fit: contain; }
    .print-title { text-align: center; font-size: 16pt; font-weight: bold; margin: 15px 0; letter-spacing: 1px;}
    .header-table { width: 100%; font-size: 10pt; margin-bottom: 20px; }
    .header-table td { padding: 3px 5px; }
    .detail-table { width: 100%; font-size: 10pt; border-collapse: collapse; margin-bottom: 20px; }
    .detail-table th, .detail-table td { border: 1px solid #000; padding: 6px; }
    .detail-table th { background-color: #f0f0f0; text-align: center; }
    .text-center { text-align: center; }
    .print-footer { margin-top: 40px; display: flex; justify-content: space-around; text-align: center; }
    @page { size: A4 portrait; margin: 1cm; }
  `;
  doc.open();
  doc.write(
    `<html><head><style>${css}</style></head><body>${printContent.outerHTML}</body></html>`,
  );
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    persistent
    max-width="900px"
    scrollable
  >
    <v-card>
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-2 font-weight-bold">
          Pratinjau Cetak Permintaan: {{ nomor }}
        </v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="closePreview"></v-btn>
      </v-toolbar>
      <v-card-text id="print-area" class="pa-4 bg-grey-lighten-4">
        <div v-if="isLoading" class="text-center pa-10">
          <v-progress-circular
            indeterminate
            color="primary"
          ></v-progress-circular>
        </div>
        <div
          v-else-if="printData"
          class="print-layout mx-auto elevation-2 bg-white"
        >
          <header class="print-header">
            <img :src="logoUrl" class="print-logo" />
            <div>
              <h2 style="margin: 0; font-size: 14pt">
                {{ printData.header.perusahaanNama }}
              </h2>
              <div style="font-size: 9pt">
                {{ printData.header.perusahaanAlamat }}
              </div>
            </div>
          </header>

          <div class="print-title">BUKTI PERMINTAAN BARANG</div>

          <table class="header-table">
            <tr>
              <td width="15%"><strong>Nomor</strong></td>
              <td width="2%">:</td>
              <td width="33%">{{ printData.header.nomor }}</td>
              <td width="15%"><strong>Status</strong></td>
              <td width="2%">:</td>
              <td width="33%">{{ printData.header.status }}</td>
            </tr>
            <tr>
              <td><strong>Tanggal</strong></td>
              <td>:</td>
              <td>{{ printData.header.tanggal }}</td>
              <td><strong>Keterangan</strong></td>
              <td>:</td>
              <td>{{ printData.header.keterangan || "-" }}</td>
            </tr>
          </table>

          <table class="detail-table">
            <thead>
              <tr>
                <th width="5%">NO</th>
                <th width="15%">KODE</th>
                <th width="15%">BARCODE</th>
                <th width="35%">NAMA BARANG</th>
                <th width="15%">UKURAN</th>
                <th width="15%">QTY DIMINTA</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in printData.details" :key="idx">
                <td class="text-center">{{ Number(idx) + 1 }}</td>
                <td class="text-center">{{ item.kode }}</td>
                <td class="text-center">{{ item.barcode || "-" }}</td>
                <td>{{ item.nama }}</td>
                <td class="text-center font-weight-bold">{{ item.ukuran }}</td>
                <td class="text-center font-weight-bold">{{ item.qty }} Pcs</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" style="text-align: right; font-weight: bold">
                  TOTAL QTY:
                </td>
                <td class="text-center font-weight-bold">
                  {{ printData.summary.totalQty }} Pcs
                </td>
              </tr>
            </tfoot>
          </table>

          <footer class="print-footer">
            <div>
              Diminta Oleh,<br /><br /><br /><br />(
              {{ printData.header.userNama }} )
            </div>
            <div>
              Disetujui Oleh,<br /><br /><br /><br />( .................... )
            </div>
          </footer>
        </div>
      </v-card-text>
      <v-card-actions class="pa-4 border-t bg-white">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="closePreview">Selesai</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-printer"
          @click="triggerBrowserPrint"
          >Cetak Sekarang</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Scoped styles hanya untuk tampilan di browser, print style ada di string JS */
.print-layout {
  font-family: Arial, sans-serif;
  min-height: 200mm;
  max-width: 210mm;
  padding: 1cm;
  color: #000;
}
.print-header {
  display: flex;
  align-items: center;
  border-bottom: 2px solid #000;
  padding-bottom: 10px;
  margin-bottom: 15px;
}
.print-logo {
  width: 50px;
  height: 50px;
  margin-right: 15px;
  object-fit: contain;
}
.print-title {
  text-align: center;
  font-size: 16pt;
  font-weight: bold;
  margin: 15px 0;
}
.header-table {
  width: 100%;
  margin-bottom: 20px;
  font-size: 10pt;
}
.detail-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  font-size: 10pt;
}
.detail-table th,
.detail-table td {
  border: 1px solid #000;
  padding: 8px;
}
.detail-table th {
  background-color: #f0f0f0;
}
.print-footer {
  margin-top: 40px;
  display: flex;
  justify-content: space-around;
  text-align: center;
  font-size: 10pt;
}
</style>
