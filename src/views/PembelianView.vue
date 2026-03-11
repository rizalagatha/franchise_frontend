<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { format, subDays } from 'date-fns';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import * as XLSX from 'xlsx';
import type { AxiosError } from 'axios';

// Store & composables
const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();
const MENU_ID = '22';

// Interface Data Header
interface PembelianHeader {
  Nomor: string
  Tanggal: string
  NoInvoice: string
  TglInvoice: string
  NominalPembelian: number
  Keterangan: string
  Created: string
  Modified: string
}

// Interface Data Detail
interface PembelianDetail {
  Nomor: string;
  Kode: string;
  Nama: string;
  Ukuran: string;
  Jumlah: number;
  Hpp: number;
  Total: number;
}

type TableHeader = {
  title: string
  key: string
  width?: string
  minWidth?: string
  align?: 'start' | 'center' | 'end'
}

// --- State ---
const headersData = ref<PembelianHeader[]>([]);
const detailsData = ref<{ [key: string]: PembelianDetail[] }>({});
const selected = ref<PembelianHeader[]>([]);
const isLoadingHeaders = ref(true);
const loadingDetails = ref<Set<string>>(new Set());
const expanded = ref<PembelianHeader[]>([]);
const search = ref(''); // Untuk search client-side di tabel header

// State Filter Tanggal (Default 1 minggu terakhir)
const startDate = ref(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));

// State Dialog Konfirmasi Hapus
const confirmDeleteDialogVisible = ref(false);
const itemToDelete = ref<PembelianHeader | null>(null);
const isDeleting = ref(false);

// Hak akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete'));
const isSingleSelected = computed(() => selected.value.length === 1);

// Format Angka
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};


// Header Tabel Master (Header Pembelian)
const masterHeaders: TableHeader[] = [
  { title: 'Nomor', key: 'Nomor', width: '180px' },
  { title: 'Tanggal', key: 'Tanggal', width: '120px' },
  { title: 'No. Invoice', key: 'NoInvoice', width: '150px' },
  { title: 'Tgl Invoice', key: 'TglInvoice', width: '120px' },
  { title: 'Nominal', key: 'NominalPembelian', align: 'end', width: '150px' },
  { title: 'Keterangan', key: 'Keterangan', minWidth: '200px' },
  { title: 'Created', key: 'Created', width: '120px' },
  { title: '', key: 'data-table-expand', width: '40px', align: 'end' },
];
// Header Tabel Detail (Item Pembelian)
const detailHeaders: TableHeader[] = [
  { title: 'Kode', key: 'Kode', width: '120px' },
  { title: 'Nama Barang', key: 'Nama', width: '300px' },
  { title: 'Ukuran', key: 'Ukuran', align: 'center', width: '80px' },
  { title: 'Jumlah', key: 'Jumlah', align: 'end', width: '100px' },
  { title: 'HPP', key: 'Hpp', align: 'end', width: '120px' },
  { title: 'Total', key: 'Total', align: 'end', width: '130px' },
];

// --- Methods ---
const fetchHeadersData = async () => {
  isLoadingHeaders.value = true;
  selected.value = [];
  expanded.value = [];
  detailsData.value = {};
  try {
    const response = await api.get('/pembelian', {
      params: { startDate: startDate.value, endDate: endDate.value }
    });
    headersData.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data pembelian.');
    console.error(error);
  } finally {
    isLoadingHeaders.value = false;
  }
};

