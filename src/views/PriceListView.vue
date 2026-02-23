<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { VDataTableHeaders, VForm } from 'vuetify/components';
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
const headers: VDataTableHeaders = [
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
const historyHeaders: VDataTableHeaders = [
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
  editedItem.value = { // Siapkan data untuk dialog
    Kode: item.Kode,
    Nama: item.Nama,
    Ukuran: item.Ukuran,
    Hpp: item.Hpp,
    Harga: item.Harga,
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
        products.value[index].Hpp = itemToSave.Hpp ?? null;
        products.value[index].Harga = itemToSave.Harga ?? null;
        const hppVal = itemToSave.Hpp ?? 0;
        const hargaVal = itemToSave.Harga ?? 0;
        products.value[index].Laba = hargaVal - hppVal;
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
      <v-btn v-if="canEdit" size="small" :disabled="!canUpdateFromHeader" @click="openUpdateDialog(selected[0])"
        prepend-icon="mdi-pencil">
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
        item-value="Barcode" density="compact" class="desktop-table fill-height-table" fixed-header show-select
        return-object items-per-page="50">
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
    <v-dialog v-model="dialogUpdateVisible" persistent max-width="500px">
      <v-card class="dialog-card">
        <v-form ref="formRef" @submit.prevent="savePrice">
          <v-card-title class="dialog-header">
            <span class="text-subtitle-1 font-weight-medium">Update Harga Jual</span>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-close" variant="text" size="small" @click="closeUpdateDialog"></v-btn>
          </v-card-title>

          <v-card-text class="pa-4">
            <v-container>
              <v-row dense>
                <!-- Info Barang (Readonly) -->
                <v-col cols="12">
                  <v-text-field :model-value="editedItem.Kode" label="Kode Barang" variant="filled" density="compact"
                    readonly hide-details></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-text-field :model-value="editedItem.Nama" label="Nama Barang" variant="filled" density="compact"
                    readonly hide-details></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-text-field :model-value="editedItem.Ukuran" label="Ukuran" variant="filled" density="compact"
                    readonly hide-details></v-text-field>
                </v-col>

                <v-divider class="my-3"></v-divider>

                <!-- Input HPP -->
                <v-col cols="12">
                  <v-text-field v-model.number="editedItem.Hpp" label="HPP Baru *" type="number" prefix="Rp"
                    variant="outlined" density="compact" :rules="[numberRule, nonNegativeRule]" hide-details="auto"
                    autofocus></v-text-field>
                </v-col>

                <!-- Input Harga Jual -->
                <v-col cols="12">
                  <v-text-field v-model.number="editedItem.Harga" label="Harga Jual Baru *" type="number" prefix="Rp"
                    variant="outlined" density="compact" :rules="[numberRule, nonNegativeRule]"
                    hide-details="auto"></v-text-field>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>

          <v-card-actions class="dialog-footer">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="closeUpdateDialog" :disabled="isSaving">Batal</v-btn>
            <v-btn color="primary" type="submit" variant="elevated" :loading="isSaving" :disabled="isSaving">
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
      <v-card>
        <v-card-title class="dialog-header">
          <span class="text-subtitle-1 font-weight-medium">
            Riwayat Harga Jual: {{ selectedItemForHistory?.Nama }} ({{ selectedItemForHistory?.Ukuran }})
          </span>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" variant="text" size="small" @click="closeHistoryDialog"></v-btn>
        </v-card-title>
        <v-card-text class="pa-4">
          <v-data-table :headers="historyHeaders" :items="historyData" :loading="historyLoading" density="compact"
            class="border rounded-sm" items-per-page="10">
            <template #[`item.Harga`]="{ value }">
              {{ formatCurrency(value) }}
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
          <v-btn variant="text" @click="closeHistoryDialog">Tutup</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
/* Styling standar browse */
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

/* Styling standar dialog */
.dialog-card {
  font-size: 12px;
}

.dialog-header {
  border-bottom: 1px solid #e0e0e0;
  padding: 8px 16px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
}

.dialog-footer {
  border-top: 1px solid #e0e0e0;
  padding: 8px 16px;
  background-color: #f5f5f5;
}

.dialog-card :deep(.v-label) {
  font-size: 11px !important;
}

.dialog-card :deep(input),
.dialog-card :deep(.v-field__input) {
  font-size: 12px !important;
}

.dialog-card :deep(.v-input) {
  margin-bottom: 4px;
}

.v-container {
  padding-top: 8px;
  padding-bottom: 8px;
}

.v-card-text {
  padding-bottom: 0px !important;
}
</style>
