<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { VDataTableHeaders, VDataTableServer } from 'vuetify/components';
import api from '@/services/api';
import { useToast } from 'vue-toastification';
import type { AxiosError } from 'axios';

const toast = useToast();

// Interface disederhanakan untuk franchise (Kode & Nama)
interface LookupItem {
  kode: string;
  nama: string;
  barcode?: string;
  ukuran?: string;
  stok?: number | null;
  hpp?: number | null;
  harga?: number | null; // Untuk cetak barcode
}

// Props & Emits
// modelValue untuk kontrol v-dialog
// source tidak perlu serumit retail
const props = defineProps<{
  modelValue: boolean;
  source: 'cetak-barcode' | 'koreksi-stok';
  tanggal?: string; // Opsional: hanya untuk 'koreksi-stok'
}>();
const emit = defineEmits(['update:modelValue', 'item-selected']);

// State Modal
const items = ref<LookupItem[]>([]);
const loading = ref(true);
const search = ref('');
// State untuk VDataTableServer
const options = ref({ page: 1, itemsPerPage: 15 }); // Default itemsPerPage
const totalItems = ref(0); // Total item dari server

const apiUrl = computed(() => {
  if (props.source === 'koreksi-stok') {
    return '/koreksi-stok/lookup/f1';
  }
  return '/barcodes/lookup/barang'; // Default 'cetak-barcode'
});

// Header Modal
const headers = computed<VDataTableHeaders>(() => {
  if (props.source === 'koreksi-stok') {
    // Header lengkap untuk Koreksi Stok
    return [
      { title: 'Kode', key: 'kode', width: '150px' },
      { title: 'Nama Barang', key: 'nama', minWidth: '250px' },
      { title: 'Ukuran', key: 'ukuran', width: '100px' },
      { title: 'Stok', key: 'stok', align: 'end', width: '80px' },
      { title: 'Barcode', key: 'barcode', width: '150px' },
      { title: 'HPP', key: 'hpp', align: 'end', width: '120px' },
    ];
  }
  // Default: 'cetak-barcode' (Hanya Kode & Nama)
  return [
    { title: 'Kode', key: 'kode', width: '150px' },
    { title: 'Nama Barang', key: 'nama' },
  ];
});

// Format harga
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

// Methods
const loadItems = async ({ page, itemsPerPage }: typeof options.value & { sortBy?: any } = options.value) => {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      term: search.value,
      page: page,
      itemsPerPage: itemsPerPage,
    };

    if (props.source === 'koreksi-stok') {
      if (!props.tanggal) {
        toast.error("Tanggal (dari form) diperlukan untuk F1 Koreksi Stok.");
        loading.value = false;
        return;
      }
      params.tanggal = props.tanggal;
    }

    const response = await api.get<{ items: LookupItem[], total: number }>(apiUrl.value, { params });
    items.value = response.data.items;
    totalItems.value = response.data.total;
  } catch (err) {
    const error = err as AxiosError<{ message?: string }>;
    toast.error(error.response?.data?.message || 'Gagal memuat data barang.');
    items.value = []; // Kosongkan jika error
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// Fungsi saat baris di modal diklik
const selectItem = (item: LookupItem) => {
  emit('item-selected', item); // Kirim data item yang dipilih
  emit('update:modelValue', false); // Tutup modal
};

// Debounce search
let searchTimeout: ReturnType<typeof setTimeout>;
watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    options.value.page = 1; // Reset ke halaman 1 saat search
    loadItems(options.value); // Panggil load items
  }, 500);
});

// Load data saat modal pertama kali dibuka
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    search.value = '';
    items.value = [];
    loading.value = true; // Set loading true lagi
    loadItems(); // <-- PANGGIL KEMBALI loadItems
  }
});

// Load data awal saat komponen mounted (opsional, tergantung behavior yg diinginkan)
// onMounted(() => {
//   loadItems();
// });

</script>

<template>
  <v-dialog :model-value="modelValue" @update:modelValue="$emit('update:modelValue', $event)" max-width="800px"
    persistent scrollable>
    <v-card class="dialog-card d-flex flex-column" style="height: 70vh;">
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-1">Bantuan - Cari Barang</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" variant="text" size="small"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-4 d-flex flex-column flex-grow-1">
        <v-text-field v-model="search" label="Cari berdasarkan kode, nama, atau barcode..." class="mb-4 flex-shrink-0"
          variant="outlined" density="comfortable" clearable hide-details autofocus
          @keyup.enter="options.page = 1; loadItems()"></v-text-field>

        <v-data-table-server v-model:page="options.page" v-model:items-per-page="options.itemsPerPage"
          :headers="headers" :items="items" :items-length="totalItems" :loading="loading" item-value="kode" hover
          density="compact" fixed-header class="desktop-table flex-grow-1" no-data-text="Tidak ada barang ditemukan."
          @update:options="loadItems">
          <!-- Render baris secara dinamis -->
          <template #item="{ item }">
            <tr style="cursor: pointer;" @click="selectItem(item)">
              <!-- Kolom Umum -->
              <td>{{ item.kode }}</td>
              <td>{{ item.nama }}</td>

              <!-- Kolom Khusus 'koreksi-stok' -->
              <template v-if="props.source === 'koreksi-stok'">
                <td>{{ item.ukuran }}</td>
                <td class="text-end">{{ formatNumber(item.stok) }}</td>
                <td>{{ item.barcode }}</td>
                <td class="text-end">{{ formatCurrency(item.hpp) }}</td>
              </template>
            </tr>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>
        </v-data-table-server>

      </v-card-text>
      <v-divider></v-divider>
      <v-card-actions class="dialog-footer">
        <v-spacer></v-spacer>
        <v-btn size="small" variant="text" @click="$emit('update:modelValue', false)">Tutup</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Style standar dialog */
.dialog-card {
  font-size: 12px;
}

.dialog-footer {
  border-top: 1px solid #e0e0e0;
  padding: 8px 16px;
  background-color: #f5f5f5;
}

.desktop-table {
  height: 100%;
}

.desktop-table :deep(.v-table__wrapper) {
  height: 100%;
  overflow-y: auto;
}
</style>
