<script setup lang="ts">
import { ref, watch } from "vue";
import { format, subDays } from "date-fns";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import * as XLSX from "xlsx";
import logoUrl from "@/assets/logo.png";

// Components
import BaseBrowse from "@/components/BaseBrowse.vue";
import ConfirmDeleteDialog from "@/components/dialogs/ConfirmDeleteDialog.vue";
import { useBrowse } from "@/composables/useBrowse";

const toast = useToast();
const router = useRouter();
const MENU_ID = "23";

// 1. Filter Periode
const startDate = ref(format(subDays(new Date(), 6), "yyyy-MM-dd"));
const endDate = ref(format(new Date(), "yyyy-MM-dd"));

// 2. Destructure Composable
const {
  items,
  isLoading,
  canInsert,
  canEdit,
  canDelete,
  selected,
  isSingleSelected,
  selectedItem,
  fetchData,
} = useBrowse({
  menuId: MENU_ID,
  fetchApi: async () => {
    const res = await api.get("/koreksi-stok", {
      params: { startDate: startDate.value, endDate: endDate.value },
    });
    return res.data;
  },
});

watch([startDate, endDate], fetchData);

// 3. Setup Headers (Hapus manual data-table-expand)
const masterHeaders = [
  { title: "Nomor", key: "Nomor", width: "180px" },
  { title: "Tanggal", key: "Tanggal", width: "120px" },
  { title: "Nominal", key: "Nominal", align: "end" as const, width: "150px" },
  { title: "Keterangan", key: "Keterangan", minWidth: "250px" },
  { title: "Created", key: "Created", width: "120px" },
  { title: "Modified", key: "Modified", width: "120px" },
];

const detailHeaders = [
  { title: "Kode", key: "Kode", width: "120px" },
  { title: "Nama Barang", key: "Nama", minWidth: "300px" },
  { title: "Ukuran", key: "Ukuran", align: "center" as const, width: "80px" },
  { title: "Stok", key: "Stok", align: "end" as const, width: "80px" },
  {
    title: "Jumlah Real",
    key: "Jumlah",
    align: "end" as const,
    width: "100px",
  },
  { title: "Selisih", key: "Selisih", align: "end" as const, width: "80px" },
  { title: "HPP", key: "Hpp", align: "end" as const, width: "120px" },
  { title: "Total", key: "Total", align: "end" as const, width: "130px" },
  { title: "Keterangan", key: "Keterangan", minWidth: "150px" },
];

// 4. Expand Logic (Gunakan Set)
const expanded = ref<any[]>([]);
const detailsData = ref<Record<string, any[]>>({});
const loadingDetails = ref(new Set<string>());

