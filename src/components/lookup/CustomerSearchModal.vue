<script setup lang="ts">
import { ref, watch } from 'vue';
import type { VDataTableHeaders } from 'vuetify/components';
import api from '@/services/api';
import { useToast } from 'vue-toastification';

interface CustomerItem {
  cus_kode: string;
  cus_nama: string;
  cus_alamat: string;
  cus_kota: string;
}

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(['update:modelValue', 'customer-selected']);

const toast = useToast();
const items = ref<CustomerItem[]>([]);
const loading = ref(false);
const search = ref('');

const headers: VDataTableHeaders = [
  { title: 'Kode', key: 'Kode', width: '120px' }, // Gunakan 'Kode' bukan 'cus_kode'
  { title: 'Nama Pelanggan', key: 'Nama', minWidth: '200px' }, // Gunakan 'Nama'
  { title: 'Alamat', key: 'Alamat' }, // Gunakan 'Alamat'
  { title: 'Kota', key: 'Kota', width: '120px' }, // Gunakan 'Kota'
];

const loadCustomers = async () => {
  loading.value = true;
  try {
    // Menggunakan endpoint customer yang sudah ada
    const response = await api.get('/customers');
    items.value = response.data;
  } catch (err) {
    toast.error('Gagal memuat data customer.');
  } finally {
    loading.value = false;
  }
};

const selectItem = (item: any) => {
  // item sekarang berisi { Kode, Nama, Alamat, Kota, ... }
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
          density="compact" fixed-header class="desktop-table flex-grow-1"
          @click:row="(e, { item }) => selectItem(item)">
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
