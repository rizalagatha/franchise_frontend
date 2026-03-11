<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
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

type TableHeader = {
  title: string
  key: string
  width?: string
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
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
const masterHeaders: TableHeader[] = [
  { title: 'Nomor', key: 'Nomor', width: '180px' },
  { title: 'Tanggal', key: 'Tanggal', width: '150px' },
  { title: 'Dibuat Oleh', key: 'Created' },
  { title: '', key: 'data-table-expand', width: '40px', align: 'end' as const }, // Kolom Expand
];

// Header Tabel Detail (Item Barcode)
const detailHeaders: TableHeader[] = [
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
  if (!isSingleSelected.value) return;

  const itemToEdit = selected.value[0];
  if (!itemToEdit) return;

  router.push(`/daftar/cetak-barcode/ubah/${itemToEdit.Nomor}`);
};

// Buka dialog konfirmasi hapus
const confirmDelete = () => {
  if (!isSingleSelected.value) return;

  const item = selected.value[0];
  if (!item) return;

  itemToDelete.value = item;
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

const handleRowClick = (event: PointerEvent, { item }: { item: BarcodeHeader }) => {
  // Jika baris yang sama diklik, lepas pilihan. Jika beda, pilih yang baru.
  if (selected.value.length > 0 && selected.value[0].Nomor === item.Nomor) {
    selected.value = [];
  } else {
    selected.value = [item];
  }
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
watch(expanded, (newExpandedItems: any[]) => {
  // 1. Cari item yang baru dibuka
  const newItem = newExpandedItems.find(item => {
    // Ambil nomor dengan aman (cek apakah dia objek atau string)
    const nomor = typeof item === 'object' ? item.Nomor : item;
    return !detailsData.value[nomor] && !loadingDetails.value.has(nomor);
  });

  if (newItem) {
    // 2. Pastikan yang dikirim ke API adalah STRING Nomor, bukan OBJEK
    const nomorYangBenar = typeof newItem === 'object' ? newItem.Nomor : newItem;

    if (nomorYangBenar) {
      fetchDetailsData(nomorYangBenar);
    }
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
          class="desktop-table fill-height-table master-table colored-header" fixed-header hover show-select
          return-object show-expand select-strategy="single" @click:row="handleRowClick" :items-per-page="-1">

          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="expanded-detail-cell">
                <div class="detail-container">
                  <div class="detail-table-wrapper">
                    <div v-if="loadingDetails.has(item.Nomor)" class="text-center py-4">
                      <v-progress-circular indeterminate size="24" color="primary"></v-progress-circular>
                    </div>

                    <v-data-table v-else-if="detailsData[item.Nomor]?.length" :headers="detailHeaders"
                      :items="detailsData[item.Nomor] ?? []" item-value="Barcode" density="compact"
                      class="detail-table colored-header-sub" hide-default-footer>
                      <template #[`item.Jumlah`]="{ value }">
                        <span class="font-weight-bold">{{ value?.toLocaleString('id-ID') ?? '-' }}</span>
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
/* =========================================
   1. LAYOUT & TABLE STRUCTURE
   ========================================= */
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

/* =========================================
   2. BLUE CONSISTENCY (Primary)
   ========================================= */

/* Header Tabel Master */
.colored-header :deep(thead th) {
  background-color: #1976D2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
  font-size: 11px;
}

/* Header Tabel Detail (Warna sedikit lebih soft agar hirarki jelas) */
.colored-header-sub :deep(thead th) {
  background-color: #424242 !important;
  /* Abu-abu gelap profesional */
  color: white !important;
  font-size: 10px;
}

/* Checkbox Header agar Putih */
.colored-header :deep(thead .v-checkbox-btn .v-selection-control__wrapper) {
  color: white !important;
}

/* Highlight Baris Master yang Dipilih */
.master-table :deep(tr.v-data-table__selected) {
  background-color: #E3F2FD !important;
}

/* Hover Effect */
.master-table :deep(tbody tr:hover) {
  cursor: pointer;
  background-color: #f5f5f5 !important;
}

/* =========================================
   3. EXPANDED DETAIL STYLING
   ========================================= */
.expanded-detail-cell {
  padding: 0 !important;
  background-color: #f8f9fa;
}

.detail-container {
  padding: 10px 16px 10px 60px;
  /* Indentasi agar terlihat "di dalam" master */
}

.detail-table-wrapper {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.detail-table :deep(td) {
  font-size: 11px !important;
}
</style>
