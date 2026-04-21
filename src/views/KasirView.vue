<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { format, subDays } from "date-fns";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useRouter } from "vue-router";
import * as XLSX from "xlsx";
import { formatRupiah } from "@/utils/formatRupiah";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import PrintOptionModal from "@/components/PrintOptionModal.vue";
import KasirPrintPreviewModal from "@/components/KasirPrintPreviewModal.vue";
import InvoiceA4PrintPreviewModal from "@/components/InvoiceA4PrintPreviewModal.vue";
import { useBrowse } from "@/composables/useBrowse";

// Store & Konfigurasi
const toast = useToast();
const router = useRouter();
const MENU_ID = "31";

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
    const response = await api.get("/kasir", {
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
const baseBrowseRef = ref<any>(null); // Untuk akses search dari BaseBrowse
const detailsData = ref<Record<string, any[]>>({});
const loadingDetails = ref(new Set<string>()); // Menggunakan Set
const expanded = ref<any[]>([]);

// State Print Modals
const isPrintOptionVisible = ref(false);
const isKasirPreviewVisible = ref(false);
const isA4PreviewVisible = ref(false);
const selectedInvoicePrint = ref<string | null>(null);

// 3. Formatters
const formatCurrency = (value: any) => formatRupiah(value);
const formatNumberLocal = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("id-ID").format(value);
};

// 4. Computed Data Filtered & Grand Total
// Mengambil text search dari BaseBrowse agar Grand Total sinkron dengan pencarian
const searchKeyword = computed(() => baseBrowseRef.value?.search || "");

const filteredData = computed(() => {
  // Tambahkan fallback || [] agar currentItems PASTI array
  const currentItems = items.value || [];

  if (!searchKeyword.value) return currentItems;
  const s = searchKeyword.value.toLowerCase();

  return currentItems.filter(
    (item: any) =>
      item.Nomor?.toLowerCase().includes(s) ||
      item.Nama?.toLowerCase().includes(s) ||
      item.KdCus?.toLowerCase().includes(s),
  );
});

const getTotal = (key: string) => {
  // Tambahkan fallback || []
  const data = filteredData.value || [];

  return data.reduce((acc, item) => {
    return acc + (Number(item[key]) || 0);
  }, 0);
};

// 5. Table Headers (Hapus data-table-expand)
const masterHeaders = [
  { title: "Nomor", key: "Nomor", width: "150px" },
  { title: "Tanggal", key: "Tanggal", width: "110px" },
  { title: "Kd Cus", key: "KdCus", width: "100px" },
  { title: "Customer", key: "Nama", minWidth: "200px" },
  { title: "Alamat", key: "Alamat", minWidth: "250px" },
  { title: "Kota", key: "Kota", width: "120px" },
  { title: "Telp", key: "Telp", width: "120px" },
  { title: "Diskon", key: "Diskon", align: "end" as const, width: "110px" },
  {
    title: "Biaya Kirim",
    key: "BiayaKirim",
    align: "end" as const,
    width: "110px",
  },
  { title: "Nominal", key: "Nominal", align: "end" as const, width: "130px" },
  { title: "Piutang", key: "Piutang", align: "end" as const, width: "130px" },
  { title: "Bayar", key: "Bayar", align: "end" as const, width: "130px" },
  {
    title: "Sisa Piutang",
    key: "SisaPiutang",
    align: "end" as const,
    width: "130px",
  },
  { title: "Rp Tunai", key: "RpTunai", align: "end" as const, width: "110px" },
  { title: "Rp Card", key: "RpCard", align: "end" as const, width: "110px" },
  { title: "No Setoran", key: "NoSetoran", width: "150px" },
  { title: "No Rekening", key: "NoRekening", width: "150px" },
  { title: "Bank", key: "NamaBank", width: "120px" },
  { title: "User Create", key: "Created", width: "120px" },
  { title: "Date Create", key: "Date_Create", width: "150px" },
];

const detailHeaders = [
  { title: "Kode", key: "Kode", width: "120px" },
  { title: "Nama Barang", key: "Nama", minWidth: "250px" },
  { title: "Ukuran", key: "Ukuran", align: "center" as const, width: "80px" },
  { title: "Qty", key: "Jumlah", align: "end" as const, width: "70px" },
  { title: "Harga", key: "Harga", align: "end" as const, width: "110px" },
  { title: "Total", key: "Total", align: "end" as const, width: "120px" },
];

// 6. Custom Row Properties (Warna Merah untuk Piutang)
const getRowProps = (data: any) => {
  const raw = data.item?.raw || data.item;
  if (raw.SisaPiutang !== 0) {
    return { class: "text-error font-weight-bold" };
  }
  return {};
};

// 7. Load Details (Expanded Row menggunakan Set)
const loadDetails = async (newlyExpanded: any[]) => {
  expanded.value = newlyExpanded;
  if (newlyExpanded.length === 0) return;

  const lastItem = newlyExpanded[newlyExpanded.length - 1];
  const nomor = typeof lastItem === "object" ? lastItem.Nomor : lastItem;

  if (!nomor || detailsData.value[nomor] || loadingDetails.value.has(nomor))
    return;

  loadingDetails.value.add(nomor);
  try {
    const response = await api.get(`/kasir/${nomor}/details`);
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail invoice ${nomor}`);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// 8. Navigasi & Aksi
const openNewForm = () => router.push({ name: "KasirBaru" });
const openEditForm = (item: any) =>
  router.push({ name: "KasirUbah", params: { nomor: item.Nomor } });

const openPrintOptions = (nomor: string) => {
  if (!nomor) return toast.error("Pilih invoice terlebih dahulu.");
  selectedInvoicePrint.value = nomor;
  isPrintOptionVisible.value = true;
};

const handlePrintSelection = (type: "a4" | "kasir" | "wa") => {
  if (!selectedInvoicePrint.value) return;
  if (type === "a4") {
    isA4PreviewVisible.value = true;
  } else if (type === "kasir") {
    isKasirPreviewVisible.value = true;
  }
};

const exportHeader = () => {
  // Ambil data dengan fallback || []
  const currentItems = items.value || [];
  const currentFiltered = filteredData.value || [];

  if (currentItems.length === 0)
    return toast.warning("Tidak ada data untuk diekspor.");

  const worksheet = XLSX.utils.json_to_sheet(currentFiltered);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice");
  XLSX.writeFile(workbook, "Export_Invoice_Header.xlsx");
};
</script>

<template>
  <BaseBrowse
    ref="baseBrowseRef"
    v-model:selected="selected"
    item-value="Nomor"
    title="Kasir / Invoice"
    menu-id="31"
    icon="mdi-cash-register"
    search-placeholder="Cari Nomor / Nama..."
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
    :row-props-fn="getRowProps"
    @update:expanded="loadDetails"
    @refresh="fetchData"
    @add="openNewForm"
    @edit="openEditForm"
    @delete="() => {}"
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
      <div
        class="d-flex align-center ml-2"
        title="Terdapat sisa piutang yang belum dibayar"
      >
        <v-icon color="error" size="x-small" class="mr-1">mdi-square</v-icon>
        <span class="text-caption font-weight-bold text-error"
          >Belum Lunas</span
        >
      </div>
    </template>

    <template #extra-actions>
      <v-btn
        size="small"
        color="grey-darken-3"
        :disabled="!isSingleSelected"
        prepend-icon="mdi-printer"
        @click="openPrintOptions(selectedItem?.Nomor)"
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
        </v-list>
      </v-menu>
    </template>

    <template #[`item.Tanggal`]="{ value }">{{
      value ? format(new Date(value), "dd/MM/yyyy") : "-"
    }}</template>
    <template #[`item.Date_Create`]="{ value }">{{
      value ? format(new Date(value), "dd/MM/yyyy HH:mm") : "-"
    }}</template>

    <template
      v-for="col in [
        'Diskon',
        'BiayaKirim',
        'Nominal',
        'Piutang',
        'Bayar',
        'RpTunai',
        'RpCard',
      ]"
      :key="col"
      #[`item.${col}`]="{ value }"
    >
      {{ formatCurrency(value) }}
    </template>

    <template #[`item.SisaPiutang`]="{ value }">
      <span :class="value > 0 ? 'text-error font-weight-bold' : ''">{{
        formatCurrency(value)
      }}</span>
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
        <template #[`item.Jumlah`]="{ value }">{{
          formatNumberLocal(value)
        }}</template>
        <template #[`item.Harga`]="{ value }">{{
          formatCurrency(value)
        }}</template>
        <template #[`item.Total`]="{ value }">
          <span class="text-primary font-weight-bold">{{
            formatCurrency(value)
          }}</span>
        </template>
      </v-data-table>
    </template>

    <template #tfoot>
      <tfoot v-if="(items || []).length > 0">
        <tr class="grand-total-row">
          <td colspan="8" class="text-right font-weight-bold text-primary">
            GRAND TOTAL
          </td>

          <td class="text-right font-weight-bold">
            {{ formatCurrency(getTotal("Diskon")) }}
          </td>
          <td class="text-right font-weight-bold">
            {{ formatCurrency(getTotal("BiayaKirim")) }}
          </td>
          <td class="text-right font-weight-bold">
            {{ formatCurrency(getTotal("Nominal")) }}
          </td>
          <td class="text-right font-weight-bold">
            {{ formatCurrency(getTotal("Piutang")) }}
          </td>
          <td class="text-right font-weight-bold text-primary">
            {{ formatCurrency(getTotal("Bayar")) }}
          </td>
          <td class="text-right font-weight-bold text-error">
            {{ formatCurrency(getTotal("SisaPiutang")) }}
          </td>
          <td class="text-right font-weight-bold">
            {{ formatCurrency(getTotal("RpTunai")) }}
          </td>
          <td class="text-right font-weight-bold">
            {{ formatCurrency(getTotal("RpCard")) }}
          </td>

          <td colspan="5"></td>
        </tr>
      </tfoot>
    </template>
  </BaseBrowse>

  <PrintOptionModal
    v-model="isPrintOptionVisible"
    :options="['a4', 'kasir']"
    @select="handlePrintSelection"
  />

  <KasirPrintPreviewModal
    v-model="isKasirPreviewVisible"
    :nomor-invoice="selectedInvoicePrint"
    @close="isKasirPreviewVisible = false"
  />

  <InvoiceA4PrintPreviewModal
    v-model="isA4PreviewVisible"
    :nomorInvoice="selectedInvoicePrint"
  />
</template>

<style scoped>
.colored-header-sub :deep(thead th) {
  background-color: #455a64 !important;
  color: white !important;
  font-size: 10px !important;
}

.grand-total-row td {
  background-color: #f5f5f5 !important;
  border-top: 2px solid #1976d2 !important;
  height: 32px !important;
}

:deep(.text-error),
:deep(.text-error td) {
  color: #d32f2f !important;
}
</style>
