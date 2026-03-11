<script setup lang="ts">
import { ref, watch } from 'vue';
import api from '@/services/api';
import { useToast } from 'vue-toastification';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(['update:modelValue', 'cabang-selected']);

const toast = useToast();
const search = ref('');
const items = ref<any[]>([]);
const loading = ref(false);

const headers: any[] = [
  { title: 'Kode', key: 'Kode', width: '120px' },
  { title: 'Nama Perusahaan', key: 'Nama' }
];

const loadData = async () => {
  loading.value = true;
  try {
    // Sesuaikan dengan endpoint backend Anda
    const response = await api.get('/perusahaan');
    items.value = response.data;
  } catch (err) {
    toast.error('Gagal memuat data perusahaan.');
  } finally {
    loading.value = false;
  }
};

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && items.value.length === 0) {
    loadData();
  }
});

const selectItem = (item: any) => {
  const rawItem = item?.raw || item;
  emit('cabang-selected', rawItem);
  emit('update:modelValue', false);
};
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600px">
    <v-card class="rounded-lg">
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">Pencarian Perusahaan</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-4">
        <v-text-field v-model="search" label="Cari Kode / Nama..." density="compact" variant="outlined"
          prepend-inner-icon="mdi-magnify" class="mb-4" hide-details clearable autofocus />

        <v-data-table :headers="headers" :items="items" :search="search" :loading="loading" density="compact" hover
          class="border rounded" :items-per-page="10" @click:row="(event, { item }) => selectItem(item)">
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
