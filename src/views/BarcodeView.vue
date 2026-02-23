<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import type { VDataTableHeaders } from 'vuetify/components';
import { format, subDays } from 'date-fns'; // Untuk default tanggal
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router'; // Untuk navigasi Baru/Ubah
import * as XLSX from 'xlsx';

// Store & composables
const toast = useToast();
const authStore = useAuthStore();
const router = useRouter(); // Initialize router
const MENU_ID = '13';

// Interface Data Header
interface BarcodeHeader {
  Nomor: string;
  Tanggal: string; // Sudah diformat dd-MM-yyyy dari backend
  Created: string; // Nama user
}

// Interface Data Detail
interface BarcodeDetail {
  Nomor: string;
  Kode: string;
  Barcode: string;
  Nama: string;
  Ukuran: string;
  Jumlah: number;
}

// --- State ---
const headersData = ref<BarcodeHeader[]>([]);
const detailsData = ref<{ [key: string]: BarcodeDetail[] }>({});
const selected = ref<BarcodeHeader[]>([]);
const isLoadingHeaders = ref(true);
const loadingDetails = ref<Set<string>>(new Set()); // Melacak detail mana yg sedang loading
const expanded = ref<string[]>([]); // Menyimpan 'Nomor' header yang sedang di-expand

// State Filter Tanggal (Default 1 minggu terakhir)
const startDate = ref(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));

// State Dialog Konfirmasi Hapus
const confirmDeleteDialogVisible = ref(false);
const itemToDelete = ref<BarcodeHeader | null>(null);
const isDeleting = ref(false);

// Hak akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete'));
const isSingleSelected = computed(() => selected.value.length === 1);

// Header Tabel Master (Header Barcode)
const masterHeaders: VDataTableHeaders = [
  { title: 'Nomor', key: 'Nomor', width: '180px' },
  { title: 'Tanggal', key: 'Tanggal', width: '150px' },
  { title: 'Dibuat Oleh', key: 'Created' },
  { title: '', key: 'data-table-expand', width: '40px', align: 'end' as const }, // Kolom Expand
];

// Header Tabel Detail (Item Barcode)
const detailHeaders: VDataTableHeaders = [
  { title: 'Kode Barang', key: 'Kode', width: '120px' },
  { title: 'Barcode', key: 'Barcode', width: '130px' },
  { title: 'Nama Barang', key: 'Nama', width: '300px' },
  { title: 'Ukuran', key: 'Ukuran', align: 'center', width: '80px' },
  { title: 'Jumlah', key: 'Jumlah', align: 'end', width: '100px' },
];

// --- Methods ---

// Ambil data header dari backend
const fetchHeadersData = async () => {
  isLoadingHeaders.value = true;
  expanded.value = []; // Tutup semua detail saat refresh header
  detailsData.value = {}; // Kosongkan data detail
  try {
    const response = await api.get('/barcodes', {
      params: { startDate: startDate.value, endDate: endDate.value }
    });
    headersData.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data header barcode.');
    console.error(error);
  } finally {
    isLoadingHeaders.value = false;
  }
};

