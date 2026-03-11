<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { VForm } from 'vuetify/components';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import * as XLSX from 'xlsx';

// Store & composables
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '12'; // Menu ID untuk Price List

// Interface data browse (sesuai backend service)
interface ProductPrice {
  Kode: string;
  Barcode: string;
  Nama: string;
  Ukuran: string;
  Hpp: number | null;
  Harga: number | null;
  Laba: number | null;
}

// Interface data untuk dialog update
interface UpdatePriceData {
  Kode: string;
  Nama: string;
  Ukuran: string;
  Hpp: number | null;
  Harga: number | null;
}

type TableHeader = {
  title: string
  key: string
  width?: string
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
}

// --- State ---
const products = ref<ProductPrice[]>([]);
const search = ref('');
const isLoading = ref(true);
const selected = ref<ProductPrice[]>([]); // Untuk tombol Update Harga di header

// --- State Dialog Update Harga ---
const dialogUpdateVisible = ref(false);
const editedItem = ref<Partial<UpdatePriceData>>({}); // Data di dalam dialog
const isSaving = ref(false); // Loading saat menyimpan
const formRef = ref<VForm | null>(null); // Referensi ke v-form

// --- State BARU untuk Dialog Konfirmasi Update ---
const confirmUpdateDialogVisible = ref(false); // Kontrol visibility dialog konfirmasi
const pendingUpdateAction = ref<(() => Promise<void>) | null>(null); // Menyimpan fungsi save yang akan dijalankan
// --- State BARU untuk Konfirmasi Batal Update ---
const confirmCancelUpdateDialogVisible = ref(false); // Kontrol visibility

// --- State BARU untuk Dialog History ---
const dialogHistoryVisible = ref(false);
const historyData = ref<any[]>([]); // Tipe any sementara, bisa dibuat interface nanti
const historyLoading = ref(false);
const selectedItemForHistory = ref<ProductPrice | null>(null); // Info barang yg dilihat historynya

// Hak akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));

// Format Angka ke Rupiah
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Header tabel (sesuai Delphi + Laba)
const headers: TableHeader[] = [
  { title: 'Kode', key: 'Kode', width: '120px' },
  { title: 'Barcode', key: 'Barcode', width: '130px' },
  { title: 'Nama Barang', key: 'Nama', width: '300px' },
  { title: 'Ukuran', key: 'Ukuran', align: 'center', width: '80px' },
  { title: 'HPP', key: 'Hpp', align: 'end', width: '120px' },
  { title: 'Harga Jual', key: 'Harga', align: 'end', width: '120px' },
  { title: 'Laba', key: 'Laba', align: 'end', width: '120px' },
  // Kolom Actions (Update Harga & History)
  { title: 'Actions', key: 'actions', sortable: false, width: '100px', align: 'center' }
];
const historyHeaders: TableHeader[] = [
  { title: 'Tanggal Update', key: 'Tanggal', width: '180px' },
  // { title: 'Kode', key: 'Kode' }, // Mungkin tidak perlu ditampilkan lagi
  // { title: 'Ukuran', key: 'Ukuran' }, // Mungkin tidak perlu ditampilkan lagi
  { title: 'Harga Jual', key: 'Harga', align: 'end', width: '150px' },
  { title: 'Diupdate Oleh', key: 'Created', width: '150px' },
];

// --- Rules Validasi Dialog ---
const numberRule = (v: number | string | null | undefined) =>
  (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) || 'Harus berupa angka';
const nonNegativeRule = (v: number | null | undefined) => (v !== null && v !== undefined && v >= 0) || 'Tidak boleh negatif';