const fetchDetailsData = async (nomor: string) => {
  loadingDetails.value.add(nomor);
  try {
    const response = await api.get(`/pembelian/${nomor}/details`);
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail untuk nomor ${nomor}.`);
    expanded.value = expanded.value.filter(h => h !== nomor);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

const handleRowClick = (event: PointerEvent, { item }: { item: PembelianHeader }) => {
  // Toggle selection berdasarkan Nomor Pembelian
  if (selected.value.length > 0 && selected.value[0].Nomor === item.Nomor) {
    selected.value = [];
  } else {
    selected.value = [item];
  }
};

// Perbarui Watcher Anda menjadi seperti ini:
watch(expanded, (newExpandedRows) => {
  // Karena return-object aktif, 'row' di sini adalah satu baris data utuh (Object)
  const rowToLoad = newExpandedRows.find(row =>
    !detailsData.value[row.Nomor] &&
    !loadingDetails.value.has(row.Nomor)
  );

  if (rowToLoad) {
    // Kirim Properti Nomor-nya saja ke fungsi API
    fetchDetailsData(rowToLoad.Nomor);
  }
}, { deep: true });

// Navigasi
const openNewForm = () => {
  router.push({ name: 'PembelianBaru' });
};
const openEditForm = (item?: PembelianHeader) => {
  const itemToEdit = item || selected.value[0];
  if (!itemToEdit) return;
  router.push({
    name: 'PembelianUbah',
    params: { nomor: itemToEdit.Nomor }
  });
};

// Hapus
const confirmDelete = (item?: PembelianHeader) => {
  const itemToDeleteVal = item || selected.value[0];
  if (!itemToDeleteVal) return;
  itemToDelete.value = itemToDeleteVal;
  confirmDeleteDialogVisible.value = true;
};

const executeDelete = async () => {
  if (!itemToDelete.value) return;
  isDeleting.value = true;
  try {
    const nomor = itemToDelete.value.Nomor;
    await api.delete(`/pembelian/${nomor}`);
    toast.success(`Data pembelian ${nomor} berhasil dihapus.`);
    fetchHeadersData(); // Muat ulang data master
  } catch (error: unknown) {
    const err = error as AxiosError<{ message?: string }>;
    toast.error(err.response?.data?.message || 'Gagal menghapus data.');
  } finally {
    isDeleting.value = false;
    confirmDeleteDialogVisible.value = false;
    itemToDelete.value = null;
  }
};

// Export (Header)
const exportHeaderData = () => {
  if (headersData.value.length === 0)
    return toast.warning('Tidak ada data header untuk diekspor.');

  const dataToExport = headersData.value.map(h => ({
    'Nomor': h.Nomor,
    'Tanggal': h.Tanggal,
    'No Invoice': h.NoInvoice,
    'Tgl Invoice': h.TglInvoice,
    'Nominal Pembelian': h.NominalPembelian,
    'Keterangan': h.Keterangan,
    'Created': h.Created,
    'Modified': h.Modified,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Header Pembelian");

  XLSX.writeFile(workbook, "Export_Pembelian_Header.xlsx");
};

// Export (Detail)
const exportDetailData = () => {
  if (!isSingleSelected.value) {
    return toast.warning('Pilih satu header pembelian untuk mengekspor detailnya.');
  }
  const first = selected.value[0]
  if (!first) return

  const selectedNomor = first.Nomor;
  const detailToExport = detailsData.value[selectedNomor];

  if (!detailToExport || detailToExport.length === 0) {
    if (!loadingDetails.value.has(selectedNomor)) {
      toast.info("Mengambil data detail, silakan coba export lagi...");
      fetchDetailsData(selectedNomor);
    }
    return toast.warning('Data detail belum dimuat. Buka detailnya lalu coba lagi.');
  }

  const dataToExport = detailToExport.map(d => ({
    'Nomor': d.Nomor,
    'Kode': d.Kode,
    'Nama Barang': d.Nama,
    'Ukuran': d.Ukuran,
    'Jumlah': d.Jumlah,
    'HPP': d.Hpp,
    'Total': d.Total,
  }));
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Detail ${selectedNomor}`);
  XLSX.writeFile(workbook, `Detail_Pembelian_${selectedNomor}.xlsx`);
};

watch([startDate, endDate], (newDates, oldDates) => {
  // Cek untuk menghindari pemanggilan ganda saat komponen dimuat
  // (meskipun fetchHeadersData sudah menangani state loading)
  if (newDates[0] !== oldDates[0] || newDates[1] !== oldDates[1]) {
    fetchHeadersData();
  }
});

// Ambil data awal
onMounted(() => {
  if (hasViewPermission.value) {
    fetchHeadersData();
  } else {
    isLoadingHeaders.value = false;
    toast.error("Anda tidak memiliki izin untuk melihat halaman ini.");
  }
});
</script>

