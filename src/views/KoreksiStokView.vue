<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import type { VDataTableHeaders } from "vuetify/components";
import { format, subDays } from "date-fns";
import api from "@/services/api";
import PageLayout from "@/components/PageLayout.vue";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "vue-router";
import * as XLSX from "xlsx";
import type { AxiosError } from "axios";
import logoUrl from "@/assets/logo.png";

// Store & composables
const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();
const MENU_ID = "23";

// Interface Data Header
interface KoreksiHeader {
  Nomor: string;
  Tanggal: string;
  Nominal: number; // Dihitung di backend
  Keterangan: string;
  Created: string;
  Modified: string;
}

// Interface Data Detail
interface KoreksiDetail {
  Nomor: string;
  Kode: string;
  Nama: string;
  Ukuran: string;
  Stok: number;
  Jumlah: number;
  Selisih: number;
  Hpp: number;
  Total: number;
  Keterangan: string;
}

// --- State ---
const headersData = ref<KoreksiHeader[]>([]);
const detailsData = ref<{ [key: string]: KoreksiDetail[] }>({});
const selected = ref<KoreksiHeader[]>([]);
const isLoadingHeaders = ref(true);
const loadingDetails = ref<Set<string>>(new Set());
const expanded = ref<string[]>([]);
const search = ref("");

// State Filter Tanggal (Default 1 minggu terakhir)
const startDate = ref(format(subDays(new Date(), 6), "yyyy-MM-dd"));
const endDate = ref(format(new Date(), "yyyy-MM-dd"));

// State Dialog Konfirmasi Hapus
const confirmDeleteDialogVisible = ref(false);
const itemToDelete = ref<KoreksiHeader | null>(null);
const isDeleting = ref(false);

// State Print
const isPrintPreviewVisible = ref(false);
const printPreviewData = ref<{
  header: any;
  details: any[];
  totalNominal: number;
  createdInfo: string;
} | null>(null);
const isPrinting = ref(false);

// Hak akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, "view"));
const canInsert = computed(() => authStore.can(MENU_ID, "insert"));
const canEdit = computed(() => authStore.can(MENU_ID, "edit"));
const canDelete = computed(() => authStore.can(MENU_ID, "delete"));
const isSingleSelected = computed(() => selected.value.length === 1);

// Format Angka
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("id-ID").format(value);
};

// Header Tabel Master (Sesuai Delphi)
const masterHeaders: any[] = [
  // Ganti ke any[] untuk menghindari konflik tipe internal
  { title: "Nomor", key: "Nomor", width: "180px" },
  { title: "Tanggal", key: "Tanggal", width: "120px" },
  { title: "Nominal", key: "Nominal", align: "end", width: "150px" },
  { title: "Keterangan", key: "Keterangan", minWidth: "250px" },
  { title: "Created", key: "Created", width: "120px" },
  { title: "Modified", key: "Modified", width: "120px" },
  { title: "", key: "data-table-expand", width: "40px", align: "end" },
];

// Header Tabel Detail (Sesuai Delphi)
const detailHeaders: any[] = [
  { title: "Kode", key: "Kode", width: "120px" },
  { title: "Nama Barang", key: "Nama", width: "300px" },
  { title: "Ukuran", key: "Ukuran", align: "center", width: "80px" },
  { title: "Stok", key: "Stok", align: "end", width: "80px" },
  { title: "Jumlah Real", key: "Jumlah", align: "end", width: "100px" },
  { title: "Selisih", key: "Selisih", align: "end", width: "80px" },
  { title: "HPP", key: "Hpp", align: "end", width: "120px" },
  { title: "Total", key: "Total", align: "end", width: "130px" },
  { title: "Keterangan", key: "Keterangan", minWidth: "150px" },
];

