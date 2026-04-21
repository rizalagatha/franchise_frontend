<script setup lang="ts">
import { ref, watch } from "vue";
import { format, subDays } from "date-fns";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import * as XLSX from "xlsx";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import ConfirmDeleteDialog from "@/components/dialogs/ConfirmDeleteDialog.vue";
import { useBrowse } from "@/composables/useBrowse";

const router = useRouter();
const toast = useToast();

// 1. Filter State
const startDate = ref(format(subDays(new Date(), 6), "yyyy-MM-dd"));
const endDate = ref(format(new Date(), "yyyy-MM-dd"));

// 2. Setup Composable Logic
const browse = useBrowse({
  menuId: "13",
  fetchApi: async () => {
    const res = await api.get("/barcodes", {
      params: { startDate: startDate.value, endDate: endDate.value },
    });
    return res.data;
  },
});

// Auto-refresh jika tanggal diubah
watch([startDate, endDate], browse.fetchData);

// 3. Setup Headers (Hapus kolom expand, BaseBrowse akan menambahkannya di kiri secara otomatis)
const masterHeaders = [
  { title: "Nomor", key: "Nomor", width: "180px" },
  { title: "Tanggal", key: "Tanggal", width: "150px" },
  { title: "Dibuat Oleh", key: "Created" },
];

const detailHeaders = [
  { title: "Kode Barang", key: "Kode", width: "120px" },
  { title: "Barcode", key: "Barcode", width: "130px" },
  { title: "Nama Barang", key: "Nama", minWidth: "300px" },
  { title: "Ukuran", key: "Ukuran", align: "center" as const, width: "80px" },
  { title: "Jumlah", key: "Jumlah", align: "end" as const, width: "100px" },
];

// --- 4. State Expanded & Rincian (Sesuai Standar Baru) ---
const expanded = ref<any[]>([]);
const detailsData = ref<Record<string, any[]>>({});
const loadingDetails = ref(new Set<string>()); // Gunakan Set untuk loadingDetails

const loadDetails = async (newlyExpanded: any[]) => {
  expanded.value = newlyExpanded;
  if (newlyExpanded.length === 0) return;

  const lastItem = newlyExpanded[newlyExpanded.length - 1];
  const nomor = typeof lastItem === "object" ? lastItem.Nomor : lastItem;

  if (!nomor || detailsData.value[nomor] || loadingDetails.value.has(nomor))
    return;

  loadingDetails.value.add(nomor);
  try {
    const res = await api.get(`/barcodes/${nomor}/details`);
    detailsData.value[nomor] = res.data;
  } catch (error) {
    toast.error(`Gagal memuat detail nomor ${nomor}.`);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// 5. Handlers & Aksi
const handleAdd = () => router.push({ name: "CetakBarcodeBaru" });
const handleEdit = (item: any) =>
  router.push(`/daftar/cetak-barcode/ubah/${item.Nomor}`);

// Delete State
const showDeleteDialog = ref(false);
const itemToDelete = ref<any>(null);
const isDeleting = ref(false);

const confirmDelete = (item: any) => {
  itemToDelete.value = item;
  showDeleteDialog.value = true;
};

const executeDelete = async () => {
  isDeleting.value = true;
  try {
    await api.delete(`/barcodes/${itemToDelete.value.Nomor}`);
    toast.success("Data barcode berhasil dihapus.");
    showDeleteDialog.value = false;
    browse.fetchData();
  } catch (error) {
    toast.error("Gagal menghapus data.");
  } finally {
    isDeleting.value = false;
  }
};

const exportData = () => {
  // Berikan fallback array kosong jika undefined
  const currentItems = browse.items.value || [];

  if (currentItems.length === 0)
    return toast.info("Tidak ada data untuk diexport.");

  const dataToExport = currentItems.map((h: any) => ({
    Nomor: h.Nomor,
    Tanggal: h.Tanggal,
    "Dibuat Oleh": h.Created,
  }));

  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "HeadersBarcode");
  XLSX.writeFile(wb, "CetakBarcode_Headers.xlsx");
};
</script>

<template>
  <BaseBrowse
    v-model:selected="browse.selected.value"
    title="Browse Cetak Barcode"
    menu-id="13"
    icon="mdi-barcode-scan"
    item-value="Nomor"
    search-placeholder="Cari Nomor Barcode..."
    :headers="masterHeaders"
    :items="browse.items.value || []"
    :is-loading="browse.isLoading.value"
    :can-insert="browse.canInsert.value"
    :can-edit="browse.canEdit.value"
    :can-delete="browse.canDelete.value"
    :can-export="browse.canExport.value"
    :show-expand="true"
    :expanded="expanded"
    :loading-details="loadingDetails"
    @update:expanded="loadDetails"
    @refresh="browse.fetchData"
    @add="handleAdd"
    @edit="handleEdit"
    @delete="confirmDelete"
    @export="exportData"
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
          style="max-width: 130px"
        ></v-text-field>
        <span class="mx-2 text-grey">-</span>
        <v-text-field
          v-model="endDate"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          class="bg-white"
          style="max-width: 130px"
        ></v-text-field>
      </div>
    </template>

    <template #detail="{ item }">
      <v-data-table
        :headers="detailHeaders"
        :items="detailsData[item.Nomor]"
        density="compact"
        hide-default-footer
        class="detail-table colored-header-sub w-100"
        width="100%"
      >
        <template #[`item.Jumlah`]="{ value }">
          <span class="font-weight-bold text-primary">
            {{ value?.toLocaleString("id-ID") ?? "-" }}
          </span>
        </template>
      </v-data-table>
    </template>
  </BaseBrowse>

  <ConfirmDeleteDialog
    v-model="showDeleteDialog"
    :item-name="`Nomor ${itemToDelete?.Nomor}`"
    :is-loading="isDeleting"
    @confirm="executeDelete"
  />
</template>

<style scoped>
.colored-header-sub :deep(thead th) {
  background-color: #455a64 !important;
  color: white !important;
  font-size: 10px;
  text-transform: uppercase;
}
</style>
