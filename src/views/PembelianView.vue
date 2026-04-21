<script setup lang="ts">
import { ref, watch } from "vue";
import { format, subDays } from "date-fns";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import * as XLSX from "xlsx";
import { formatRupiah } from "@/utils/formatRupiah";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import ConfirmDeleteDialog from "@/components/dialogs/ConfirmDeleteDialog.vue";
import { useBrowse } from "@/composables/useBrowse";

const router = useRouter();
const toast = useToast();

// 1. Filter Periode
const startDate = ref(format(subDays(new Date(), 6), "yyyy-MM-dd"));
const endDate = ref(format(new Date(), "yyyy-MM-dd"));

// 2. Setup Composable Logic
const browse = useBrowse({
  menuId: "22",
  fetchApi: async () => {
    const res = await api.get("/pembelian", {
      params: { startDate: startDate.value, endDate: endDate.value },
    });
    return res.data;
  },
});

// Auto-refresh jika tanggal berubah
watch([startDate, endDate], browse.fetchData);

// 3. Setup Headers (Tanpa data-table-expand)
const masterHeaders = [
  { title: "Nomor", key: "Nomor", width: "180px" },
  { title: "Tanggal", key: "Tanggal", width: "120px" },
  { title: "No. Invoice", key: "NoInvoice", width: "150px" },
  { title: "Tgl Invoice", key: "TglInvoice", width: "120px" },
  {
    title: "Nominal",
    key: "NominalPembelian",
    align: "end" as const,
    width: "150px",
  },
  { title: "Keterangan", key: "Keterangan", minWidth: "200px" },
  { title: "Created", key: "Created", width: "120px" },
];

const detailHeaders = [
  { title: "Kode", key: "Kode", width: "120px" },
  { title: "Nama Barang", key: "Nama", minWidth: "300px" },
  { title: "Ukuran", key: "Ukuran", align: "center" as const, width: "80px" },
  { title: "Jumlah", key: "Jumlah", align: "end" as const, width: "100px" },
  { title: "HPP", key: "Hpp", align: "end" as const, width: "120px" },
  { title: "Total", key: "Total", align: "end" as const, width: "130px" },
];

// 4. State Expanded & Detail (Menggunakan Set)
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
    const res = await api.get(`/pembelian/${nomor}/details`);
    detailsData.value[nomor] = res.data;
  } catch (error) {
    toast.error(`Gagal memuat detail nomor ${nomor}.`);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// 5. Handlers & Actions
const handleAdd = () => router.push({ name: "PembelianBaru" });
const handleEdit = (item: any) =>
  router.push({ name: "PembelianUbah", params: { nomor: item.Nomor } });

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
    await api.delete(`/pembelian/${itemToDelete.value.Nomor}`);
    toast.success("Data pembelian berhasil dihapus.");
    showDelete.value = false;
    browse.fetchData();
  } finally {
    isDeleting.value = false;
  }
};

// --- Export Logic ---
const exportHeader = () => {
  // Tambahkan fallback || [] di sini
  const dataToExport = browse.items.value || [];

  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Header Pembelian");
  XLSX.writeFile(wb, "Export_Pembelian_Header.xlsx");
};

const exportDetail = () => {
  // FIX: Gunakan browse.selected.value[0]
  const sel = browse.selected.value[0];
  if (!sel) return toast.warning("Pilih data terlebih dahulu");
  const data = detailsData.value[sel.Nomor];
  if (!data)
    return toast.warning(
      "Buka detail baris terlebih dahulu agar data ter-load",
    );

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Detail ${sel.Nomor}`);
  XLSX.writeFile(wb, `Detail_Pembelian_${sel.Nomor}.xlsx`);
};
</script>

<template>
  <BaseBrowse
    v-model:selected="browse.selected.value"
    title="Browse Pembelian"
    menu-id="22"
    icon="mdi-cart-arrow-down"
    item-value="Nomor"
    search-placeholder="Cari Pembelian..."
    :headers="masterHeaders"
    :items="browse.items.value || []"
    :is-loading="browse.isLoading.value"
    :can-insert="browse.canInsert.value"
    :can-edit="browse.canEdit.value"
    :can-delete="browse.canDelete.value"
    :show-expand="true"
    :expanded="expanded"
    :loading-details="loadingDetails"
    @update:expanded="loadDetails"
    @refresh="browse.fetchData"
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

    <template #extra-actions>
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
          <v-list-item
            @click="exportDetail"
            :disabled="browse.selected.value.length !== 1"
            ><v-list-item-title
              >Export Detail Terpilih</v-list-item-title
            ></v-list-item
          >
        </v-list>
      </v-menu>
    </template>

    <template #[`item.NominalPembelian`]="{ value }">
      <span class="font-weight-bold text-primary">{{
        formatRupiah(value)
      }}</span>
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
        <template #[`item.Hpp`]="{ value }">{{ formatRupiah(value) }}</template>
        <template #[`item.Total`]="{ value }">
          <span class="font-weight-bold text-primary">{{
            formatRupiah(value)
          }}</span>
        </template>
      </v-data-table>
    </template>
  </BaseBrowse>

  <ConfirmDeleteDialog
    v-model="showDelete"
    :item-name="`Pembelian ${itemToDelete?.Nomor}`"
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