// Ambil data detail (dipanggil oleh watcher)
const fetchDetailsData = async (nomor: string) => {
  loadingDetails.value.add(nomor); // Tandai loading

  // detailsData.value = []; // <-- HAPUS ATAU KOMENTARI BARIS INI

  try {
    const response = await api.get(`/barcodes/${nomor}/details`);
    // Simpan data ke object menggunakan 'nomor' sebagai key
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail untuk nomor ${nomor}.`);
    expanded.value = expanded.value.filter(k => k !== nomor);
  } finally {
    loadingDetails.value.delete(nomor); // Hapus dari loading Set
  }
};

// Navigasi untuk tombol Baru
const openNewForm = () => {
  router.push({ name: 'CetakBarcodeBaru' }); // Gunakan nama rute
};

/// Navigasi untuk tombol Ubah
const openEditForm = () => {
  if (!isSingleSelected.value) return; // Guard clause
  const itemToEdit = selected.value[0];
  router.push(`/daftar/cetak-barcode/ubah/${itemToEdit.Nomor}`);
};

// Buka dialog konfirmasi hapus
const confirmDelete = () => {
  if (!isSingleSelected.value) return; // Guard clause
  itemToDelete.value = selected.value[0];
  confirmDeleteDialogVisible.value = true;
};

// Eksekusi hapus setelah konfirmasi
const executeDelete = async () => {
  if (!itemToDelete.value) return;

  isDeleting.value = true;
  try {
    const nomor = itemToDelete.value.Nomor;
    await api.delete(`/barcodes/${nomor}`);
    toast.success(`Data barcode ${nomor} berhasil dihapus.`);

    // Refresh data header setelah hapus
    fetchHeadersData();
    // Detail otomatis kosong karena selectedHeader direset di fetchHeadersData

  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } };
    toast.error(err.response?.data?.message || 'Gagal menghapus data.');
    console.error(error);
  } finally {
    isDeleting.value = false;
    confirmDeleteDialogVisible.value = false;
    itemToDelete.value = null;
  }
};

// Fungsi Export Excel (Hanya Header)
const exportData = () => {
  if (headersData.value.length === 0) {
    toast.info("Tidak ada data header untuk diexport.");
    return;
  }
  const dataToExport = headersData.value.map(h => ({
    Nomor: h.Nomor,
    Tanggal: h.Tanggal,
    'Dibuat Oleh': h.Created,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "HeadersBarcode");
  XLSX.writeFile(workbook, "CetakBarcode_Headers.xlsx");
};

// Ambil data awal saat komponen dimuat
onMounted(() => {
  if (hasViewPermission.value) {
    fetchHeadersData();
  } else {
    isLoadingHeaders.value = false;
    toast.error("Anda tidak memiliki izin untuk melihat halaman ini.");
  }
});

// Ambil ulang data jika tanggal berubah
watch([startDate, endDate], fetchHeadersData);

// Watcher ini akan memicu load detail saat baris baru dibuka
watch(expanded, (newExpandedItems: BarcodeHeader[]) => {

  // Cari item (object) yang baru ditambahkan
  const newItem = newExpandedItems.find(item =>
    !detailsData.value[item.Nomor] && // Cek pakai item.Nomor
    !loadingDetails.value.has(item.Nomor) // Cek pakai item.Nomor
  );

  if (newItem) {
    // Panggil fetchDetailsData dengan string-nya (newItem.Nomor),
    // BUKAN dengan seluruh object (newItem)
    fetchDetailsData(newItem.Nomor);
  }
});

</script>

<template>
  <PageLayout title="Browse Cetak Barcode" :menu-id="MENU_ID" icon="mdi-barcode-scan">

    <template #header-actions>
      <v-btn v-if="canInsert" size="small" color="primary" @click="openNewForm" prepend-icon="mdi-plus">Baru</v-btn>
      <v-btn v-if="canEdit" size="small" :disabled="!isSingleSelected" @click="openEditForm" prepend-icon="mdi-pencil">
        Ubah
      </v-btn>
      <v-btn v-if="canDelete" size="small" color="error" :disabled="!isSingleSelected" @click="confirmDelete"
        prepend-icon="mdi-delete">
        Hapus
      </v-btn>
      <v-btn v-if="hasViewPermission" size="small" @click="exportData" prepend-icon="mdi-file-excel">Export
        Header</v-btn>
    </template>

    <div v-if="hasViewPermission" class="browse-content">
      <div class="filter-section">
        <span class="filter-label mr-2">Filter Periode:</span>
        <v-text-field v-model="startDate" type="date" density="compact" variant="outlined" hide-details
          style="max-width: 160px;" class="mr-2"></v-text-field>
        <span>s/d</span>
        <v-text-field v-model="endDate" type="date" density="compact" variant="outlined" hide-details
          style="max-width: 160px;" class="ml-2"></v-text-field>
        <v-spacer></v-spacer>
        <v-btn @click="fetchHeadersData" icon="mdi-refresh" variant="text" size="small" :disabled="isLoadingHeaders"
          aria-label="Refresh Data"></v-btn>
      </div>

      <div class="table-container">
        <v-data-table v-model:expanded="expanded" v-model="selected" :headers="masterHeaders" :items="headersData"
          :loading="isLoadingHeaders" item-value="Nomor" density="compact"
          class="desktop-table fill-height-table master-table" fixed-header hover show-select return-object show-expand
          :items-per-page="-1">

          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="expanded-detail-cell">
                <div class="detail-container">
                  <div class="detail-table-wrapper">
                    <div v-if="loadingDetails.has(item.Nomor)" class="text-center py-2 text-caption">
                      <v-progress-circular indeterminate size="20" width="2" color="primary"
                        class="me-2"></v-progress-circular>
                      Memuat detail...
                    </div>
                    <v-data-table v-else-if="detailsData[item.Nomor] && detailsData[item.Nomor].length"
                      :headers="detailHeaders" :items="detailsData[item.Nomor]" item-value="Barcode" density="compact"
                      class="detail-table" :items-per-page="-1">
                      <template #[`item.Jumlah`]="{ value }">
                        {{ value?.toLocaleString('id-ID') ?? '-' }}
                      </template>
                      <template #bottom></template> </v-data-table>
                    <div v-else class="text-center py-2 text-caption">
                      Tidak ada data detail item ditemukan.
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
          </template>
          <template v-slot:no-data>
            <div class="text-center pa-4">Tidak ada data header barcode ditemukan untuk periode ini.</div>
          </template>
        </v-data-table>
      </div>
    </div>

    <div v-else class="state-container">
      <v-icon size="64" class="mb-4">mdi-lock-outline</v-icon>
      <h3 class="text-h6">Akses Ditolak</h3>
      <p>Anda tidak memiliki izin untuk melihat Cetak Barcode.</p>
    </div>

    <v-dialog v-model="confirmDeleteDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-delete-alert-outline</v-icon>
          Konfirmasi Hapus
        </v-card-title>
        <v-card-text>
          Yakin ingin menghapus data barcode <strong>{{ itemToDelete?.Nomor }}</strong>? Tindakan ini akan menghapus
          header
          dan semua detail itemnya.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="confirmDeleteDialogVisible = false" :disabled="isDeleting">Batal</v-btn>
          <v-btn color="error" variant="elevated" @click="executeDelete" :loading="isDeleting"
            :disabled="isDeleting">Ya,
            Hapus</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
/* Layout dasar browse (Sama seperti sebelumnya) */
.browse-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.filter-section {
  flex-shrink: 0;
}

.table-container {
  flex-grow: 1;
  overflow: hidden;
  /* Penting */
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

/* VDataTable harus mengisi table-container */
.v-data-table {
  height: 100%;
}

.v-data-table :deep(.v-table__wrapper) {
  height: 100%;
  overflow-y: auto;
}

/* Styling untuk area expanded detail */
.expanded-detail-cell {
  padding: 0 !important;
  /* Hilangkan padding default */
  background-color: #f7f7f7;
  /* Warna latar belakang area detail */
}

.detail-container {
  padding: 8px 16px 8px 60px;
  /* Beri padding + indentasi kiri */
}

.detail-table-wrapper {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background-color: white;
}

.detail-table {
  font-size: 11px !important;
  /* Font lebih kecil untuk detail */
}

.detail-table :deep(td),
.detail-table :deep(th) {
  padding: 0 8px !important;
  height: 26px !important;
}
</style>
