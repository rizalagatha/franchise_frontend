<script setup lang="ts">
import { ref, watch } from "vue";
import { format, subDays } from "date-fns";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useRouter } from "vue-router";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import FskPrintModal from "@/components/FskPrintModal.vue";
import ConfirmDeleteDialog from "@/components/dialogs/ConfirmDeleteDialog.vue";
import { useBrowse } from "@/composables/useBrowse";

// Store & Konfigurasi
const toast = useToast();
const router = useRouter();
const MENU_ID = "32";

// 1. Setup Composable Logic
const {
  items,
  isLoading,
  canInsert,
  canEdit,
  canDelete,
  selected,
  selectedItem,
  isSingleSelected,
  fetchData,
} = useBrowse({
  menuId: MENU_ID,
  fetchApi: async () => {
    const response = await api.get("/fsk", {
      params: { startDate: startDate.value, endDate: endDate.value },
    });
    return response.data;
  },
});

// Filter Tanggal
const startDate = ref(format(subDays(new Date(), 30), "yyyy-MM-dd"));
const endDate = ref(format(new Date(), "yyyy-MM-dd"));
watch([startDate, endDate], fetchData);

// 2. Ref & State Lokal
const detailsData = ref<Record<string, any[]>>({});
const loadingDetails = ref<Set<string>>(new Set());
const expanded = ref<string[]>([]);

// State Modal
const showPrintModal = ref(false);
const printNomor = ref<string | null>(null);
const showDeleteDialog = ref(false);
const isDeleting = ref(false);

// 3. Formatters
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

// 4. Table Headers (Hapus manual data-table-expand)
const masterHeaders = [
  { title: "Nomor", key: "Nomor", width: "180px" },
  { title: "Tgl Setor", key: "TglSetor", width: "120px" },
  { title: "Kasir", key: "Kasir", minWidth: "150px" },
  { title: "Created By", key: "Created", width: "120px" },
  { title: "Modified By", key: "Modified", width: "120px" },
];

const detailHeaders = [
  { title: "Jenis Setoran", key: "Jenis", minWidth: "200px" },
  {
    title: "Nominal Setor",
    key: "NominalSetor",
    align: "end" as const,
    width: "150px",
  },
];

// 5. Load Details (Expanded Row)
const loadDetails = async (newlyExpanded: any[]) => {
  expanded.value = newlyExpanded;
  if (newlyExpanded.length === 0) return;

  const lastItem = newlyExpanded[newlyExpanded.length - 1];
  const nomor = typeof lastItem === "object" ? lastItem.Nomor : lastItem;

  if (!nomor || detailsData.value[nomor] || loadingDetails.value.has(nomor))
    return;

  loadingDetails.value.add(nomor);
  try {
    const response = await api.get(`/fsk/${nomor}/details`);
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail setoran ${nomor}`);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// 6. Navigasi & Aksi
const handleAdd = () => router.push("/transaksi/fsk/baru");
const handleEdit = (item: any) =>
  router.push(`/transaksi/fsk/ubah/${item.Nomor}`);

const handlePrint = () => {
  if (!selectedItem.value) return;
  printNomor.value = selectedItem.value.Nomor;
  showPrintModal.value = true;
};

// Logika Delete
const handleDeleteClick = () => {
  if (selected.value.length > 0) {
    showDeleteDialog.value = true;
  }
};

const confirmDelete = async () => {
  const nomor = selectedItem.value?.Nomor;
  if (!nomor) return;

  isDeleting.value = true;
  try {
    await api.delete(`/fsk/${nomor}`);
    toast.success("Data berhasil dihapus.");
    showDeleteDialog.value = false;
    fetchData(); // Refresh via useBrowse
    selected.value = []; // Clear selection
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menghapus data.");
  } finally {
    isDeleting.value = false;
  }
};
</script>

<template>
  <BaseBrowse
    v-model:selected="selected"
    item-value="Nomor"
    title="Setoran Kasir"
    menu-id="32"
    icon="mdi-bank-transfer"
    search-placeholder="Cari Nomor / Kasir..."
    :headers="masterHeaders"
    :items="items || []"
    :is-loading="isLoading"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="false"
    :show-expand="true"
    :expanded="expanded"
    :loading-details="loadingDetails"
    @update:expanded="loadDetails"
    @refresh="fetchData"
    @add="handleAdd"
    @edit="handleEdit"
    @delete="handleDeleteClick"
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
        color="secondary"
        :disabled="!isSingleSelected"
        prepend-icon="mdi-printer"
        @click="handlePrint"
        class="ml-2"
      >
        Cetak
      </v-btn>
    </template>

    <template #[`item.TglSetor`]="{ value }">
      {{ value ? format(new Date(value), "dd/MM/yyyy") : "-" }}
    </template>

    <template #detail="{ item }">
      <v-data-table
        :headers="detailHeaders"
        :items="detailsData[item.Nomor]"
        density="compact"
        class="detail-table colored-header-sub zebra-table"
        hide-default-footer
        width="100%"
      >
        <template #[`item.NominalSetor`]="{ value }">
          <span class="font-weight-bold text-primary">{{
            formatCurrency(value)
          }}</span>
        </template>
      </v-data-table>
    </template>
  </BaseBrowse>

  <ConfirmDeleteDialog
    v-model="showDeleteDialog"
    :item-name="`Setoran ${selectedItem?.Nomor}`"
    :is-loading="isDeleting"
    @confirm="confirmDelete"
  />

  <FskPrintModal v-model="showPrintModal" :nomor-fsk="printNomor" />
</template>

<style scoped>
.colored-header-sub :deep(thead th) {
  background-color: #455a64 !important;
  color: white !important;
  font-size: 10px !important;
  text-transform: uppercase;
}
</style>