const loadDetails = async (newlyExpanded: any[]) => {
  expanded.value = newlyExpanded;
  if (newlyExpanded.length === 0) return;

  const lastItem = newlyExpanded[newlyExpanded.length - 1];
  const nomor = typeof lastItem === "object" ? lastItem.Nomor : lastItem;

  if (!nomor || detailsData.value[nomor] || loadingDetails.value.has(nomor))
    return;

  loadingDetails.value.add(nomor);
  try {
    const response = await api.get(`/koreksi-stok/${nomor}/details`);
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail nomor ${nomor}.`);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// 5. Aksi Button
const handleAdd = () => router.push({ name: "KoreksiStokBaru" });
const handleEdit = (item: any) =>
  router.push({ name: "KoreksiStokUbah", params: { nomor: item.Nomor } });

const showDelete = ref(false);
const itemToDelete = ref<any>(null);
const isDeleting = ref(false);

const confirmDelete = (item: any) => {
  itemToDelete.value = item;
  showDelete.value = true;
};

const executeDelete = async () => {
  isDeleting.value = true;
  try {
    await api.delete(`/koreksi-stok/${itemToDelete.value.Nomor}`);
    toast.success("Data koreksi berhasil dihapus.");
    showDelete.value = false;
    fetchData();
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal menghapus data.");
  } finally {
    isDeleting.value = false;
  }
};

// 6. Print & Export
const isPrintPreviewVisible = ref(false);
const printPreviewData = ref<any>(null);

const handlePrint = async (nomor: string) => {
  try {
    const response = await api.get(`/koreksi-stok/print/${nomor}`);
    printPreviewData.value = response.data;
    isPrintPreviewVisible.value = true;
  } catch (error) {
    toast.error("Gagal mengambil data cetak.");
  }
};

const triggerBrowserPrint = () => {
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
    .print-layout { font-family: Arial, sans-serif; font-size: 9pt; width: 210mm; margin: auto; padding: 1cm; color: #000; }
    .print-header { display: flex; align-items: center; margin-bottom: 10px; }
    .print-logo { width: 45px; height: 45px; object-fit: contain; margin-right: 12px; } /* FIX UKURAN LOGO */
    .print-title { text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px; }
    .header-table { width: 60%; font-size: 9pt; margin-bottom: 15px; border-collapse: collapse; }
    .detail-table-print { width: 100%; font-size: 9pt; border-collapse: collapse; }
    .detail-table-print th, .detail-table-print td { border: 1px solid #000; padding: 3px 5px; }
    .text-end { text-align: right; }
    .print-footer { margin-top: 20px; display: flex; justify-content: space-around; text-align: center; }
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

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(v || 0);

const formatNumber = (v: number) =>
  new Intl.NumberFormat("id-ID").format(v || 0);

const exportHeader = () => {
  // Tambahkan fallback || [] di sini
  const dataToExport = items.value || [];

  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Header Koreksi");
  XLSX.writeFile(wb, "Export_Koreksi_Header.xlsx");
};

const exportDetail = () => {
  if (!selectedItem.value || !detailsData.value[selectedItem.value.Nomor])
    return toast.warning("Buka detail baris terlebih dahulu.");

  // Tambahkan fallback || [] di sini
  const dataToExport = detailsData.value[selectedItem.value.Nomor] || [];

  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Detail ${selectedItem.value.Nomor}`);
  XLSX.writeFile(wb, `Detail_Koreksi_${selectedItem.value.Nomor}.xlsx`);
};
</script>

