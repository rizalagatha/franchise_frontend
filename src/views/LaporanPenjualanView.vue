<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { format, subDays, parseISO } from "date-fns";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import * as XLSX from "xlsx";
import { formatRupiah } from "@/utils/formatRupiah";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import CabangSearchModal from "@/components/lookup/CabangSearchModal.vue";
import { useBrowse } from "@/composables/useBrowse";

const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = "52";

// --- State ---
const filterStartDate = ref(format(subDays(new Date(), 30), "yyyy-MM-dd"));
const filterEndDate = ref(format(new Date(), "yyyy-MM-dd"));
const filterCabang = ref(authStore.user?.cabang || "F03");
const namaCabang = ref(authStore.user?.cabangNama || "KAOSAN.OFFICIAL");
const showCabangModal = ref(false);
const baseBrowseRef = ref<any>(null);

// Pilihan Group By
const groupByOptions = [
  { title: "Tanggal", value: "tanggal" },
  { title: "Invoice", value: "invoice" },
  { title: "Customer", value: "customer" },
];
const selectedGroupBy = ref("tanggal");

// 1. Setup Composable Logic
const { items, isLoading, fetchData } = useBrowse({
  menuId: MENU_ID,
  fetchApi: async () => {
    if (!filterCabang.value) return [];
    const response = await api.get("/laporan-penjualan", {
      params: {
        startDate: filterStartDate.value,
        endDate: filterEndDate.value,
        cabang: filterCabang.value,
        groupBy: selectedGroupBy.value,
      },
    });
    return response.data;
  },
});

// 2. Dynamic Headers
const headers = computed(() => {
  const financialCols = [
    { title: "Nominal", key: "Nominal", align: "end" as const, width: "130px" },
    { title: "HPP", key: "Hpp", align: "end" as const, width: "130px" },
    { title: "Laba", key: "Laba", align: "end" as const, width: "130px" },
    {
      title: "Pundi Amal",
      key: "PundiAmal",
      align: "end" as const,
      width: "120px",
    },
  ];

  if (selectedGroupBy.value === "tanggal") {
    return [
      { title: "KODE", key: "Kode", width: "80px" },
      { title: "TANGGAL", key: "Tanggal", width: "120px" },
      ...financialCols,
    ];
  } else if (selectedGroupBy.value === "invoice") {
    return [
      { title: "KODE", key: "Kode", width: "80px" },
      { title: "NO. INVOICE", key: "Invoice", width: "150px" },
      { title: "TANGGAL", key: "Tanggal", width: "100px" },
      { title: "KDCUS", key: "KdCus", width: "100px" },
      { title: "NAMA CUSTOMER", key: "Customer", minWidth: "200px" },
      ...financialCols,
    ];
  } else {
    // customer
    return [
      { title: "KDCUS", key: "KdCus", width: "100px" },
      { title: "NAMA CUSTOMER", key: "Nama", minWidth: "200px" },
      { title: "ALAMAT", key: "Alamat", minWidth: "200px" },
      { title: "KOTA", key: "Kota", width: "120px" },
      ...financialCols,
    ];
  }
});

// 3. Formatting & Helpers - FIX: Anti Error Invalid Date
const safeFormatDate = (val: any) => {
  if (!val) return "-";
  // Jika formatnya sudah dd-mm-yyyy atau dd/mm/yyyy, langsung balikkan saja
  if (
    typeof val === "string" &&
    (val.includes("-") || val.includes("/")) &&
    val.length <= 10 &&
    !val.includes("T")
  ) {
    return val;
  }
  try {
    const date = typeof val === "string" ? parseISO(val) : new Date(val);
    return format(date, "dd/MM/yyyy");
  } catch (e) {
    return val;
  }
};

const searchKeyword = computed(() => baseBrowseRef.value?.search || "");
const filteredData = computed(() => {
  const currentItems = items.value || []; // <--- Tambahkan fallback di sini

  if (!searchKeyword.value) return currentItems;
  const s = searchKeyword.value.toLowerCase();

  return currentItems.filter(
    (item: any) =>
      (item.Invoice || "").toLowerCase().includes(s) ||
      (item.Customer || item.Nama || "").toLowerCase().includes(s) ||
      (item.KdCus || "").toLowerCase().includes(s),
  );
});

const getTotal = (key: string) => {
  const data = filteredData.value || []; // <--- Tambahkan fallback di sini
  return data.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
};

// 4. Handlers
const onCabangSelected = (cabang: any) => {
  filterCabang.value = cabang.Kode;
  namaCabang.value = cabang.Nama;
  fetchData();
};

watch([filterStartDate, filterEndDate, selectedGroupBy], () => {
  fetchData();
});

const handleExport = () => {
  const dataToExport = filteredData.value || []; // <--- Tambahkan fallback di sini

  if (dataToExport.length === 0)
    return toast.warning("Tidak ada data untuk diekspor.");

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");
  XLSX.writeFile(workbook, `Laporan_Penjualan_${selectedGroupBy.value}.xlsx`);
};

