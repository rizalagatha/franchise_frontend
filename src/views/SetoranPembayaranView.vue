<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { format, subDays } from "date-fns";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useRouter } from "vue-router";
import { formatRupiah } from "@/utils/formatRupiah";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import ConfirmDeleteDialog from "@/components/dialogs/ConfirmDeleteDialog.vue";
import SetoranPembayaranPrintModal from "@/components/SetoranPembayaranPrintModal.vue";
import { useBrowse } from "@/composables/useBrowse";

const toast = useToast();
const router = useRouter();
const MENU_ID = "33";

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
    const response = await api.get("/setoran-pembayaran", {
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
const expanded = ref<any[]>([]); // Pastikan tipe any[] untuk Vuetify

// State Dialog Cetak & Hapus
const showPrintModal = ref(false);
const printNomor = ref("");
const showDeleteDialog = ref(false);
const isDeleting = ref(false);

// 3. Logika Bisnis: Data otomatis tidak boleh diubah/hapus
const isSelectedOtomatis = computed(() => {
  const item = selectedItem.value;
  return item?.Otomatis === "YA";
});

// 4. Table Headers (Hapus data-table-expand)
const masterHeaders = [
  { title: "Nomor", key: "Nomor", width: "150px" },
  { title: "Tanggal", key: "Tanggal", width: "100px" },
  { title: "Jenis", key: "JenisBayar", width: "100px" },
  { title: "Nominal", key: "Nominal", align: "end" as const, width: "120px" },
  {
    title: "Dibayar",
    key: "diBayarkan",
    align: "end" as const,
    width: "120px",
  },
  { title: "Sisa", key: "Sisa", align: "end" as const, width: "120px" },
  { title: "Customer", key: "Customer", minWidth: "200px" },
  { title: "Bank", key: "NamaBank", width: "120px" },
  {
    title: "Otomatis",
    key: "Otomatis",
    width: "80px",
    align: "center" as const,
  },
];

const detailHeaders = [
  { title: "Inv. Bayar", key: "Invoice", width: "150px" },
  { title: "Tgl Inv", key: "TglInvoice", width: "100px" },
  {
    title: "Nominal Inv",
    key: "Nominal",
    align: "end" as const,
    width: "130px",
  },
  {
    title: "Jumlah Bayar",
    key: "Bayar",
    align: "end" as const,
    width: "130px",
  },
  { title: "Keterangan", key: "Keterangan", minWidth: "200px" },
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
    const res = await api.get(`/setoran-pembayaran/${nomor}/details`);
    detailsData.value[nomor] = res.data;
  } catch (error) {
    toast.error(`Gagal memuat rincian untuk ${nomor}`);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// 6. Logika Pewarnaan Baris
const getRowProps = (data: any) => {
  const raw = data.item?.raw || data.item;
  if (raw.Otomatis === "YA")
    return { class: "text-blue-darken-2 font-weight-bold" };
  if (Number(raw.Sisa) !== 0) return { class: "text-error" };
  return {};
};

// 7. Navigasi & Aksi
const handleAdd = () => router.push("/transaksi/setoran-pembayaran/baru");
const handleEdit = (item: any) => {
  if (isSelectedOtomatis.value)
    return toast.warning("Setoran Otomatis tidak bisa diubah.");
  router.push(`/transaksi/setoran-pembayaran/ubah/${item.Nomor}`);
};

const handlePrint = () => {
  if (!selectedItem.value) return;
  printNomor.value = selectedItem.value.Nomor;
  showPrintModal.value = true;
};

const handleDeleteClick = () => {
  if (isSelectedOtomatis.value)
    return toast.warning("Setoran Otomatis tidak bisa dihapus.");
  if (selected.value.length > 0) showDeleteDialog.value = true;
};

const confirmDelete = async () => {
  if (!selectedItem.value) return;
  isDeleting.value = true;
  try {
    await api.delete(`/setoran-pembayaran/${selectedItem.value.Nomor}`);
    toast.success("Data dihapus.");
    showDeleteDialog.value = false;
    fetchData();
    selected.value = [];
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal hapus.");
  } finally {
    isDeleting.value = false;
  }
};
</script>

<template>
  <BaseBrowse
    v-model:selected="selected"
    item-value="Nomor"
    title="Setoran Pembayaran"
    menu-id="33"
    icon="mdi-cash-register"
    search-placeholder="Cari..."
    :headers="masterHeaders"
    :items="items || []"
    :is-loading="isLoading"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="true"
    :show-expand="true"
    :expanded="expanded"
    :loading-details="loadingDetails"
    :row-props-fn="getRowProps"
    @update:expanded="loadDetails"
    @refresh="fetchData"
    @add="handleAdd"
    @edit="handleEdit"
    @delete="handleDeleteClick"
    @export="() => toast.info('Fitur export sedang disiapkan.')"
  >
    <template #filter-right-prepend>
      <v-text-field
        v-model="startDate"
        type="date"
        label="Mulai"
        density="compact"
        variant="outlined"
        hide-details
        class="mr-2 bg-white"
        style="max-width: 140px"
      ></v-text-field>
      <v-text-field
        v-model="endDate"
        type="date"
        label="Sampai"
        density="compact"
        variant="outlined"
        hide-details
        class="mr-2 bg-white"
        style="max-width: 140px"
      ></v-text-field>
    </template>

    <template #filter-right>
      <div class="d-flex align-center ga-4 ml-2">
        <div
          class="d-flex align-center"
          title="Pembayaran otomatis dari sistem/invoice"
        >
          <v-icon color="blue-darken-2" size="x-small" class="mr-1"
            >mdi-square</v-icon
          >
          <span class="text-caption font-weight-bold text-blue-darken-2"
            >Otomatis</span
          >
        </div>
        <div
          class="d-flex align-center"
          title="Ada sisa pembayaran yang belum dilunasi"
        >
          <v-icon color="error" size="x-small" class="mr-1">mdi-square</v-icon>
          <span class="text-caption font-weight-bold text-error">Ada Sisa</span>
        </div>
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

    <template #[`item.Tanggal`]="{ item }">
      {{
        item.raw?.Tanggal
          ? format(new Date(item.raw.Tanggal), "dd/MM/yyyy")
          : "-"
      }}
    </template>

    <template #[`item.Nominal`]="{ value }">{{ formatRupiah(value) }}</template>
    <template #[`item.diBayarkan`]="{ value }">{{
      formatRupiah(value)
    }}</template>

    <template #[`item.Sisa`]="{ value }">
      <span class="font-weight-bold">{{ formatRupiah(value) }}</span>
    </template>

    <template #[`item.Otomatis`]="{ value }">
      <v-chip
        v-if="value === 'YA'"
        size="x-small"
        color="blue-darken-2"
        variant="flat"
        class="font-weight-bold"
      >
        OTOMATIS
      </v-chip>
      <span v-else>-</span>
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
        <template #[`item.TglInvoice`]="{ value }">
          {{ value ? format(new Date(value), "dd/MM/yy") : "-" }}
        </template>
        <template #[`item.Nominal`]="{ value }">{{
          formatRupiah(value)
        }}</template>
        <template #[`item.Bayar`]="{ value }">
          <span class="text-primary font-weight-bold">{{
            formatRupiah(value)
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

  <SetoranPembayaranPrintModal v-model="showPrintModal" :nomor="printNomor" />
</template>

<style scoped>
.colored-header-sub :deep(thead th) {
  background-color: #455a64 !important;
  color: white !important;
  font-size: 10px !important;
  text-transform: uppercase;
}
:deep(.text-error),
:deep(.text-error td) {
  color: #d32f2f !important;
}
</style>
