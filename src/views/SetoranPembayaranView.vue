<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import type { VDataTableHeaders } from "vuetify/components";
import { format, subDays } from "date-fns";
import api from "@/services/api";
import PageLayout from "@/components/PageLayout.vue";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "vue-router";
import { formatRupiah } from "@/utils/formatRupiah";
import SetoranPembayaranPrintModal from "@/components/SetoranPembayaranPrintModal.vue";

const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();
const MENU_ID = "33";

// --- State ---
const masterData = ref<any[]>([]);
const detailsData = ref<Record<string, any[]>>({});
const selected = ref<any[]>([]);
const expanded = ref<string[]>([]);
const isLoading = ref(true);
const search = ref("");
const showPrintModal = ref(false);
const printNomor = ref("");

const startDate = ref(format(subDays(new Date(), 30), "yyyy-MM-dd"));
const endDate = ref(format(new Date(), "yyyy-MM-dd"));

// Hak Akses
const canInsert = computed(() => authStore.can(MENU_ID, "insert"));
const canEdit = computed(() => authStore.can(MENU_ID, "edit"));
const canDelete = computed(() => authStore.can(MENU_ID, "delete"));
const isSingleSelected = computed(
  () => selected.value && selected.value.length === 1,
);

// Logika Bisnis: Data otomatis tidak boleh diubah/hapus
const isSelectedOtomatis = computed(() => {
  const item = selected.value?.[0];
  if (!item) return false;
  // Cek jika item adalah objek (Otomatis) atau cari di masterData jika item hanya string Nomor
  const fullItem =
    typeof item === "object"
      ? item
      : masterData.value.find((d) => d.Nomor === item);
  return fullItem?.Otomatis === "YA";
});

const masterHeaders: any[] = [
  { title: "Nomor", key: "Nomor", width: "150px", fixed: true },
  { title: "Tanggal", key: "Tanggal", width: "100px" },
  { title: "Jenis", key: "JenisBayar", width: "100px" },
  { title: "Nominal", key: "Nominal", align: "end", width: "120px" },
  { title: "Dibayar", key: "diBayarkan", align: "end", width: "120px" },
  { title: "Sisa", key: "Sisa", align: "end", width: "120px" },
  { title: "Customer", key: "Customer", minWidth: "200px" },
  { title: "Bank", key: "NamaBank", width: "120px" },
  { title: "Otomatis", key: "Otomatis", width: "80px", align: "center" },
  { title: "", key: "data-table-expand" },
];

// --- Methods ---

const fetchData = async () => {
  isLoading.value = true;
  try {
    const response = await api.get("/setoran-pembayaran", {
      params: { startDate: startDate.value, endDate: endDate.value },
    });
    masterData.value = response.data;
  } catch (error) {
    toast.error("Gagal memuat data setoran.");
  } finally {
    isLoading.value = false;
  }
};

const fetchDetails = async (payload: any) => {
  // 1. Guard clause: Jika payload kosong, batalkan
  if (!payload) return;

  // 2. Ekstrak nomor dengan sangat aman menggunakan Optional Chaining (?.)
  // Vuetify bisa saja mengirim: String, Object Mentah (payload.Nomor), atau Wrapper (payload.raw.Nomor)
  const nomor =
    typeof payload === "string"
      ? payload
      : payload?.raw?.Nomor || payload?.Nomor;

  // 3. Guard clause: Jika nomor tidak ditemukan atau rincian sudah ada, batalkan
  if (!nomor || detailsData.value[nomor]) return;

  try {
    const res = await api.get(`/setoran-pembayaran/${nomor}/details`);
    detailsData.value[nomor] = res.data;
  } catch (error) {
    toast.error(`Gagal memuat rincian untuk ${nomor}`);
  }
};

// Logika Pewarnaan Baris
const getRowTextColor = (item: any) => {
  if (item.Otomatis === "YA") return "text-blue-darken-2 font-weight-bold"; // Biru jika otomatis
  if (Number(item.Sisa) !== 0) return "text-red-darken-2"; // Merah jika belum lunas
  return "";
};