// --- Methods ---
const fetchHeadersData = async () => {
  isLoadingHeaders.value = true;
  selected.value = [];
  expanded.value = [];
  detailsData.value = {};
  try {
    const response = await api.get("/koreksi-stok", {
      params: { startDate: startDate.value, endDate: endDate.value },
    });
    headersData.value = response.data;
  } catch (error) {
    toast.error("Gagal memuat data koreksi stok.");
    console.error(error);
  } finally {
    isLoadingHeaders.value = false;
  }
};

const fetchDetailsData = async (nomor: string) => {
  loadingDetails.value.add(nomor);
  try {
    const response = await api.get(`/koreksi-stok/${nomor}/details`);
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail untuk nomor ${nomor}.`);
    // PERBAIKAN: Bandingkan h langsung sebagai string [cite: 2026-03-09]
    expanded.value = expanded.value.filter((h) => h !== nomor);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// Watcher untuk memuat detail
watch(
  expanded,
  (newExpandedIds) => {
    if (newExpandedIds.length > 0) {
      const lastNomor = newExpandedIds[newExpandedIds.length - 1];

      // PERBAIKAN: Gunakan guard 'if (lastNomor)' untuk memastikan tipe data adalah string [cite: 2026-03-09]
      if (
        lastNomor &&
        !detailsData.value[lastNomor] &&
        !loadingDetails.value.has(lastNomor)
      ) {
        fetchDetailsData(lastNomor);
      }
    }
  },
  { deep: true },
);
// Navigasi
const openNewForm = () => {
  router.push({ name: "KoreksiStokBaru" });
};
const openEditForm = (item?: KoreksiHeader) => {
  const itemToEdit = item || selected.value[0];
  if (!itemToEdit) return; // Guard clause jika undefined
  router.push({
    name: "KoreksiStokUbah",
    params: { nomor: itemToEdit.Nomor },
  });
};

// Hapus
const confirmDelete = (item?: KoreksiHeader) => {
  const itemToDeleteVal = item || selected.value[0];
  if (!itemToDeleteVal) return;
  itemToDelete.value = itemToDeleteVal;
  confirmDeleteDialogVisible.value = true;
};

const executeDelete = async () => {
  if (!itemToDelete.value) return;
  isDeleting.value = true;
  try {
    const nomor = itemToDelete.value.Nomor;
    await api.delete(`/koreksi-stok/${nomor}`);
    toast.success(`Data koreksi ${nomor} berhasil dihapus.`);
    fetchHeadersData(); // Muat ulang data master
  } catch (error: unknown) {
    const err = error as AxiosError<{ message?: string }>;
    toast.error(err.response?.data?.message || "Gagal menghapus data.");
  } finally {
    isDeleting.value = false;
    confirmDeleteDialogVisible.value = false;
    itemToDelete.value = null;
  }
};

// Export (Header)
const exportHeaderData = () => {
  if (headersData.value.length === 0)
    return toast.warning("Tidak ada data header untuk diekspor.");
  const dataToExport = headersData.value.map((h) => ({
    Nomor: h.Nomor,
    Tanggal: h.Tanggal,
    Nominal: h.Nominal,
    Keterangan: h.Keterangan,
    Created: h.Created,
    Modified: h.Modified,
  }));
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Header Koreksi");
  XLSX.writeFile(workbook, "Export_Koreksi_Header.xlsx");
};

// Export (Detail)
const exportDetailData = () => {
  if (!isSingleSelected.value) {
    return toast.warning(
      "Pilih satu header koreksi untuk mengekspor detailnya.",
    );
  }
  const target = selected.value[0];
  if (!target) return; // Type Guard

  const selectedNomor = target.Nomor;
  const detailToExport = detailsData.value[selectedNomor];

  if (!detailToExport || detailToExport.length === 0) {
    if (!loadingDetails.value.has(selectedNomor)) {
      toast.info("Mengambil data detail, silakan coba export lagi...");
      fetchDetailsData(selectedNomor);
    }
    return toast.warning(
      "Data detail belum dimuat. Buka detailnya lalu coba lagi.",
    );
  }

  const dataToExport = detailToExport.map((d) => ({
    Nomor: d.Nomor,
    Kode: d.Kode,
    "Nama Barang": d.Nama,
    Ukuran: d.Ukuran,
    "Stok Sistem": d.Stok,
    "Jumlah Real": d.Jumlah,
    Selisih: d.Selisih,
    HPP: d.Hpp,
    Total: d.Total,
    Keterangan: d.Keterangan,
  }));
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Detail ${selectedNomor}`);
  XLSX.writeFile(workbook, `Detail_Koreksi_${selectedNomor}.xlsx`);
};