// --- Methods ---
const fetchProducts = async () => {
  isLoading.value = true;
  selected.value = [];
  try {
    const response = await api.get('/price-list');
    products.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data price list.');
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

// Buka Dialog Update Harga
const openUpdateDialog = (item: ProductPrice) => {
  if (!canEdit.value) {
    toast.error("Anda tidak punya hak akses untuk mengubah harga.");
    return;
  }
  editedItem.value = {
    Kode: item.Kode,
    Nama: item.Nama,
    Ukuran: item.Ukuran,
    // Bulatkan angka agar tidak muncul banyak desimal (seperti di screenshot)
    Hpp: Math.round(Number(item.Hpp) || 0),
    Harga: Math.round(Number(item.Harga) || 0),
  };
  dialogUpdateVisible.value = true;
  formRef.value?.resetValidation();
};

// Tutup Dialog Update Harga
const closeUpdateDialog = () => {
  confirmCancelUpdateDialogVisible.value = true; // Buka dialog konfirmasi batal
  // Jangan langsung: dialogUpdateVisible.value = false;
  // Jangan langsung: editedItem.value = {};
};

// Fungsi saat tombol "Ya, Batalkan" di konfirmasi batal diklik
const executeCancelUpdate = () => {
  confirmCancelUpdateDialogVisible.value = false; // Tutup konfirmasi
  dialogUpdateVisible.value = false;          // TUTUP dialog update utama
  editedItem.value = {};                     // Kosongkan data
};

// Fungsi saat tombol "Lanjut Edit" di konfirmasi batal diklik
const cancelCancelUpdateConfirmation = () => {
  confirmCancelUpdateDialogVisible.value = false; // Hanya tutup konfirmasi
};

// Simpan Update Harga
const savePrice = async () => {
  // 1. Validasi Form Vuetify (tetap sama)
  const validationResult = await formRef.value?.validate();
  if (!validationResult?.valid) {
    toast.warning("Mohon periksa HPP dan Harga Jual.");
    return;
  }

  // --- MODIFIKASI: Buka Dialog Konfirmasi ---
  // Simpan logika API call ke dalam pendingUpdateAction
  pendingUpdateAction.value = async () => {
    isSaving.value = true;
    const itemToSave = editedItem.value;

    try {
      const response = await api.put(`/price-list/${itemToSave.Kode}/${itemToSave.Ukuran}`, {
        hpp: itemToSave.Hpp,
        harga: itemToSave.Harga
      });

      toast.success(response.data.message || 'Harga berhasil diperbarui!');

      // Update data di tabel lokal
      const index = products.value.findIndex(p => p.Kode === itemToSave.Kode && p.Ukuran === itemToSave.Ukuran);
      if (index !== -1) {
        const product = products.value[index]
        if (!product) return

        product.Hpp = itemToSave.Hpp ?? null
        product.Harga = itemToSave.Harga ?? null

        const hppVal = itemToSave.Hpp ?? 0
        const hargaVal = itemToSave.Harga ?? 0

        product.Laba = hargaVal - hppVal
      }

      dialogUpdateVisible.value = false; // Tutup dialog update utama
      confirmUpdateDialogVisible.value = false; // Tutup dialog konfirmasi simpan

    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Gagal menyimpan harga.');
      console.error(error);
      confirmUpdateDialogVisible.value = false; // Tutup dialog konfirmasi jika error
    } finally {
      isSaving.value = false;
      pendingUpdateAction.value = null; // Bersihkan action
    }
  };

  // Tampilkan dialog konfirmasi
  confirmUpdateDialogVisible.value = true;
  // --- AKHIR MODIFIKASI ---
};

const executePendingUpdate = async () => {
  if (pendingUpdateAction.value) {
    await pendingUpdateAction.value(); // Jalankan fungsi save yang disimpan
  }
};

// Fungsi yang dipanggil saat tombol "Batal" di dialog konfirmasi diklik
const cancelUpdateConfirmation = () => {
  confirmUpdateDialogVisible.value = false;
  pendingUpdateAction.value = null; // Hapus action yang tertunda
};

// Fungsi Export Excel
const exportData = () => {
  if (products.value.length === 0) {
    toast.info("Tidak ada data untuk diexport.");
    return;
  }
  const dataToExport = products.value.map(p => ({
    Kode: p.Kode,
    Barcode: p.Barcode,
    'Nama Barang': p.Nama,
    Ukuran: p.Ukuran,
    HPP: p.Hpp,
    'Harga Jual': p.Harga,
    Laba: p.Laba,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "PriceList");
  XLSX.writeFile(workbook, "PriceList.xlsx");
};

// Computed untuk tombol Update Harga di header
const canUpdateFromHeader = computed(() => selected.value.length === 1 && canEdit.value);

// Ambil data riwayat dari backend
const fetchHistoryData = async (kode: string, ukuran: string) => {
  historyLoading.value = true;
  historyData.value = [];
  try {
    // --- PERBAIKAN DI SINI ---
    // Encode KEDUA parameter sebelum dimasukkan ke URL
    const encodedKode = encodeURIComponent(kode);
    const encodedUkuran = encodeURIComponent(ukuran);
    const response = await api.get(`/price-list/${encodedKode}/${encodedUkuran}/history`);
    // --- AKHIR PERBAIKAN ---

    historyData.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat riwayat harga.');
    console.error(error);
  } finally {
    historyLoading.value = false;
  }
};

// Buka Dialog History (dipanggil dari ikon history di tabel)
const openHistoryDialog = (item: ProductPrice) => {
  selectedItemForHistory.value = item; // Simpan info barang
  dialogHistoryVisible.value = true;   // Buka dialog
  fetchHistoryData(item.Kode, item.Ukuran); // Ambil datanya
};

// Tutup Dialog History
const closeHistoryDialog = () => {
  dialogHistoryVisible.value = false;
  selectedItemForHistory.value = null; // Reset
  historyData.value = [];             // Kosongkan data
};

const handleRowClick = (event: PointerEvent, { item }: { item: ProductPrice }) => {
  // Toggle selection: jika sudah dipilih maka lepas, jika belum maka pilih
  if (selected.value.length > 0 && selected.value[0].Barcode === item.Barcode) {
    selected.value = [];
  } else {
    selected.value = [item];
  }
};

// Ambil data saat komponen dimuat
onMounted(() => {
  if (hasViewPermission.value) {
    fetchProducts();
  } else {
    isLoading.value = false;
    toast.error("Anda tidak memiliki izin untuk melihat halaman ini.");
  }
});
</script>

<template>
  <PageLayout title="Price List Barang" :menu-id="MENU_ID" icon="mdi-tag-multiple-outline">

    <!-- Tombol Header -->
    <template #header-actions>
      <!-- Tombol Update Harga -->
      <v-btn v-if="canEdit" size="small" :disabled="!canUpdateFromHeader"
        @click="selected[0] && openUpdateDialog(selected[0])" prepend-icon="mdi-pencil">
        Update Harga
      </v-btn>
      <!-- Tombol Export -->
      <v-btn v-if="hasViewPermission" size="small" @click="exportData" prepend-icon="mdi-file-excel">
        Export
      </v-btn>
    </template>

    <!-- Konten Utama -->
    <div v-if="hasViewPermission" class="browse-content">
      <!-- Filter Section -->
      <div class="filter-section">
        <v-text-field v-model="search" density="compact" label="Cari Barang (Kode, Barcode, Nama...)"
          prepend-inner-icon="mdi-magnify" variant="outlined" hide-details single-line></v-text-field>
        <v-spacer></v-spacer>
        <v-btn @click="fetchProducts" icon="mdi-refresh" variant="text" size="small" :disabled="isLoading"
          aria-label="Refresh Data"></v-btn>
      </div>

      <!-- Table Section -->
      <v-data-table v-model="selected" :headers="headers" :items="products" :search="search" :loading="isLoading"
        item-value="Barcode" density="compact" class="desktop-table fill-height-table colored-header" fixed-header
        show-select select-strategy="single" return-object items-per-page="50" @click:row="handleRowClick">
        <!-- Formatting Kolom Angka -->
        <template #[`item.Hpp`]="{ value }">
          {{ formatCurrency(value) }}
        </template>
        <template #[`item.Harga`]="{ value }">
          <span class="font-weight-bold">{{ formatCurrency(value) }}</span>
        </template>
        <template #[`item.Laba`]="{ value }">
          {{ formatCurrency(value) }}
        </template>

        <!-- Kolom Actions -->
        <template #[`item.actions`]="{ item }">
          <v-tooltip text="Update Harga" location="top">
            <template v-slot:activator="{ props }">
              <v-icon v-bind="props" v-if="canEdit" size="small" class="me-2" @click="openUpdateDialog(item)"
                color="primary">
                mdi-pencil
              </v-icon>
            </template>
          </v-tooltip>
          <v-tooltip text="Lihat Riwayat Harga" location="top">
            <template v-slot:activator="{ props }">
              <v-icon v-bind="props" size="small" @click="openHistoryDialog(item)" color="info">
                mdi-history
              </v-icon>
            </template>
          </v-tooltip>
        </template>

        <!-- Loading & No Data Slots -->
        <template v-slot:loading>
          <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
        </template>
        <template v-slot:no-data>
          <div class="text-center pa-4">
            Tidak ada data price list yang tersedia.
          </div>
        </template>
      </v-data-table>
    </div>

    <!-- Tampilan Akses Ditolak -->
    <div v-else class="state-container">
      <v-icon size="64" class="mb-4">mdi-lock-outline</v-icon>
      <h3 class="text-h6">Akses Ditolak</h3>
      <p>Anda tidak memiliki izin untuk melihat Price List.</p>
    </div>

    <!-- === DIALOG UPDATE HARGA === -->
    <v-dialog v-model="dialogUpdateVisible" persistent max-width="480px">
      <v-card class="dialog-card rounded-lg">
        <v-form ref="formRef" @submit.prevent="savePrice">
          <v-card-title class="dialog-header bg-primary text-white pa-4">
            <v-icon color="white" class="mr-2">mdi-tag-edit</v-icon>
            <span class="text-h6 font-weight-bold">Update Harga Jual</span>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-close" variant="text" color="white" size="small" @click="closeUpdateDialog"></v-btn>
          </v-card-title>

          <v-card-text class="pa-4 bg-grey-lighten-4">
            <div class="bg-white pa-3 rounded border mb-4">
              <div class="text-caption text-grey-darken-1 font-weight-bold mb-2">IDENTITAS BARANG</div>
              <v-row dense>
                <v-col cols="12">
                  <v-text-field :model-value="editedItem.Kode" label="Kode" variant="filled" density="compact" readonly
                    hide-details class="mb-2" />
                </v-col>
                <v-col cols="12">
                  <v-text-field :model-value="editedItem.Nama" label="Nama Barang" variant="filled" density="compact"
                    readonly hide-details class="mb-2" />
                </v-col>
                <v-col cols="12">
                  <v-text-field :model-value="editedItem.Ukuran" label="Ukuran" variant="filled" density="compact"
                    readonly hide-details />
                </v-col>
              </v-row>
            </div>

            <div class="bg-white pa-3 rounded border">
              <div class="text-caption text-primary font-weight-bold mb-2">INPUT HARGA BARU</div>
              <v-row dense>
                <v-col cols="12">
                  <v-text-field v-model.number="editedItem.Hpp" label="HPP Baru *" type="number" prefix="Rp"
                    variant="outlined" density="compact" color="primary" :rules="[numberRule, nonNegativeRule]"
                    hide-details="auto" class="mb-3" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model.number="editedItem.Harga" label="Harga Jual Baru *" type="number" prefix="Rp"
                    variant="outlined" density="compact" color="primary" :rules="[numberRule, nonNegativeRule]"
                    hide-details="auto" />
                </v-col>
              </v-row>
            </div>
          </v-card-text>

          <v-divider></v-divider>

          <v-card-actions class="pa-4 bg-white">
            <v-spacer></v-spacer>
            <v-btn variant="text" color="grey-darken-1" @click="closeUpdateDialog" :disabled="isSaving">Batal</v-btn>
            <v-btn color="primary" type="submit" variant="elevated" :loading="isSaving" prepend-icon="mdi-check-circle">
              Update Harga
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmUpdateDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
          Konfirmasi Update
        </v-card-title>
        <v-card-text>
          Yakin ingin update harga jual untuk barang ini? Riwayat harga akan tercatat.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="cancelUpdateConfirmation" :disabled="isSaving">
            Batal
          </v-btn>
          <v-btn color="primary" variant="elevated" @click="executePendingUpdate" :loading="isSaving"
            :disabled="isSaving">
            Ya, Update
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmCancelUpdateDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
          Konfirmasi Batal
        </v-card-title>
        <v-card-text>
          Yakin ingin membatalkan update harga? Perubahan akan dibuang.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="cancelCancelUpdateConfirmation">
            Lanjut Edit
          </v-btn>
          <v-btn color="error" variant="elevated" @click="executeCancelUpdate">
            Ya, Batalkan
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- === DIALOG RIWAYAT HARGA === -->
    <v-dialog v-model="dialogHistoryVisible" persistent max-width="700px">
      <v-card class="dialog-card">
        <v-card-title class="dialog-header">
          <v-icon color="primary" class="mr-2">mdi-history</v-icon>
          <span class="text-subtitle-1 font-weight-bold text-primary"> Riwayat Harga Jual: {{
            selectedItemForHistory?.Nama }} ({{ selectedItemForHistory?.Ukuran }})
          </span>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" size="small" @click="closeHistoryDialog"></v-btn>
        </v-card-title>

        <v-card-text class="pa-4 bg-grey-lighten-5">
          <v-data-table :headers="historyHeaders" :items="historyData" :loading="historyLoading" density="compact"
            class="border rounded-sm colored-header zebra-table" items-per-page="10">
            <template #[`item.Harga`]="{ value }">
              <span class="font-weight-bold text-primary">{{ formatCurrency(value) }}</span>
            </template>

            <template v-slot:loading>
              <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
            </template>

            <template v-slot:no-data>
              <div class="text-center pa-4">Tidak ada riwayat harga ditemukan.</div>
            </template>
          </v-data-table>
        </v-card-text>

        <v-card-actions class="dialog-footer">
          <v-spacer></v-spacer>
          <v-btn variant="text" size="small" @click="closeHistoryDialog">Tutup</v-btn>
          <v-btn color="primary" variant="elevated" size="small" @click="closeHistoryDialog">OK</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
/* =========================================
   1. LAYOUT BROWSE (Standard)
   ========================================= */
.browse-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.filter-section {
  flex-shrink: 0;
}

.v-data-table {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.v-data-table :deep(.v-table__wrapper) {
  overflow: auto;
}

/* =========================================
   2. TABLE STYLING (Blue Consistency)
   ========================================= */

/* Header Tabel Master & Dialog */
.colored-header :deep(thead th) {
  background-color: #1976D2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
  font-size: 11px;
}

/* Checkbox Header (White on Blue) */
.colored-header :deep(thead .v-checkbox-btn .v-selection-control__wrapper) {
  color: white !important;
}

/* Highlight Baris Dipilih */
.desktop-table :deep(tr.v-data-table__selected) {
  background-color: #E3F2FD !important;
}

/* Hover Effect (Master & Zebra) */
.desktop-table :deep(tbody tr:hover),
.zebra-table :deep(tbody tr:hover) {
  cursor: pointer;
  background-color: #f5f5f5 !important;
}

/* Zebra Striping untuk Tabel Riwayat */
.zebra-table :deep(tbody tr:nth-of-type(odd)) {
  background-color: #fcfcfc !important;
}

/* Border Tabel di Dialog */
.border.rounded-sm {
  border: 1px solid #ddd !important;
}

/* =========================================
   3. DIALOG STYLING
   ========================================= */
.dialog-card {
  font-size: 12px;
}

.dialog-header {
  border-bottom: 2px solid #1976D2;
  /* Garis Biru Primary */
  background-color: #f5f5f5;
}

.dialog-footer {
  border-top: 1px solid #e0e0e0;
  background-color: #f5f5f5;
}

/* Fix Input Number (Hapus Spinner) */
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

/* Konsistensi Font di Dialog */
.dialog-card :deep(.v-label),
.dialog-card :deep(input) {
  font-size: 11px !important;
}
</style>
