<script setup lang="ts">
import { ref } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import * as XLSX from "xlsx";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import StandarStokFormDialog from "@/components/dialogs/StandarStokFormDialog.vue"; // Import Dialog
import { useBrowse } from "@/composables/useBrowse";

const toast = useToast();
const MENU_ID = "24";

// 1. Setup Composable Logic
const { items, isLoading, canEdit, selected, isSingleSelected, fetchData } =
  useBrowse({
    menuId: MENU_ID,
    fetchApi: async () => {
      const res = await api.get("/standart-stok");
      return res.data;
    },
  });

// 2. Setup Headers
const headers = [
  { title: "Barcode", key: "Barcode", width: "150px" },
  { title: "Nama Barang", key: "Nama", minWidth: "300px" },
  { title: "Ukuran", key: "Ukuran", align: "center" as const, width: "100px" },
  {
    title: "Min Buffer",
    key: "MinBuffer",
    align: "end" as const,
    width: "120px",
  },
  {
    title: "Max Buffer",
    key: "MaxBuffer",
    align: "end" as const,
    width: "120px",
  },
  { title: "Stok Real", key: "Stok", align: "end" as const, width: "120px" },
];

// 3. State Dialog & Helper Edit
const isEditDialogOpen = ref(false);
const selectedItemData = ref<any>(null);

const openEdit = () => {
  const target = selected.value[0];
  if (!target) return;
  selectedItemData.value = target; // Kirim data ke dialog
  isEditDialogOpen.value = true; // Buka dialog
};

// 4. Export & Formatting
const exportToExcel = () => {
  // 1. Kasih fallback array kosong di sini
  const currentItems = items.value || [];

  if (currentItems.length === 0)
    return toast.warning("Tidak ada data untuk diekspor.");

  // 2. Gunakan currentItems untuk di-map
  const dataToExport = currentItems.map((i: any) => ({
    Barcode: i.Barcode,
    "Nama Barang": i.Nama,
    Ukuran: i.Ukuran,
    "Min Buffer": i.MinBuffer,
    "Max Buffer": i.MaxBuffer,
    "Stok Saat Ini": i.Stok,
    Status: i.Stok < i.MinBuffer ? "RE-STOCK" : "AMAN",
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Standar Stok");
  XLSX.writeFile(workbook, "Standar_Stok_Report.xlsx");
};

const formatNumber = (v: number | null | undefined) =>
  new Intl.NumberFormat("id-ID").format(v || 0);

// Logika Mewarnai Baris Merah
const getRowTextColor = (data: any) => {
  const raw = data.item?.raw || data.item;
  if (raw.Stok < raw.MinBuffer) {
    return { class: "text-error font-weight-bold" };
  }
  return {};
};
</script>

<template>
  <BaseBrowse
    v-model:selected="selected"
    item-value="Barcode"
    title="Standar Stok (Buffer)"
    menu-id="24"
    icon="mdi-database-outline"
    search-placeholder="Cari Barang / Barcode..."
    :headers="headers"
    :items="items || []"
    :is-loading="isLoading"
    :can-edit="false"
    :can-delete="false"
    :can-insert="false"
    :row-props-fn="getRowTextColor"
    @refresh="fetchData"
  >
    <template #filter-right>
      <div class="d-flex align-center border rounded px-2 py-1 bg-white mr-2">
        <v-badge color="error" dot class="mr-2"></v-badge>
        <span
          class="text-caption font-weight-bold text-error"
          style="font-size: 10px !important"
          >Stok di bawah Min Buffer</span
        >
      </div>
    </template>

    <template #extra-actions>
      <v-btn
        v-if="canEdit"
        size="small"
        color="primary"
        :disabled="!isSingleSelected"
        @click="openEdit()"
        prepend-icon="mdi-cog"
      >
        Setting (F1)
      </v-btn>
      <v-btn
        size="small"
        color="green"
        @click="exportToExcel"
        prepend-icon="mdi-file-excel"
        class="ml-2"
      >
        Export
      </v-btn>
    </template>

    <template #[`item.MinBuffer`]="{ value }">{{
      formatNumber(value)
    }}</template>
    <template #[`item.MaxBuffer`]="{ value }">{{
      formatNumber(value)
    }}</template>
    <template #[`item.Stok`]="{ value }">
      <span class="font-weight-black">{{ formatNumber(value) }}</span>
    </template>
  </BaseBrowse>

  <StandarStokFormDialog
    v-model="isEditDialogOpen"
    :item-data="selectedItemData"
    @saved="fetchData"
  />
</template>

<style scoped>
:deep(.text-error),
:deep(.text-error td) {
  color: #d32f2f !important;
}
</style>