// Cetak (Placeholder)
const printData = () => {
  const target = selected.value[0];
  if (!isSingleSelected.value || !target) {
    toast.warning("Pilih satu data koreksi untuk dicetak.");
    return;
  }
  handlePrint(target.Nomor);
};

const handlePrint = async (nomor: string) => {
  isPrinting.value = true;
  try {
    const response = await api.get(`/koreksi-stok/print/${nomor}`);
    printPreviewData.value = response.data;
    isPrintPreviewVisible.value = true;
  } catch (error) {
    toast.error("Gagal mengambil data cetak.");
  } finally {
    isPrinting.value = false;
  }
};

const closePrintPreview = () => {
  isPrintPreviewVisible.value = false;
  printPreviewData.value = null;
};

// Memicu print browser
const triggerBrowserPrint = () => {
  const printContent = document.querySelector("#print-area .print-layout"); // ✅ perbaiki selektor
  if (!printContent) {
    console.error("Area cetak tidak ditemukan.");
    toast.error("Area cetak tidak ditemukan.");
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  // ✅ Sisipkan CSS langsung
  const css = `
    .print-layout body, .print-layout div, .print-layout p, .print-layout h1, .print-layout table, .print-layout td, .print-layout th {
    margin: 0;
    padding: 0;
    box-sizing: border-box; /* Pastikan padding/border tidak menambah ukuran elemen */
    }
    .print-layout {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      width: 210mm;
      margin: auto;
      padding: 1cm;
      color: #000;
    }
    .print-header { display: flex; align-items: center; font-size: 8pt; margin-bottom: 10px; }
    .logo-container { display: flex; align-items: center; }
    .print-logo { width: 35px; height: 35px; margin-right: 8px; flex-shrink: 0; }
    .company-info { font-size: 8pt; line-height: 1.2; }
    .company-info strong { font-size: 10pt; }
    .print-title { text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px; }
    .header-table { width: 60%; max-width: 400px; font-size: 9pt; margin-bottom: 15px; border-collapse: collapse; }
    .header-table td { padding: 1px 0; vertical-align: top; }
    .header-table td:first-child { width: auto; white-space: nowrap; padding-right: 5px; }
    .header-table td:nth-child(2) { width: 10px; padding-right: 5px; }
    .header-table td:nth-child(3) { width: 100%; }
    .detail-table-print { width: 100%; font-size: 9pt; border-collapse: collapse; margin-top: 10px; }
    .detail-table-print th, .detail-table-print td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; }
    .detail-table-print th { background-color: #f0f0f0; text-align: center; }
    .text-end { text-align: right; }
    .font-weight-bold { font-weight: bold; }
    .print-footer { margin-top: 20px; display: flex; justify-content: space-around; text-align: center; font-size: 9pt; page-break-inside: avoid; }
    @page { size: A4 portrait; margin: 1cm; }
  `;

  doc.open();
  doc.write(`
    <html>
      <head>
        <title>Cetak Koreksi Stok</title>
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

const handleRowClick = (
  event: PointerEvent,
  { item }: { item: KoreksiHeader },
) => {
  // Toggle selection: jika diklik baris yang sama, maka lepas. Jika beda, pilih yang baru.
  if (selected.value.length > 0 && selected.value[0].Nomor === item.Nomor) {
    selected.value = [];
  } else {
    selected.value = [item];
  }
};

// Ambil data awal
onMounted(() => {
  if (hasViewPermission.value) {
    fetchHeadersData();
  } else {
    isLoadingHeaders.value = false;
    toast.error("Anda tidak memiliki izin untuk melihat halaman ini.");
  }
});

// Watcher untuk filter tanggal
watch([startDate, endDate], (newDates, oldDates) => {
  if (newDates[0] !== oldDates[0] || newDates[1] !== oldDates[1]) {
    fetchHeadersData();
  }
});
</script>

<template>
  <PageLayout
    title="Browse Koreksi Stok"
    :menu-id="MENU_ID"
    icon="mdi-clipboard-edit-outline"
  >
    <!-- Tombol Header -->
    <template #header-actions>
      <v-btn
        v-if="canInsert"
        size="small"
        color="primary"
        @click="openNewForm"
        prepend-icon="mdi-plus"
        >Baru</v-btn
      >
      <v-btn
        v-if="canEdit"
        size="small"
        :disabled="!isSingleSelected"
        @click="openEditForm()"
        prepend-icon="mdi-pencil"
        >Ubah</v-btn
      >
      <v-btn
        v-if="canDelete"
        size="small"
        color="error"
        :disabled="!isSingleSelected"
        @click="confirmDelete()"
        prepend-icon="mdi-delete"
        >Hapus</v-btn
      >
      <v-btn
        v-if="hasViewPermission"
        size="small"
        @click="printData"
        prepend-icon="mdi-printer"
        >Cetak</v-btn
      >
      <v-menu offset-y>
        <template v-slot:activator="{ props }">
          <v-btn
            size="small"
            color="green"
            prepend-icon="mdi-file-excel"
            v-bind="props"
            >Export</v-btn
          >
        </template>
        <v-list density="compact">
          <v-list-item @click="exportHeaderData"
            ><v-list-item-title>Export Header</v-list-item-title></v-list-item
          >
          <v-list-item @click="exportDetailData" :disabled="!isSingleSelected"
            ><v-list-item-title>Export Detail</v-list-item-title></v-list-item
          >
        </v-list>
      </v-menu>
    </template>

    <!-- Konten Utama (Browse) -->
    <div v-if="hasViewPermission" class="browse-content">
      <!-- Filter Section -->
      <div class="filter-section">
        <span class="filter-label mr-2">Filter Periode:</span>
        <v-text-field
          v-model="startDate"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 160px"
          class="mr-2"
        ></v-text-field>
        <span>s/d</span>
        <v-text-field
          v-model="endDate"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 160px"
          class="ml-2"
        ></v-text-field>
        <v-text-field
          v-model="search"
          density="compact"
          label="Cari..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          hide-details
          single-line
          class="ml-4"
        ></v-text-field>
        <v-spacer></v-spacer>
        <v-btn
          @click="fetchHeadersData"
          icon="mdi-refresh"
          variant="text"
          size="small"
          :disabled="isLoadingHeaders"
          aria-label="Refresh Data"
        ></v-btn>
      </div>

      <!-- Table Container -->
      <div class="table-container">
        <v-data-table
          v-model:expanded="expanded"
          v-model="selected"
          :headers="masterHeaders"
          :items="headersData"
          :search="search"
          :loading="isLoadingHeaders"
          item-value="Nomor"
          density="compact"
          class="desktop-table fill-height-table colored-header"
          fixed-header
          show-select
          return-object
          show-expand
          select-strategy="single"
          @click:row="handleRowClick"
          :items-per-page="50"
        >
          <!-- Format Kolom Nominal -->
          <template #[`item.Nominal`]="{ value }">
            <span
              :class="
                value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''
              "
            >
              {{ formatCurrency(value) }}
            </span>
          </template>

          <!-- Slot untuk Expanded Row (Tabel Detail) -->
          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="expanded-detail-cell">
                <div class="detail-container">
                  <div class="detail-table-wrapper elevation-1">
                    <div
                      v-if="loadingDetails.has(item.Nomor)"
                      class="text-center py-6"
                    >
                      <v-progress-circular
                        indeterminate
                        size="28"
                        width="3"
                        color="primary"
                      ></v-progress-circular>
                      <div
                        class="mt-2 text-primary font-weight-bold"
                        style="font-size: 11px"
                      >
                        Memuat detail...
                      </div>
                    </div>

                    <v-data-table
                      v-else-if="item?.Nomor && detailsData[item.Nomor]?.length"
                      :headers="detailHeaders"
                      :items="detailsData[item.Nomor]"
                      density="compact"
                      class="detail-table colored-header-sub zebra-table"
                      :items-per-page="-1"
                      hide-default-footer
                    >
                      <template #[`item.Stok`]="{ value }">{{
                        formatNumber(value)
                      }}</template>
                      <template #[`item.Jumlah`]="{ value }">{{
                        formatNumber(value)
                      }}</template>
                      <template #[`item.Selisih`]="{ value }">
                        <span
                          class="font-weight-bold"
                          :class="
                            value > 0
                              ? 'text-success'
                              : value < 0
                                ? 'text-error'
                                : ''
                          "
                        >
                          {{ formatNumber(value) }}
                        </span>
                      </template>
                      <template #[`item.Hpp`]="{ value }">{{
                        formatCurrency(value)
                      }}</template>
                      <template #[`item.Total`]="{ value }">
                        <span
                          class="font-weight-bold"
                          :class="
                            value > 0
                              ? 'text-success'
                              : value < 0
                                ? 'text-error'
                                : ''
                          "
                        >
                          {{ formatCurrency(value) }}
                        </span>
                      </template>
                    </v-data-table>

                    <div v-else class="text-center py-4 text-caption text-grey">
                      Tidak ada data detail item ditemukan.
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <template v-slot:loading>
            <div class="text-center py-10">
              <v-progress-circular
                indeterminate
                color="primary"
                size="32"
                width="3"
              ></v-progress-circular>
              <div
                class="mt-2 text-primary font-weight-bold"
                style="font-size: 11px"
              >
                Menarik data koreksi...
              </div>
            </div>
          </template>

          <template v-slot:no-data>
            <div class="text-center pa-4">
              Tidak ada data koreksi stok untuk periode ini.
            </div>
          </template>
        </v-data-table>
      </div>
    </div>

    <!-- Tampilan Akses Ditolak -->
    <div v-else class="state-container">
      <v-icon size="64" class="mb-4">mdi-lock-outline</v-icon>
      <h3 class="text-h6">Akses Ditolak</h3>
      <p>Anda tidak memiliki izin untuk melihat halaman ini.</p>
    </div>

    <!-- Dialog Konfirmasi Hapus -->
    <v-dialog v-model="confirmDeleteDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-delete-alert-outline</v-icon>
          Konfirmasi Hapus
        </v-card-title>
        <v-card-text>
          Yakin ingin menghapus data koreksi
          <strong>{{ itemToDelete?.Nomor }}</strong
          >?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="confirmDeleteDialogVisible = false"
            :disabled="isDeleting"
            >Batal</v-btn
          >
          <v-btn
            color="error"
            variant="elevated"
            @click="executeDelete"
            :loading="isDeleting"
            :disabled="isDeleting"
            >Ya, Hapus</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="isPrintPreviewVisible"
      persistent
      max-width="90vw"
      max-height="90vh"
      scrollable
    >
      <v-card class="d-flex flex-column" style="height: 100%">
        <v-toolbar color="primary" density="compact">
          <v-toolbar-title
            >Cetak Koreksi Stok:
            {{ printPreviewData?.header?.nomor }}</v-toolbar-title
          >
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" @click="closePrintPreview"></v-btn>
        </v-toolbar>

        <v-card-text id="print-area" class="pa-4 flex-grow-1">
          <div v-if="printPreviewData" class="print-layout">
            <header class="print-header">
              <div class="logo-container">
                <img :src="logoUrl" alt="Logo" class="print-logo" />
                <div class="company-info">
                  <strong>{{ printPreviewData.header.perusahaanNama }}</strong
                  ><br />
                  <span>{{ printPreviewData.header.perusahaanAlamat }}</span
                  ><br />
                  <span>{{ printPreviewData.header.perusahaanTelp }}</span>
                </div>
              </div>
            </header>
            <h1 class="print-title">Koreksi Stok</h1>
            <table class="header-table">
              <tr>
                <td>Nomor</td>
                <td>: {{ printPreviewData.header.nomor }}</td>
              </tr>
              <tr>
                <td>Tanggal</td>
                <td>: {{ printPreviewData.header.tanggal }}</td>
              </tr>
              <tr>
                <td>Keterangan</td>
                <td>: {{ printPreviewData.header.keterangan }}</td>
              </tr>
            </table>

            <table class="detail-table-print">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama</th>
                  <th>Ukuran</th>
                  <th>Stok</th>
                  <th>Koreksi</th>
                  <th>Selisih</th>
                  <th>Nominal</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in printPreviewData.details" :key="item.no">
                  <td>{{ item.no }}</td>
                  <td>{{ item.nama }}</td>
                  <td>{{ item.ukuran }}</td>
                  <td class="text-end">{{ formatNumber(item.stok) }}</td>
                  <td class="text-end">{{ formatNumber(item.koreksi) }}</td>
                  <td class="text-end">{{ formatNumber(item.selisih) }}</td>
                  <td class="text-end">{{ formatCurrency(item.nominal) }}</td>
                  <td>{{ item.keterangan }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="text-end font-weight-bold">
                    Total Nominal:
                  </td>
                  <td class="text-end font-weight-bold">
                    {{ formatCurrency(printPreviewData.totalNominal) }}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <footer class="print-footer">
              <div>
                Dibuat Oleh,<br /><br /><br />(
                {{ printPreviewData.header.userNama }} )
              </div>
              <div>Mengetahui,<br /><br /><br />( .................... )</div>
              <div>Manager,<br /><br /><br />( .................... )</div>
            </footer>
          </div>
        </v-card-text>

        <v-divider></v-divider>
        <v-card-actions class="flex-shrink-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closePrintPreview">Tutup</v-btn>
          <v-btn
            color="primary"
            @click="triggerBrowserPrint"
            prepend-icon="mdi-printer"
          >
            Cetak via Browser
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </PageLayout>
</template>

<style scoped>
/* 1. Paksa Konsistensi Font 11px */
.browse-content :deep(*) {
  font-size: 11px !important;
}

/* 2. Layout Dasar */
.browse-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.filter-section {
  flex-shrink: 0;
}

.table-container {
  flex-grow: 1;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

/* --- 3. KONSISTENSI BIRU (PRIMARY) --- */

/* Header Tabel Master */
.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}

/* Header Tabel Detail (Abu-abu Gelap) */
.colored-header-sub :deep(thead th) {
  background-color: #455a64 !important;
  color: white !important;
  font-size: 10px !important;
}

/* Checkbox Header Putih */
.colored-header :deep(thead .v-checkbox-btn .v-selection-control__wrapper) {
  color: white !important;
}

/* Highlight Baris Dipilih */
.desktop-table :deep(tr.v-data-table__selected) {
  background-color: #e3f2fd !important;
}

/* Hover Effect */
.desktop-table :deep(tbody tr:hover),
.zebra-table :deep(tbody tr:hover) {
  cursor: pointer;
  background-color: #f5f5f5 !important;
}

/* Zebra Striping Tabel Detail */
.zebra-table :deep(tbody tr:nth-of-type(odd)) {
  background-color: #fcfcfc !important;
}

/* --- 4. EXPANDED DETAIL STYLING --- */
.expanded-detail-cell {
  padding: 0 !important;
  background-color: #f8f9fa;
}

.detail-container {
  padding: 10px 16px 10px 60px; /* Indentasi agar rapi */
}

.detail-table-wrapper {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background-color: white;
}

/* Pastikan Scroll Tabel Aman */
.desktop-table {
  height: 100%;
}

.desktop-table :deep(.v-table__wrapper) {
  height: 100%;
  overflow-y: auto;
}

.state-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>

<style>
/* Reset margin/padding default */
.print-layout body,
.print-layout div,
.print-layout p,
.print-layout h1,
.print-layout table,
.print-layout td,
.print-layout th {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  /* Pastikan padding/border tidak menambah ukuran elemen */
}

.print-layout {
  font-family: "Arial", sans-serif;
  font-size: 9pt;
  /* Ukuran font umum */
  width: 210mm;
  /* A4 width */
  min-height: 297mm;
  /* A4 height */
  padding: 15mm;
  /* Margin A4 */
  background-color: white;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.print-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
}

.logo-container {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.print-logo {
  width: 35px;
  height: 35px;
  margin-right: 8px;
  flex-shrink: 0;
}

.company-info {
  font-size: 8pt;
  line-height: 1.2;
}

.company-info strong {
  font-size: 10pt;
}

.print-title {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  text-decoration: underline;
  margin-top: 5px;
  margin-bottom: 15px;
}

.header-table {
  width: 60%;
  max-width: 400px;
  font-size: 9pt;
  margin-bottom: 15px;
  border-collapse: collapse;
}

.header-table td {
  padding: 1px 0;
  vertical-align: top;
}

.header-table td:first-child {
  width: auto;
  white-space: nowrap;
  padding-right: 5px;
}

.header-table td:nth-child(2) {
  width: 10px;
  padding-right: 5px;
}

.header-table td:nth-child(3) {
  width: 100%;
}

.detail-table-print {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}

.detail-table-print th,
.detail-table-print td {
  border: 1px solid #000;
  padding: 4px 6px;
  /* Kurangi padding sel */
  text-align: left;
  font-size: 8pt;
  /* Ukuran font detail */
}

.detail-table-print th {
  background-color: #f0f0f0;
  font-weight: bold;
  text-align: center;
  /* Header tabel tengah */
}

.detail-table-print .text-end {
  text-align: right;
}

.detail-table-print .font-weight-bold {
  font-weight: bold;
}

.detail-table-print tfoot td {
  font-weight: bold;
  background-color: #f0f0f0;
}

.detail-table-print tfoot td:first-child {
  text-align: right;
}

.created-info {
  font-size: 7pt;
  /* Ukuran font lebih kecil */
  font-style: italic;
  margin-top: 5px;
  /* Kurangi jarak dari tabel */
  margin-bottom: 10px;
  /* Jarak ke footer */
}

.print-footer {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  /* Rata bawah */
  margin-top: auto;
  /* Dorong footer ke bawah (jika konten pendek) */
  padding-top: 20px;
  /* Jarak atas untuk garis */
  font-size: 8pt;
  /* Ukuran font tanda tangan */
}

.print-footer > div {
  text-align: center;
  width: 30%;
  /* Beri lebar agar terdistribusi */
  line-height: 1.2;
}

.print-footer > div:not(:last-child) {
  margin-right: 10px;
  /* Kurangi jarak antar kolom ttd */
}

.print-footer br {
  line-height: 1.5;
  /* Kontrol jarak baris di ttd */
}

/* Aturan khusus untuk browser print */
@media print {
  body * {
    visibility: hidden;
  }

  /* Targetkan ID unik */
  #print-area-browse,
  #print-area-browse * {
    visibility: visible;
  }

  #print-area-browse {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  /* Halaman print tanpa margin, elemen print-layout yang mengatur margin */
  @page {
    size: A4 portrait;
    margin: 0;
  }

  /* Penting: Set margin ke 0 */

  /* Reset background dan shadow untuk cetak */
  #print-area-browse > .print-layout {
    box-shadow: none;
    border: none;
    padding: 15mm;
    /* Terapkan padding A4 di sini */
  }
}
</style>
