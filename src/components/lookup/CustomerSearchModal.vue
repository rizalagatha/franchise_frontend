<script setup lang="ts">
import { ref, watch } from 'vue';
import api from '@/services/api';
import { useToast } from 'vue-toastification';

interface CustomerItem {
  Kode: string
  Nama: string
  Alamat: string
  Kota: string
  Telp?: string
  Nama_Kontak?: string
  Aktif?: string
  Created?: string
  Modified?: string
}

type TableHeader = {
  title: string
  key: string // Gunakan 'key', bukan 'value'
  width?: string
  minWidth?: string
}

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(['update:modelValue', 'customer-selected']);

const toast = useToast();
const items = ref<CustomerItem[]>([]);
const loading = ref(false);
const search = ref('');

const headers: TableHeader[] = [
  { title: 'Kode', key: 'Kode', width: '120px' },
  { title: 'Nama Pelanggan', key: 'Nama', minWidth: '200px' },
  { title: 'Alamat', key: 'Alamat' },
  { title: 'Kota', key: 'Kota', width: '120px' },
]

const loadCustomers = async () => {
  loading.value = true;
  try {
    const response = await api.get('/customers');
    // Backend mengembalikan "Kode", "Nama", dll. Bukan "cus_kode"
    items.value = response.data.map((c: any) => ({
      Kode: c.Kode,
      Nama: c.Nama,
      Alamat: c.Alamat,
      Kota: c.Kota,
      // Tambahkan property lain jika dibutuhkan oleh form kasir
      Telp: c.Telp
    }));
  } catch (err) {
    toast.error('Gagal memuat data customer.');
  } finally {
    loading.value = false;
  }
};

const handleRowClick = (event: PointerEvent, { item }: { item: CustomerItem }) => {
  selectItem(item);
};

const selectItem = (item: any) => {
  if (!item) return;
  console.log("Customer dipilih:", item);
  emit('customer-selected', item);
  emit('update:modelValue', false);
};

watch(() => props.modelValue, (val) => {
  if (val) {
    search.value = '';
    loadCustomers();
  }
});
</script>

<template>
  <v-dialog :model-value="modelValue" @update:modelValue="$emit('update:modelValue', $event)" max-width="900px"
    scrollable>
    <v-card style="height: 80vh;">
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-1">Bantuan - Cari Customer</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" variant="text"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-4 d-flex flex-column">
        <v-text-field v-model="search" label="Cari nama, alamat, atau kota..." variant="outlined" density="comfortable"
          prepend-inner-icon="mdi-magnify" hide-details class="mb-4" autofocus></v-text-field>

        <v-data-table :headers="headers" :items="items" :search="search" :loading="loading" item-value="Kode" hover
          density="compact" fixed-header class="desktop-table flex-grow-1" style="cursor: pointer"
          @click:row="handleRowClick">
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