// Fungsi ini yang akan disuntikkan ke tabel untuk mengatur kelas (warna) tiap baris
const myRowProps = (data: any) => {
  // Ambil data mentah dengan aman
  const rawItem = data.item?.raw || data.item;
  return {
    class: getRowTextColor(rawItem),
    style: "cursor: pointer", // Biar kursor jadi tangan saat di-hover
  };
};

const handleEdit = () => {
  // Gunakan optional chaining untuk keamanan
  const item = selected.value?.[0];

  if (item && item.Nomor) {
    console.log("Navigasi ke:", item.Nomor);
    router.push(`/transaksi/setoran-pembayaran/ubah/${item.Nomor}`);
  } else {
    toast.warning("Silakan pilih baris terlebih dahulu.");
  }
};

const handlePrint = () => {
  const item = selected.value?.[0];
  const nomor = typeof item === "object" ? item?.Nomor : item;

  if (nomor) {
    printNomor.value = nomor;
    showPrintModal.value = true;
  } else {
    toast.warning("Pilih satu data setoran untuk dicetak.");
  }
};

// Update handleDelete agar lebih aman
const handleDelete = async () => {
  const selectedItem = selected.value?.[0];
  if (!selectedItem) return;

  if (isSelectedOtomatis.value) {
    return toast.warning("Setoran Otomatis tidak bisa dihapus.");
  }

  if (confirm(`Yakin hapus setoran ${selectedItem.Nomor}?`)) {
    try {
      await api.delete(`/setoran-pembayaran/${selectedItem.Nomor}`);
      toast.success("Data dihapus.");
      fetchData();
      selected.value = [];
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal hapus.");
    }
  }
};

const handleExport = () => {
  // Logika export excel/csv
  toast.info("Fitur export sedang disiapkan.");
};

const handleRowClick = (event: PointerEvent, { item }: { item: any }) => {
  const raw = item?.raw || item;
  // Toggle selection berdasarkan Nomor
  if (selected.value.length > 0 && selected.value[0]?.Nomor === raw.Nomor) {
    selected.value = [];
  } else {
    selected.value = [raw];
  }
};

// Pastikan formatNumber tersedia untuk detail
const formatNumberLocal = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("id-ID").format(value);
};

onMounted(fetchData);
</script>

