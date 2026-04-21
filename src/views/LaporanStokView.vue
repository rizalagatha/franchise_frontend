<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { format } from "date-fns";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import * as XLSX from "xlsx";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import CabangSearchModal from "@/components/lookup/CabangSearchModal.vue";
import { useBrowse } from "@/composables/useBrowse";

const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = "51";

// 1. Filter State (Specific for Laporan)
const filterTanggal = ref(format(new Date(), "yyyy-MM-dd"));
const filterCabang = ref(authStore.user?.cabang || "F03");
const namaCabang = ref(authStore.user?.cabangNama || "KAOSAN.OFFICIAL");
const tampilKosong = ref(false);
const showCabangModal = ref(false);
const baseBrowseRef = ref<any>(null); // Akses search BaseBrowse

// 2. Setup Composable Logic
const { items, isLoading, fetchData } = useBrowse({
  menuId: MENU_ID,
  fetchApi: async () => {
    if (!filterCabang.value) {
      toast.warning("Pilih cabang terlebih dahulu.");
      return [];
    }
    const response = await api.get("/laporan-stok", {
      params: {
        tanggal: filterTanggal.value,
        cabang: filterCabang.value,
        tampilKosong: tampilKosong.value,
      },
    });
    return response.data;
  },
});

// Auto refresh ketika checkbox kosong dicentang/uncentang
watch(tampilKosong, fetchData);

// 3. Array Ukuran Dinamis (Sesuai Urutan Delphi)
const sizes = [
  "ALLSIZE",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
  "7XL",
  "8XL",
  "9XL",
  "10XL",
  "OVERSIZE",
  "JUMBO",
  "S2",
  "S4",
  "S6",
  "S8",
  "S10",
  "S12",
];

// 4. Setup Headers
const headers = [
  { title: "Kode", key: "Kode", width: "120px" },
  { title: "Nama Barang", key: "NamaBarang", minWidth: "300px" },
  ...sizes.map((size) => ({
    title: size === "OVERSIZE" ? "OVERSZ" : size,
    key: size,
    align: "end" as const,
    width: "60px",
  })),
  { title: "TOTAL", key: "Total", align: "end" as const, width: "90px" },
];

// 5. Computed Filter Data (Untuk Sinkronisasi Search)
const searchKeyword = computed(() => baseBrowseRef.value?.search || "");
const filteredData = computed(() => {
  const currentItems = items.value || []; // <--- Tambahkan fallback

  if (!searchKeyword.value) return currentItems;

  const s = searchKeyword.value.toLowerCase();
  return currentItems.filter(
    (item: any) =>
      item.Kode?.toLowerCase().includes(s) ||
      item.NamaBarang?.toLowerCase().includes(s),
  );
});

// 6. Helper Methods
const onCabangSelected = (cabang: any) => {
  filterCabang.value = cabang.Kode;
  namaCabang.value = cabang.Nama;
  fetchData();
};

const handleExport = () => {
  const currentItems = items.value || []; // <--- Tambahkan fallback
  const dataToExport = filteredData.value || []; // <--- Tambahkan fallback

  if (currentItems.length === 0) return toast.warning("Data kosong.");

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Stok");
  XLSX.writeFile(
    workbook,
    `Stok_${filterCabang.value}_${filterTanggal.value}.xlsx`,
  );
};

const formatStok = (val: any) => {
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return "-";
  return new Intl.NumberFormat("id-ID").format(num);
};

const getRowClass = (data: any) => {
  const raw = data.item?.raw || data.item;
  if (raw?.Total < 0) return { class: "text-error font-weight-bold" };
  return {};
};

const getTotal = (key: string) => {
  const data = filteredData.value || []; // <--- Tambahkan fallback

  return data.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
};
</script>

<template>
  <BaseBrowse
    ref="baseBrowseRef"
    title="Laporan Stok"
    menu-id="51"
    icon="mdi-file-chart-outline"
    search-placeholder="Cari Barang..."
    :headers="headers"
    :items="items || []"
    :is-loading="isLoading"
    :can-insert="false"
    :can-edit="false"
    :can-delete="false"
    :can-export="true"
    :hide-checkbox="true"
    :row-props-fn="getRowClass"
    @refresh="fetchData"
    @export="handleExport"
    class="stok-laporan-wrapper"
  >
    <template #filter-left>
      <div class="d-flex align-center filter-row-custom">
        <span class="text-caption font-weight-bold mr-2 text-grey-darken-1"
          >Tanggal:</span
        >
        <v-text-field
          v-model="filterTanggal"
          type="date"
          density="compact"
          variant="outlined"
          hide-details
          class="mr-4 bg-white input-date"
          @change="fetchData"
        />

        <span class="text-caption font-weight-bold mr-2 text-grey-darken-1"
          >Cabang:</span
        >
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
          class="mr-4 input-nama-cabang bg-grey-lighten-3 text-grey-darken-1"
        />

        <v-checkbox-btn
          v-model="tampilKosong"
          label="Tampilkan Stok Kosong"
          density="compact"
          hide-details
          color="primary"
          class="text-caption font-weight-medium"
        ></v-checkbox-btn>
      </div>
    </template>

    <template v-for="size in sizes" :key="size" #[`item.${size}`]="{ value }">
      <span :class="value < 0 ? 'text-error' : ''">{{
        formatStok(value)
      }}</span>
    </template>

    <template #[`item.Total`]="{ value }">
      <span class="font-weight-black text-primary">{{
        formatStok(value)
      }}</span>
    </template>

    <template #tfoot>
      <tfoot v-if="(items || []).length > 0">
        <tr class="grand-total-row">
          <td colspan="2" class="text-right text-primary font-weight-black">
            GRAND TOTAL
          </td>
          <td
            v-for="size in sizes"
            :key="`total-${size}`"
            class="text-right text-primary font-weight-bold"
          >
            {{ formatStok(getTotal(size)) }}
          </td>
          <td class="text-right font-weight-black text-blue-darken-4">
            {{ formatStok(getTotal("Total")) }}
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
/* 1. Modifikasi BaseBrowse agar search field tidak terlalu panjang */
:deep(.filter-section .v-text-field) {
  max-width: 200px !important;
}

/* 2. Custom Filter Inputs */
.filter-row-custom {
  white-space: nowrap;
}
.input-date {
  max-width: 130px;
}
.input-kode-cabang {
  max-width: 70px;
  cursor: pointer;
}
.input-kode-cabang :deep(input) {
  cursor: pointer;
  text-align: center;
  font-weight: bold;
}
.input-nama-cabang {
  max-width: 350px !important; /* Diperlebar agar nama perusahaan tidak terpotong */
  width: 350px;
}

/* 3. Customisasi khusus tabel Pivot Stok agar rapat seperti Delphi */
.stok-laporan-wrapper :deep(th),
.stok-laporan-wrapper :deep(td) {
  padding: 0 6px !important;
  font-size: 10px !important; /* Font lebih kecil karena kolom sangat banyak */
}

.grand-total-row td {
  background-color: #f5f5f5 !important;
  border-top: 2px solid #1976d2 !important;
  height: 32px !important;
}
</style>
