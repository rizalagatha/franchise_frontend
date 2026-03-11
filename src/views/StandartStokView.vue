<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import * as XLSX from 'xlsx';

// Store & Konfigurasi
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '24';

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
  title: string
  key: keyof StandartStok | string
  align?: 'start' | 'center' | 'end'
  width?: string
  minWidth?: string
}

// --- State ---
const items = ref<StandartStok[]>([]);
const isLoading = ref(true);
const search = ref('');
const selected = ref<StandartStok[]>([]);
const maxField = ref();

// State Edit (PanelPSM di Delphi)
const isEditDialogOpen = ref(false);
const isSaving = ref(false);
const editForm = ref({
  kode: '',
  ukuran: '',
  nama: '',
  minBuffer: 0,
  maxBuffer: 0
});

// Hak Akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const isSingleSelected = computed(() => selected.value.length === 1);

// Header Tabel (Sesuai Delphi)
const headers: TableHeader[] = [
  { title: 'Barcode', key: 'Barcode', width: '150px' },
  { title: 'Nama Barang', key: 'Nama', minWidth: '300px' },
  { title: 'Ukuran', key: 'Ukuran', align: 'center', width: '100px' },
  { title: 'Min Buffer', key: 'MinBuffer', align: 'end', width: '120px' },
  { title: 'Max Buffer', key: 'MaxBuffer', align: 'end', width: '120px' },
  { title: 'Stok Real', key: 'Stok', align: 'end', width: '120px' },
];

// --- Methods ---

const fetchData = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/standart-stok');
    items.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data standar stok.');
  } finally {
    isLoading.value = false;
  }
};

// Fungsi warna baris (Instruksi: gunakan getRowTextColor)
const getRowTextColor = (item: any) => {
  if (item.Stok < item.MinBuffer) {
    return 'text-error font-weight-bold'; // Merah jika stok < minimal
  }
  return '';
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
    maxBuffer: target.MaxBuffer
  };
  isEditDialogOpen.value = true;
};

const saveBuffer = async () => {
  isSaving.value = true;
  try {
    await api.put('/standart-stok/update', {
      kode: editForm.value.kode,
      ukuran: editForm.value.ukuran,
      minBuffer: editForm.value.minBuffer,
      maxBuffer: editForm.value.maxBuffer
    });

    toast.success('Batas stok berhasil diperbarui.');
    isEditDialogOpen.value = false;
    fetchData(); // Refresh data
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Gagal menyimpan data.');
  } finally {
    isSaving.value = false;
  }
};

const exportToExcel = () => {
  if (items.value.length === 0) return toast.warning('Tidak ada data untuk diekspor.');

  const dataToExport = items.value.map(i => ({
    'Barcode': i.Barcode,
    'Nama Barang': i.Nama,
    'Ukuran': i.Ukuran,
    'Min Buffer': i.MinBuffer,
    'Max Buffer': i.MaxBuffer,
    'Stok Saat Ini': i.Stok,
    'Status': i.Stok < i.MinBuffer ? 'RE-STOCK' : 'AMAN'
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Standar Stok");
  XLSX.writeFile(workbook, "Standar_Stok_Report.xlsx");
};

onMounted(() => {
  if (hasViewPermission.value) fetchData();
});
</script>

<template>
  <PageLayout title="Standar Stok (Buffer)" :menu-id="MENU_ID" icon="mdi-database-outline">

    <template #header-actions>
      <v-btn v-if="canEdit" size="small" color="primary" :disabled="!isSingleSelected" @click="openEdit()"
        prepend-icon="mdi-cog">Setting (F1)</v-btn>
      <v-btn size="small" color="green" @click="exportToExcel" prepend-icon="mdi-file-excel">Export</v-btn>
      <v-btn size="small" @click="fetchData" :loading="isLoading" icon="mdi-refresh" variant="text"></v-btn>
    </template>

    <div v-if="hasViewPermission" class="browse-content">
      <div class="filter-section d-flex align-center mb-4">
        <v-text-field v-model="search" density="compact" label="Cari Barang / Barcode..."
          prepend-inner-icon="mdi-magnify" variant="outlined" hide-details single-line></v-text-field>
        <div class="ml-4 d-flex align-center">
          <v-badge color="error" dot class="mr-2"></v-badge>
          <span class="text-caption">Stok < Minimal Buffer</span>
        </div>
      </div>

      <div class="table-container">
        <v-data-table v-model="selected" :headers="headers" :items="items" :search="search" :loading="isLoading"
          item-value="Barcode" density="compact" show-select select-strategy="single" return-object fixed-header
          class="desktop-table fill-height-table" :items-per-page="50">
          <template #[`item`]="{ item }">
            <tr :class="getRowTextColor(item)">
              <td>
                <v-checkbox-btn v-model="selected" :value="item" color="primary" density="compact"
                  hide-details></v-checkbox-btn>
              </td>
              <td>{{ item.Barcode }}</td>
              <td>{{ item.Nama }}</td>
              <td class="text-center">{{ item.Ukuran }}</td>
              <td class="text-end">{{ item.MinBuffer }}</td>
              <td class="text-end">{{ item.MaxBuffer }}</td>
              <td class="text-end">{{ item.Stok }}</td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </div>

    <v-dialog v-model="isEditDialogOpen" max-width="500px" persistent>
      <v-card>
        <v-toolbar color="primary" density="compact">
          <v-toolbar-title>Setting Buffer Stok</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" @click="isEditDialogOpen = false"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-4">
          <div class="desktop-form-section header-section">
            <v-alert v-if="editForm.nama" density="compact" color="info" variant="tonal" class="mb-4 text-caption">
              {{ editForm.nama }} ({{ editForm.ukuran }})
            </v-alert>

            <v-row dense>
              <v-col cols="12">
                <v-text-field v-model.number="editForm.minBuffer" label="Minimal Buffer" type="number" density="compact"
                  variant="outlined" hide-details class="mb-3" @keyup.enter="maxField?.focus()"></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field ref="maxField" v-model.number="editForm.maxBuffer" label="Maximal Buffer" type="number"
                  density="compact" variant="outlined" hide-details @keyup.enter="saveBuffer"></v-text-field>
              </v-col>
            </v-row>
          </div>
        </v-card-text>

        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="isEditDialogOpen = false">Batal</v-btn>
          <v-btn color="primary" variant="elevated" :loading="isSaving" @click="saveBuffer">Simpan</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
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
</style>