onMounted(() => {
  if (authStore.can(MENU_ID, "view")) fetchData();
});
</script>

<template>
  <BaseBrowse
    ref="baseBrowseRef"
    :key="selectedGroupBy"
    title="Laporan Penjualan (Invoice)"
    menu-id="52"
    icon="mdi-receipt-text-outline"
    search-placeholder="Cari..."
    :headers="headers"
    :items="items || []"
    :is-loading="isLoading"
    :can-insert="false"
    :can-edit="false"
    :can-delete="false"
    :can-export="true"
    :hide-checkbox="true"
    @refresh="fetchData"
    @export="handleExport"
  >
    <template #filter-left>
      <div class="d-flex flex-column w-100 ga-2">
        <div class="d-flex align-center flex-wrap ga-2">
          <span class="text-caption font-weight-bold text-grey-darken-1"
            >Tanggal:</span
          >
          <v-text-field
            v-model="filterStartDate"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            class="input-date bg-white"
          />
          <span class="text-caption text-grey-darken-1">sd</span>
          <v-text-field
            v-model="filterEndDate"
            type="date"
            density="compact"
            variant="outlined"
            hide-details
            class="input-date bg-white"
          />

          <v-divider vertical class="mx-2"></v-divider>

          <span class="text-caption font-weight-bold text-grey-darken-1"
            >Cabang:</span
          >
          <div class="d-flex align-center">
            <v-text-field
              v-model="filterCabang"
              density="compact"
              variant="outlined"
              hide-details
              readonly
              class="input-kode-cabang bg-white"
              @click="showCabangModal = true"
            />
            <v-btn
              icon="mdi-magnify"
              size="x-small"
              variant="tonal"
              color="primary"
              class="mx-1"
              @click="showCabangModal = true"
            ></v-btn>
            <v-text-field
              v-model="namaCabang"
              density="compact"
              variant="outlined"
              hide-details
              readonly
              class="input-nama-cabang bg-grey-lighten-3 text-grey-darken-1"
            />
          </div>
        </div>

        <div class="d-flex align-center border-t pt-2 mt-1">
          <span class="text-caption font-weight-bold mr-4 text-primary"
            >TAMPILKAN BERDASARKAN:</span
          >
          <v-radio-group
            v-model="selectedGroupBy"
            inline
            hide-details
            density="compact"
            class="group-by-radio"
          >
            <v-radio
              v-for="opt in groupByOptions"
              :key="opt.value"
              :label="opt.title"
              :value="opt.value"
              color="primary"
            ></v-radio>
          </v-radio-group>
        </div>
      </div>
    </template>

    <template #[`item.Tanggal`]="{ value }">{{
      safeFormatDate(value)
    }}</template>
    <template #[`item.Nominal`]="{ value }">{{ formatRupiah(value) }}</template>
    <template #[`item.Hpp`]="{ value }">{{ formatRupiah(value) }}</template>
    <template #[`item.PundiAmal`]="{ value }">{{
      formatRupiah(value)
    }}</template>
    <template #[`item.Laba`]="{ value }">
      <span
        class="font-weight-bold"
        :class="value < 0 ? 'text-error' : 'text-success'"
      >
        {{ formatRupiah(value) }}
      </span>
    </template>

    <template #tfoot>
      <tfoot v-if="(items || []).length > 0">
        <tr class="grand-total-row">
          <td
            :colspan="headers.length - 4"
            class="text-right font-weight-black text-primary"
          >
            GRAND TOTAL
          </td>
          <td class="text-right font-weight-bold">
            {{ formatRupiah(getTotal("Nominal")) }}
          </td>
          <td class="text-right font-weight-bold">
            {{ formatRupiah(getTotal("Hpp")) }}
          </td>
          <td
            class="text-right font-weight-bold"
            :class="getTotal('Laba') < 0 ? 'text-error' : 'text-success'"
          >
            {{ formatRupiah(getTotal("Laba")) }}
          </td>
          <td class="text-right font-weight-bold">
            {{ formatRupiah(getTotal("PundiAmal")) }}
          </td>
        </tr>
      </tfoot>
    </template>
  </BaseBrowse>

  <CabangSearchModal
    v-model="showCabangModal"
    @cabang-selected="onCabangSelected"
  />
</template>

<style scoped>
/* Search Bar Internal BaseBrowse dipaksa lebar 250px */
:deep(.filter-section .v-text-field:last-of-type) {
  max-width: 250px !important;
  flex: none !important;
}

.input-date {
  max-width: 130px;
}
.input-kode-cabang {
  max-width: 70px;
}
.input-kode-cabang :deep(input) {
  text-align: center;
  font-weight: bold;
  cursor: pointer;
}
.input-nama-cabang {
  width: 250px;
}
.group-by-radio :deep(label) {
  font-size: 11px !important;
  font-weight: bold;
}
.grand-total-row td {
  background-color: #f5f5f5 !important;
  border-top: 2px solid #1976d2 !important;
  height: 32px !important;
}
</style>