<template>
  <PageLayout title="Browse Pembelian" :menu-id="MENU_ID" icon="mdi-cart-arrow-down">

    <!-- Tombol Header -->
    <template #header-actions>
      <v-btn v-if="canInsert" size="small" color="primary" @click="openNewForm" prepend-icon="mdi-plus">Baru</v-btn>
      <v-btn v-if="canEdit" size="small" :disabled="!isSingleSelected" @click="openEditForm()"
        prepend-icon="mdi-pencil">Ubah</v-btn>
      <v-btn v-if="canDelete" size="small" color="error" :disabled="!isSingleSelected" @click="confirmDelete()"
        prepend-icon="mdi-delete">Hapus</v-btn>
      <v-menu offset-y>
        <template v-slot:activator="{ props }">
          <v-btn size="small" color="green" prepend-icon="mdi-file-excel" v-bind="props">Export</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item @click="exportHeaderData"><v-list-item-title>Export Header</v-list-item-title></v-list-item>
          <v-list-item @click="exportDetailData" :disabled="!isSingleSelected"><v-list-item-title>Export
              Detail</v-list-item-title></v-list-item>
        </v-list>
      </v-menu>
    </template>

    <!-- Konten Utama (Browse) -->
    <div v-if="hasViewPermission" class="browse-content">
      <!-- Filter Section -->
      <div class="filter-section">
        <span class="filter-label mr-2">Filter Periode:</span>
        <v-text-field v-model="startDate" type="date" density="compact" variant="outlined" hide-details
          style="max-width: 160px;" class="mr-2"></v-text-field>
        <span>s/d</span>
        <v-text-field v-model="endDate" type="date" density="compact" variant="outlined" hide-details
          style="max-width: 160px;" class="ml-2"></v-text-field>
        <v-text-field v-model="search" density="compact" label="Cari..." prepend-inner-icon="mdi-magnify"
          variant="outlined" hide-details single-line class="ml-4"></v-text-field>
        <v-spacer></v-spacer>
        <v-btn @click="fetchHeadersData" icon="mdi-refresh" variant="text" size="small" :disabled="isLoadingHeaders"
          aria-label="Refresh Data"></v-btn>
      </div>

      <!-- Table Container -->
      <div class="table-container">
        <v-data-table v-model:expanded="expanded" v-model="selected" :headers="masterHeaders" :items="headersData"
          :search="search" :loading="isLoadingHeaders" item-value="Nomor" density="compact"
          class="desktop-table fill-height-table colored-header" fixed-header show-select return-object show-expand
          select-strategy="single" @click:row="handleRowClick" :items-per-page="50">
          <!-- Format Kolom Nominal -->
          <template #[`item.NominalPembelian`]="{ value }">
            <span class="font-weight-bold">{{ formatCurrency(value) }}</span>
          </template>

          <!-- Slot untuk Expanded Row (Tabel Detail) -->
          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="expanded-detail-cell">
                <div class="detail-container">
                  <div class="detail-table-wrapper elevation-1">
                    <div v-if="loadingDetails.has(item.Nomor)" class="text-center py-4">
                      <v-progress-circular indeterminate size="24" color="primary"></v-progress-circular>
                    </div>

                    <v-data-table v-else-if="detailsData[item.Nomor]?.length" :headers="detailHeaders"
                      :items="detailsData[item.Nomor]" density="compact"
                      class="detail-table colored-header-sub zebra-table" hide-default-footer>
                      <template #[`item.Jumlah`]="{ value }">{{ formatNumber(value) }}</template>
                      <template #[`item.Hpp`]="{ value }">{{ formatCurrency(value) }}</template>
                      <template #[`item.Total`]="{ value }">
                        <span class="text-primary font-weight-bold">{{ formatCurrency(value) }}</span>
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
            <div class="text-center pa-4">Tidak ada data pembelian untuk periode ini.</div>
          </template>
        </v-data-table>
      </div>
    </div>

    <!-- Tampilan Akses Ditolak -->
    <div v-else class="state-container">
      <v-icon size="64" class="mb-4">mdi-lock-outline</v-icon>
      <h3 class="text-h6">Akses Ditolak</h3>
      <p>Anda tidak memiliki izin untuk melihat halaman ini.</p>
    </div>

    <!-- Dialog Konfirmasi Hapus -->
    <v-dialog v-model="confirmDeleteDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-delete-alert-outline</v-icon>
          Konfirmasi Hapus
        </v-card-title>
        <v-card-text>
          Yakin ingin menghapus data pembelian <strong>{{ itemToDelete?.Nomor }}</strong>?
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
/* Paksa Konsistensi Font 11px untuk seluruh konten */
.browse-content :deep(*) {
  font-size: 11px !important;
}

/* Layout Dasar */
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

/* --- KONSISTENSI BIRU (PRIMARY) --- */

/* Header Tabel Master */
.colored-header :deep(thead th) {
  background-color: #1976D2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}

/* Header Tabel Detail (Abu-abu Gelap) */
.colored-header-sub :deep(thead th) {
  background-color: #455A64 !important;
  color: white !important;
  font-size: 10px !important;
}

/* Checkbox Header Putih */
.colored-header :deep(thead .v-checkbox-btn .v-selection-control__wrapper) {
  color: white !important;
}

/* Highlight Baris Dipilih */
.desktop-table :deep(tr.v-data-table__selected) {
  background-color: #E3F2FD !important;
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

/* --- EXPANDED DETAIL STYLING --- */
.expanded-detail-cell {
  padding: 0 !important;
  background-color: #f8f9fa;
}

.detail-container {
  padding: 10px 16px 10px 60px;
  /* Indentasi agar rapi */
}

.detail-table-wrapper {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background-color: white;
}
</style>