<template>
  <PageLayout
    title="Setoran Pembayaran"
    :menu-id="MENU_ID"
    icon="mdi-cash-register"
  >
    <template #header-actions>
      <v-btn
        v-if="canInsert"
        size="small"
        color="primary"
        prepend-icon="mdi-plus"
        @click="router.push('/transaksi/setoran-pembayaran/baru')"
        >Baru</v-btn
      >

      <v-btn
        v-if="canEdit"
        size="small"
        :disabled="!isSingleSelected || isSelectedOtomatis"
        prepend-icon="mdi-pencil"
        @click="handleEdit"
        >Ubah</v-btn
      >

      <v-btn
        v-if="canDelete"
        size="small"
        color="error"
        :disabled="!isSingleSelected || isSelectedOtomatis"
        prepend-icon="mdi-delete"
        @click="handleDelete"
        >Hapus</v-btn
      >

      <v-btn
        size="small"
        color="secondary"
        :disabled="!isSingleSelected"
        prepend-icon="mdi-printer"
        @click="handlePrint"
        >Cetak</v-btn
      >

      <v-btn
        size="small"
        variant="outlined"
        prepend-icon="mdi-file-export"
        @click="handleExport"
        >Export</v-btn
      >
    </template>

    <div class="browse-content">
      <div class="filter-section d-flex align-center mb-4">
        <v-text-field
          v-model="startDate"
          type="date"
          label="Mulai"
          density="compact"
          variant="outlined"
          hide-details
          class="mr-2"
          style="max-width: 160px"
        />
        <v-text-field
          v-model="endDate"
          type="date"
          label="Sampai"
          density="compact"
          variant="outlined"
          hide-details
          class="mr-2"
          style="max-width: 160px"
        />
        <v-text-field
          v-model="search"
          label="Cari..."
          density="compact"
          variant="outlined"
          hide-details
          prepend-inner-icon="mdi-magnify"
        />
        <v-btn
          @click="fetchData"
          icon="mdi-refresh"
          variant="text"
          class="ml-2"
          :loading="isLoading"
        />
      </div>

      <div class="table-container">
        <v-data-table
          v-model="selected"
          v-model:expanded="expanded"
          :headers="masterHeaders"
          :items="masterData"
          :search="search"
          :loading="isLoading"
          item-value="Nomor"
          select-strategy="single"
          return-object
          show-select
          show-expand
          density="compact"
          fixed-header
          class="desktop-table fill-height-table colored-header"
          :row-props="myRowProps"
          @click:row="handleRowClick"
          @update:expanded="
            (val) => {
              if (val && val.length > 0) fetchDetails(val[val.length - 1]);
            }
          "
        >
          <template #[`item.Tanggal`]="{ item }">
            {{
              item.raw?.Tanggal
                ? format(new Date(item.raw.Tanggal), "dd/MM/yyyy")
                : "-"
            }}
          </template>

          <template #[`item.Nominal`]="{ value }">{{
            formatRupiah(value)
          }}</template>
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
              >OTOMATIS</v-chip
            >
            <span v-else>-</span>
          </template>

          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="expanded-detail-cell">
                <div class="detail-container">
                  <div class="detail-table-wrapper elevation-1">
                    <div
                      v-if="!detailsData[item.raw.Nomor]"
                      class="text-center py-6"
                    >
                      <v-progress-circular
                        indeterminate
                        size="28"
                        width="3"
                        color="primary"
                      ></v-progress-circular>
                      <div
                        class="mt-2 text-primary font-weight-bold"
                        style="font-size: 11px"
                      >
                        Memuat rincian invoice...
                      </div>
                    </div>

                    <v-data-table
                      v-else
                      :items="detailsData[item.raw.Nomor]"
                      :headers="[
                        { title: 'Inv. Bayar', key: 'Invoice', width: '150px' },
                        { title: 'Tgl Inv', key: 'TglInvoice', width: '100px' },
                        {
                          title: 'Nominal Inv',
                          key: 'Nominal',
                          align: 'end',
                          width: '130px',
                        },
                        {
                          title: 'Jumlah Bayar',
                          key: 'Bayar',
                          align: 'end',
                          width: '130px',
                        },
                        {
                          title: 'Keterangan',
                          key: 'Keterangan',
                          minWidth: '200px',
                        },
                      ]"
                      density="compact"
                      hide-default-footer
                      class="detail-table colored-header-sub zebra-table"
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
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
          </template>
        </v-data-table>
      </div>
    </div>

    <SetoranPembayaranPrintModal v-model="showPrintModal" :nomor="printNomor" />
  </PageLayout>
</template>

<style scoped>
/* 1. Global Font 11px */
.browse-content :deep(*) {
  font-size: 11px !important;
}

.browse-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.table-container {
  flex-grow: 1;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

/* --- 2. KONSISTENSI BIRU (PRIMARY) --- */

/* Header Tabel Master */
.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}

/* Header Tabel Detail (Dark Slate) */
.colored-header-sub :deep(thead th) {
  background-color: #455a64 !important;
  color: white !important;
  font-size: 10px !important;
}

/* Checkbox Header Putih */
.colored-header :deep(thead .v-checkbox-btn .v-selection-control__wrapper) {
  color: white !important;
}

/* Highlight Baris Dipilih */
.desktop-table :deep(tr.v-data-table__selected) {
  background-color: #e3f2fd !important;
}

/* Hover Effect */
.desktop-table :deep(tbody tr:hover),
.zebra-table :deep(tbody tr:hover) {
  cursor: pointer;
  background-color: #f5f5f5 !important;
}

/* Zebra Striping Tabel Detail */
.zebra-table :deep(tbody tr:nth-of-type(odd)) {
  background-color: #fcfcfc !important;
}

/* --- 3. EXPANDED DETAIL STYLING --- */
.expanded-detail-cell {
  padding: 0 !important;
  background-color: #f8f9fa;
}

.detail-container {
  padding: 10px 16px 10px 50px; /* Indentasi agar rapi */
}

.detail-table-wrapper {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background-color: white;
}

/* Pastikan Scroll Aman */
.desktop-table {
  height: 100%;
}
.desktop-table :deep(.v-table__wrapper) {
  height: 100%;
  overflow-y: auto;
}
</style>
