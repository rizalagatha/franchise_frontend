<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import api from "@/services/api";
import PageLayout from "@/components/PageLayout.vue";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import * as XLSX from "xlsx";

// Store & Konfigurasi
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = "24";

interface StandartStok {
  Kode: string;
  Barcode: string;
  Nama: string;
  Ukuran: string;
  MinBuffer: number;
  MaxBuffer: number;
  Stok: number;
}

type TableHeader = {
  title: string;
  key: keyof StandartStok | string;
  align?: "start" | "center" | "end";
  width?: string;
  minWidth?: string;
};

// --- State ---
const items = ref<StandartStok[]>([]);
const isLoading = ref(true);
const search = ref("");
const selected = ref<StandartStok[]>([]);
const maxField = ref();

// State Edit (PanelPSM di Delphi)
const isEditDialogOpen = ref(false);
const isSaving = ref(false);
const editForm = ref({
  kode: "",
  ukuran: "",
  nama: "",
  minBuffer: 0,
  maxBuffer: 0,
});

// Hak Akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, "view"));
const canEdit = computed(() => authStore.can(MENU_ID, "edit"));
const isSingleSelected = computed(() => selected.value.length === 1);

// Header Tabel (Sesuai Delphi)
const headers: TableHeader[] = [
  { title: "Barcode", key: "Barcode", width: "150px" },
  { title: "Nama Barang", key: "Nama", minWidth: "300px" },
  { title: "Ukuran", key: "Ukuran", align: "center", width: "100px" },
  { title: "Min Buffer", key: "MinBuffer", align: "end", width: "120px" },
  { title: "Max Buffer", key: "MaxBuffer", align: "end", width: "120px" },
  { title: "Stok Real", key: "Stok", align: "end", width: "120px" },
];

// --- Methods ---

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("id-ID").format(value);
};

const fetchData = async () => {
  isLoading.value = true;
  try {
    const response = await api.get("/standart-stok");
    items.value = response.data;
  } catch (error) {
    toast.error("Gagal memuat data standar stok.");
  } finally {
    isLoading.value = false;
  }
};

// Fungsi warna baris (Instruksi: gunakan getRowTextColor)
const getRowTextColor = (item: any) => {
  if (item.Stok < item.MinBuffer) {
    return "text-error font-weight-bold"; // Merah jika stok < minimal
  }
  return "";
};

// Logika Edit (Setting F1)
const openEdit = (item?: StandartStok) => {
  const target = item || selected.value[0];
  if (!target) return;

  editForm.value = {
    kode: target.Kode,
    ukuran: target.Ukuran,
    nama: target.Nama,
    minBuffer: target.MinBuffer,
    maxBuffer: target.MaxBuffer,
  };
  isEditDialogOpen.value = true;
};

