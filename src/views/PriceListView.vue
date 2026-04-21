<script setup lang="ts">
import { ref } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import * as XLSX from "xlsx";
import BaseBrowse from "@/components/BaseBrowse.vue";
import { useBrowse } from "@/composables/useBrowse";
import PriceUpdateDialog from "@/components/dialogs/PriceUpdateDialog.vue";
import PriceHistoryDialog from "@/components/dialogs/PriceHistoryDialog.vue";

const toast = useToast();

// 1. Inisialisasi Composable Logic
const browse = useBrowse({
  menuId: "12",
  fetchApi: async () => {
    const res = await api.get("/price-list");
    return res.data;
  },
});

const headers = [
  { title: "Kode", key: "Kode", width: "120px" },
  { title: "Barcode", key: "Barcode", width: "130px" },
  { title: "Nama Barang", key: "Nama", minWidth: "300px" },
  { title: "Ukuran", key: "Ukuran", align: "center", width: "80px" },
  { title: "HPP", key: "Hpp", align: "end", width: "120px" },
  { title: "Harga Jual", key: "Harga", align: "end", width: "120px" },
  { title: "Laba", key: "Laba", align: "end", width: "120px" },
  {
    title: "Actions",
    key: "actions",
    sortable: false,
    width: "100px",
    align: "center",
  },
];

// 2. State untuk Dialogs
const showUpdateDialog = ref(false);
const showHistoryDialog = ref(false);
const selectedProduct = ref(null);

const historyData = ref([]);
const isLoadingHistory = ref(false);

const formatCurrency = (value: number | null) => {
  if (value === null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(value);
};

// 3. Handlers
const handleEdit = (item: any) => {
  selectedProduct.value = item;
  showUpdateDialog.value = true;
};

const handleViewHistory = async (item: any) => {
  selectedProduct.value = item;
  showHistoryDialog.value = true;
  isLoadingHistory.value = true;

  try {
    const encodedKode = encodeURIComponent(item.Kode);
    const encodedUkuran = encodeURIComponent(item.Ukuran);
    const res = await api.get(
      `/price-list/${encodedKode}/${encodedUkuran}/history`,
    );
    historyData.value = res.data;
  } catch (error) {
    toast.error("Gagal memuat riwayat harga.");
  } finally {
    isLoadingHistory.value = false;
  }
};

const exportData = () => {
  // 1. Berikan fallback array kosong
  const currentItems = browse.items.value || [];

  if (currentItems.length === 0) return toast.info("Tidak ada data.");

  // 2. Gunakan currentItems untuk mapping
  const dataToExport = currentItems.map((p: any) => ({
    Kode: p.Kode,
    Barcode: p.Barcode,
    "Nama Barang": p.Nama,
    Ukuran: p.Ukuran,
    HPP: p.Hpp,
    "Harga Jual": p.Harga,
    Laba: p.Laba,
  }));

  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "PriceList");
  XLSX.writeFile(wb, "PriceList.xlsx");
};
</script>

<template>
  <BaseBrowse
    v-model:selected="browse.selected.value"
    title="Price List Barang"
    menu-id="12"
    icon="mdi-tag-multiple-outline"
    item-value="Barcode"
    search-placeholder="Cari Barang..."
    :headers="headers"
    :items="browse.items.value || []"
    :is-loading="browse.isLoading.value"
    :can-edit="browse.canEdit.value"
    :can-export="browse.canExport.value"
    @refresh="browse.fetchData"
    @edit="handleEdit"
    @export="exportData"
  >
    <template #[`item.Hpp`]="{ value }">{{ formatCurrency(value) }}</template>
    <template #[`item.Harga`]="{ value }"
      ><span class="font-weight-bold text-primary">{{
        formatCurrency(value)
      }}</span></template
    >
    <template #[`item.Laba`]="{ value }">{{ formatCurrency(value) }}</template>

    <template #[`item.actions`]="{ item }">
      <v-tooltip text="Update Harga" location="top">
        <template v-slot:activator="{ props }">
          <v-icon
            v-bind="props"
            v-if="browse.canEdit.value"
            size="small"
            class="mr-3"
            color="primary"
            @click.stop="handleEdit(item)"
            >mdi-pencil</v-icon
          >
        </template>
      </v-tooltip>
      <v-tooltip text="Riwayat Harga" location="top">
        <template v-slot:activator="{ props }">
          <v-icon
            v-bind="props"
            size="small"
            color="info"
            @click.stop="handleViewHistory(item)"
            >mdi-history</v-icon
          >
        </template>
      </v-tooltip>
    </template>
  </BaseBrowse>

  <PriceUpdateDialog
    v-model="showUpdateDialog"
    :product-data="selectedProduct"
    @saved="browse.fetchData"
  />

  <PriceHistoryDialog
    v-model="showHistoryDialog"
    :history-data="historyData"
    :is-loading="isLoadingHistory"
    :selected-item="selectedProduct"
  />
</template>
