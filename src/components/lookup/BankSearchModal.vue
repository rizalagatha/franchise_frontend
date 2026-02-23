<script setup lang="ts">
import { ref, watch } from 'vue';
import type { VDataTableHeaders } from 'vuetify/components';
import api from '@/services/api';
import { useToast } from 'vue-toastification';

interface BankItem {
  rek_nomor: string;
  rek_namabank: string;
  rek_nama: string;
}

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(['update:modelValue', 'bank-selected']);

const toast = useToast();
const items = ref<BankItem[]>([]);
const loading = ref(false);
const search = ref('');

const headers: VDataTableHeaders = [
  // 'key' HARUS sama persis dengan alias di backend (Case Sensitive!)
  { title: 'No. Rekening', key: 'NoRekening', width: '150px' },
  { title: 'Nama Bank', key: 'NamaBank', width: '200px' },
  { title: 'Atas Nama', key: 'AtasNama' },
];

const loadBanks = async () => {
  loading.value = true;
  try {
    const response = await api.get('/rekening');
    items.value = response.data;
  } catch (err) {
    toast.error('Gagal memuat data rekening bank.');
  } finally {
    loading.value = false;
  }
};

const selectBank = (bank: BankItem) => {
  emit('bank-selected', bank);
  emit('update:modelValue', false);
};

watch(() => props.modelValue, (val) => {
  if (val) {
    search.value = '';
    loadBanks();
  }
});
</script>

<template>
  <v-dialog :model-value="modelValue" @update:modelValue="$emit('update:modelValue', $event)" max-width="700px"
    scrollable>
    <v-card style="height: 60vh;">
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-1">Bantuan - Pilih Bank</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" variant="text"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-4 d-flex flex-column">
        <v-text-field v-model="search" label="Cari bank atau nomor rekening..." variant="outlined" density="comfortable"
          prepend-inner-icon="mdi-magnify" hide-details class="mb-4" autofocus></v-text-field>

        <v-data-table :headers="headers" :items="items" :search="search" :loading="loading" item-value="rek_nomor" hover
          density="compact" fixed-header class="desktop-table flex-grow-1"
          @click:row="(e, { item }) => selectBank(item)">
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