const saveBuffer = async () => {
  isSaving.value = true;
  try {
    await api.put("/standart-stok/update", {
      kode: editForm.value.kode,
      ukuran: editForm.value.ukuran,
      minBuffer: editForm.value.minBuffer,
      maxBuffer: editForm.value.maxBuffer,
    });

    toast.success("Batas stok berhasil diperbarui.");
    isEditDialogOpen.value = false;
    fetchData(); // Refresh data
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

const exportToExcel = () => {
  if (items.value.length === 0)
    return toast.warning("Tidak ada data untuk diekspor.");

  const dataToExport = items.value.map((i) => ({
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

const handleRowClick = (
  event: PointerEvent,
  { item }: { item: StandartStok },
) => {
  // Toggle selection berdasarkan Barcode
  if (selected.value.length > 0 && selected.value[0].Barcode === item.Barcode) {
    selected.value = [];
  } else {
    selected.value = [item];
  }
};

onMounted(() => {
  if (hasViewPermission.value) fetchData();
});
</script>

<template>
  <PageLayout
    title="Standar Stok (Buffer)"
    :menu-id="MENU_ID"
    icon="mdi-database-outline"
  >
    <template #header-actions>
      <v-btn
        v-if="canEdit"
        size="small"
        color="primary"
        :disabled="!isSingleSelected"
        @click="openEdit()"
        prepend-icon="mdi-cog"
        >Setting (F1)</v-btn
      >
      <v-btn
        size="small"
        color="green"
        @click="exportToExcel"
        prepend-icon="mdi-file-excel"
        >Export</v-btn
      >
      <v-btn
        size="small"
        @click="fetchData"
        icon="mdi-refresh"
        variant="text"
        :loading="isLoading"
      ></v-btn>
    </template>

    <div v-if="hasViewPermission" class="browse-content bg-grey-lighten-4">
      <div
        class="filter-section d-flex align-center px-4 py-2 bg-white border-b"
      >
        <v-text-field
          v-model="search"
          density="compact"
          label="Cari Barang / Barcode..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          hide-details
          single-line
          style="max-width: 400px"
        ></v-text-field>
        <v-spacer></v-spacer>
        <div class="d-flex align-center">
          <v-badge color="error" dot class="mr-2"></v-badge>
          <span class="text-caption font-weight-bold text-error"
            >Stok di bawah Minimal Buffer</span
          >
        </div>
      </div>

      <div class="table-container pa-3">
        <v-data-table
          v-model="selected"
          :headers="headers"
          :items="items"
          :search="search"
          :loading="isLoading"
          item-value="Barcode"
          density="compact"
          show-select
          select-strategy="single"
          return-object
          fixed-header
          class="desktop-table fill-height-table colored-header zebra-table elevation-1"
          :items-per-page="50"
          @click:row="handleRowClick"
          :row-props="(data: any) => ({ class: getRowTextColor(data.item) })"
        >
          <template #[`item.MinBuffer`]="{ value }">{{
            formatNumber(value)
          }}</template>
          <template #[`item.MaxBuffer`]="{ value }">{{
            formatNumber(value)
          }}</template>
          <template #[`item.Stok`]="{ value }">
            <span class="font-weight-bold">{{ formatNumber(value) }}</span>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
          </template>
        </v-data-table>
      </div>
    </div>

    <v-dialog v-model="isEditDialogOpen" max-width="450px" persistent>
      <v-card class="bg-grey-lighten-4 rounded-lg">
        <v-form @submit.prevent="saveBuffer">
          <v-toolbar color="primary" density="compact">
            <v-icon color="white" class="ml-4">mdi-cog-outline</v-icon>
            <v-toolbar-title class="text-white font-weight-bold"
              >Setting Buffer Stok</v-toolbar-title
            >
            <v-spacer></v-spacer>
            <v-btn
              icon="mdi-close"
              color="white"
              variant="text"
              @click="isEditDialogOpen = false"
            ></v-btn>
          </v-toolbar>

          <v-card-text class="pa-4">
            <div class="bg-white pa-4 rounded-lg border elevation-1">
              <v-alert
                v-if="editForm.nama"
                density="compact"
                color="primary"
                variant="tonal"
                class="mb-4 text-caption border-opacity-25"
              >
                <strong>{{ editForm.nama }}</strong
                ><br />
                Ukuran: {{ editForm.ukuran }} | Kode: {{ editForm.kode }}
              </v-alert>

              <v-row dense>
                <v-col cols="12">
                  <v-text-field
                    v-model.number="editForm.minBuffer"
                    label="Minimal Buffer"
                    type="number"
                    density="compact"
                    variant="outlined"
                    color="primary"
                    class="mb-2"
                    @keyup.enter="maxField?.focus()"
                  ></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-text-field
                    ref="maxField"
                    v-model.number="editForm.maxBuffer"
                    label="Maximal Buffer"
                    type="number"
                    density="compact"
                    variant="outlined"
                    color="primary"
                    @keyup.enter="saveBuffer"
                  ></v-text-field>
                </v-col>
              </v-row>
            </div>
          </v-card-text>

          <v-card-actions class="pa-4 bg-white">
            <v-spacer></v-spacer>
            <v-btn variant="text" color="grey" @click="isEditDialogOpen = false"
              >Batal</v-btn
            >
            <v-btn
              color="primary"
              variant="elevated"
              :loading="isSaving"
              type="submit"
              prepend-icon="mdi-check"
            >
              Simpan
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>
  </PageLayout>
</template>

<style scoped>
/* Paksa Konsistensi Font 11px */
.browse-content :deep(*),
.v-dialog :deep(*) {
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
}

/* Header Tabel Biru Primary */
.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
  height: 36px !important;
}

/* Checkbox Header Putih */
.colored-header :deep(thead .v-checkbox-btn .v-selection-control__wrapper) {
  color: white !important;
}

/* Zebra Striping */
.zebra-table :deep(tbody tr:nth-of-type(odd)) {
  background-color: #fcfcfc !important;
}

/* Highlight Baris Dipilih */
.desktop-table :deep(tr.v-data-table__selected) {
  background-color: #e3f2fd !important;
}

/* Hover Effect */
.desktop-table :deep(tbody tr:hover) {
  cursor: pointer;
  background-color: #f5f5f5 !important;
}

/* Warna Error untuk Stok < Buffer */
:deep(.text-error),
:deep(.text-error td) {
  color: #ff5252 !important;
}

/* Hilangkan Spinner Angka */
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
