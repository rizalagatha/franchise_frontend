<script setup lang="ts">
import { ref, watch } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(["update:modelValue", "cabang-selected"]);

const toast = useToast();
const search = ref("");
const items = ref<any[]>([]);
const loading = ref(false);

const headers = [
  { title: "KODE", key: "Kode", width: "120px" },
  { title: "NAMA PERUSAHAAN", key: "Nama", minWidth: "250px" },
];

const loadData = async () => {
  if (!props.modelValue) return;
  loading.value = true;
  try {
    const response = await api.get("/perusahaan");
    items.value = response.data;
  } catch (err) {
    toast.error("Gagal memuat data perusahaan.");
  } finally {
    loading.value = false;
  }
};

const handleRowClick = (event: any, { item }: any) => {
  selectItem(item);
};

const selectItem = (item: any) => {
  const rawItem = item?.raw || item;
  emit("cabang-selected", rawItem);
  emit("update:modelValue", false);
};

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      search.value = "";
      // Selalu refresh data saat buka untuk memastikan data terbaru
      loadData();
    }
  },
);
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="700px"
    persistent
    scrollable
  >
    <v-card class="dialog-lookup rounded-lg">
      <v-toolbar color="primary" density="compact">
        <v-icon class="ml-4 mr-2">mdi-office-building-marker-outline</v-icon>
        <span class="text-subtitle-2 font-weight-bold"
          >Bantuan - Pilih Cabang / Perusahaan</span
        >
        <v-spacer></v-spacer>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          @click="emit('update:modelValue', false)"
        ></v-btn>
      </v-toolbar>

      <v-card-text class="pa-4 bg-grey-lighten-4">
        <v-text-field
          v-model="search"
          label="Cari kode atau nama perusahaan..."
          variant="outlined"
          density="compact"
          bg-color="white"
          prepend-inner-icon="mdi-magnify"
          hide-details
          autofocus
          clearable
          class="mb-4"
        ></v-text-field>

        <div class="table-border rounded-lg overflow-hidden border">
          <v-data-table
            :headers="headers"
            :items="items"
            :search="search"
            :loading="loading"
            item-value="Kode"
            hover
            density="compact"
            fixed-header
            height="400px"
            class="lookup-table colored-header"
            :items-per-page="10"
            @click:row="handleRowClick"
          >
            <template #[`item.Kode`]="{ value }">
              <span class="font-weight-bold text-blue-darken-2">{{
                value
              }}</span>
            </template>

            <template v-slot:loading>
              <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
            </template>

            <template v-slot:no-data>
              <div class="pa-4 text-center text-grey">
                Data perusahaan tidak ditemukan.
              </div>
            </template>
          </v-data-table>
        </div>
      </v-card-text>

      <v-divider></v-divider>
      <v-card-actions class="pa-3 bg-white">
        <span class="text-caption text-grey ml-2 italic"
          >* Klik pada baris untuk memilih perusahaan</span
        >
        <v-spacer></v-spacer>
        <v-btn
          variant="tonal"
          color="grey-darken-3"
          size="small"
          @click="emit('update:modelValue', false)"
          >Tutup</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.dialog-lookup :deep(*) {
  font-size: 11px !important;
}

.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
}

.lookup-table :deep(tbody tr) {
  cursor: pointer !important;
}

.lookup-table :deep(tbody tr:hover) {
  background-color: #e3f2fd !important;
}

.table-border {
  border: 1px solid #e0e0e0;
}
</style>