<template>
  <BaseBrowse
    v-model:selected="selected"
    title="Browse Koreksi Stok"
    menu-id="23"
    icon="mdi-clipboard-edit-outline"
    item-value="Nomor"
    search-placeholder="Cari Koreksi Stok..."
    :headers="masterHeaders"
    :items="items || []"
    :is-loading="isLoading"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :show-expand="true"
    :expanded="expanded"
    :loading-details="loadingDetails"
    @update:expanded="loadDetails"
    @refresh="fetchData"
    @add="handleAdd"
    @edit="handleEdit"
    @delete="confirmDelete"
  >
    <template #filter-right-prepend>
      <div class="d-flex align-center mr-4">
        <span class="text-caption font-weight-bold text-grey-darken-1 mr-2"
          >Periode:</span
        >
        <v-text-field
          v-model="startDate"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          class="bg-white"
          style="max-width: 140px"
        ></v-text-field>
        <span class="mx-2 text-grey">-</span>
        <v-text-field
          v-model="endDate"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          class="bg-white"
          style="max-width: 140px"
        ></v-text-field>
      </div>
    </template>

    <template #extra-actions>
      <v-btn
        size="small"
        color="grey-darken-3"
        prepend-icon="mdi-printer"
        :disabled="!isSingleSelected"
        @click="handlePrint(selectedItem.Nomor)"
        class="ml-2"
        >Cetak</v-btn
      >

      <v-menu offset-y>
        <template v-slot:activator="{ props }">
          <v-btn
            size="small"
            color="green"
            prepend-icon="mdi-file-excel"
            v-bind="props"
            class="ml-2"
            >Export</v-btn
          >
        </template>
        <v-list density="compact">
          <v-list-item @click="exportHeader"
            ><v-list-item-title>Export Header</v-list-item-title></v-list-item
          >
          <v-list-item @click="exportDetail" :disabled="!isSingleSelected"
            ><v-list-item-title
              >Export Detail Terpilih</v-list-item-title
            ></v-list-item
          >
        </v-list>
      </v-menu>
    </template>

    <template #[`item.Nominal`]="{ value }">
      <span
        :class="value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''"
        class="font-weight-bold"
      >
        {{ formatCurrency(value) }}
      </span>
    </template>

    <template #detail="{ item }">
      <v-data-table
        :headers="detailHeaders"
        :items="detailsData[item.Nomor]"
        density="compact"
        hide-default-footer
        class="detail-table colored-header-sub zebra-table"
        width="100%"
      >
        <template #[`item.Stok`]="{ value }">{{
          formatNumber(value)
        }}</template>
        <template #[`item.Jumlah`]="{ value }">{{
          formatNumber(value)
        }}</template>
        <template #[`item.Selisih`]="{ value }">
          <span
            :class="value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''"
            class="font-weight-bold"
            >{{ formatNumber(value) }}</span
          >
        </template>
        <template #[`item.Hpp`]="{ value }">{{
          formatCurrency(value)
        }}</template>
        <template #[`item.Total`]="{ value }">
          <span class="font-weight-bold text-primary">{{
            formatCurrency(value)
          }}</span>
        </template>
      </v-data-table>
    </template>
  </BaseBrowse>

  <ConfirmDeleteDialog
    v-model="showDelete"
    :item-name="`Koreksi ${itemToDelete?.Nomor}`"
    :is-loading="isDeleting"
    @confirm="executeDelete"
  />

  <v-dialog
    v-model="isPrintPreviewVisible"
    max-width="900px"
    scrollable
    persistent
  >
    <v-card>
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-2 font-weight-bold"
          >Pratinjau Cetak Koreksi:
          {{ printPreviewData?.header?.nomor }}</v-toolbar-title
        >
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="isPrintPreviewVisible = false"></v-btn>
      </v-toolbar>
      <v-card-text id="print-area" class="pa-4 bg-grey-lighten-4">
        <div v-if="printPreviewData" class="print-layout mx-auto elevation-2">
          <header class="print-header">
            <img
              :src="logoUrl"
              class="print-logo"
              style="
                width: 45px;
                height: 45px;
                object-fit: contain;
                margin-right: 12px;
              "
            />
            <div class="company-info">
              <strong>{{ printPreviewData.header.perusahaanNama }}</strong
              ><br />
              <span>{{ printPreviewData.header.perusahaanAlamat }}</span
              ><br />
              <span>Telp: {{ printPreviewData.header.perusahaanTelp }}</span>
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
                <th>Nama Barang</th>
                <th>Ukuran</th>
                <th>Stok</th>
                <th>Koreksi</th>
                <th>Selisih</th>
                <th>Nominal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in printPreviewData.details" :key="d.no">
                <td>{{ d.no }}</td>
                <td>{{ d.nama }}</td>
                <td class="text-center">{{ d.ukuran }}</td>
                <td class="text-end">{{ formatNumber(d.stok) }}</td>
                <td class="text-end">{{ formatNumber(d.koreksi) }}</td>
                <td class="text-end">{{ formatNumber(d.selisih) }}</td>
                <td class="text-end">{{ formatCurrency(d.nominal) }}</td>
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
              </tr>
            </tfoot>
          </table>
          <footer class="print-footer">
            <div>
              Dibuat Oleh,<br /><br /><br />(
              {{ printPreviewData.header.userNama }} )
            </div>
            <div>Mengetahui,<br /><br /><br />( .................... )</div>
          </footer>
        </div>
      </v-card-text>
      <v-card-actions class="pa-4 border-t bg-white">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="isPrintPreviewVisible = false"
          >Tutup</v-btn
        >
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
.colored-header-sub :deep(thead th) {
  background-color: #455a64 !important;
  color: white !important;
  font-size: 10px;
  text-transform: uppercase;
}

/* Print layout (internal web) styling */
.print-layout {
  background-color: white;
  padding: 2cm;
  width: 210mm; /* A4 width */
  min-height: 297mm; /* A4 height */
  margin: 0 auto;
}
.print-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 2px solid #000;
  padding-bottom: 10px;
}
.print-title {
  text-align: center;
  font-size: 16pt;
  font-weight: bold;
  margin-bottom: 20px;
}
.header-table {
  width: 100%;
  font-size: 10pt;
  margin-bottom: 20px;
  border-collapse: collapse;
}
.detail-table-print {
  width: 100%;
  font-size: 10pt;
  border-collapse: collapse;
  margin-bottom: 30px;
}
.detail-table-print th,
.detail-table-print td {
  border: 1px solid #000;
  padding: 6px;
}
.print-footer {
  margin-top: 40px;
  display: flex;
  justify-content: space-between;
  text-align: center;
  font-size: 10pt;
  padding: 0 40px;
}
</style>
