<script setup lang="ts">
import { ref, watch } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";

interface CustomerItem {
  Kode: string;
  Nama: string;
  Alamat: string;
  Kota: string;
  Telp?: string;
}

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(["update:modelValue", "customer-selected"]);

const toast = useToast();
const items = ref<CustomerItem[]>([]);
const loading = ref(false);
const search = ref("");

const headers = [
  { title: "KODE", key: "Kode", width: "120px" },
  { title: "NAMA PELANGGAN", key: "Nama", minWidth: "200px" },
  { title: "ALAMAT", key: "Alamat", minWidth: "250px" },
  { title: "KOTA", key: "Kota", width: "120px" },
];

const loadCustomers = async () => {
  if (!props.modelValue) return;
  loading.value = true;
  try {
    const response = await api.get("/customers");
    items.value = response.data.map((c: any) => ({
      Kode: c.Kode,
      Nama: c.Nama,
      Alamat: c.Alamat,
      Kota: c.Kota,
      Telp: c.Telp,
    }));
  } catch (err) {
    toast.error("Gagal memuat data customer.");
  } finally {
    loading.value = false;
  }
};

const handleRowClick = (event: any, { item }: any) => {
  selectItem(item);
};

const selectItem = (item: any) => {
  if (!item) return;
  emit("customer-selected", item);
  emit("update:modelValue", false);
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      search.value = "";
      loadCustomers();
    }
  },
);
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="900px"
    persistent
    scrollable
  >
    <v-card class="dialog-lookup rounded-lg">
      <v-toolbar color="primary" density="compact">
        <v-icon class="ml-4 mr-2">mdi-account-search-outline</v-icon>
        <span class="text-subtitle-2 font-weight-bold"
          >Bantuan - Pilih Customer</span
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
          label="Cari nama, alamat, atau kota..."
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
            height="450px"
            class="lookup-table colored-header"
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
                Data customer tidak ditemukan.
              </div>
            </template>
          </v-data-table>
        </div>
      </v-card-text>

      <v-divider></v-divider>
      <v-card-actions class="pa-3 bg-white">
        <span class="text-caption text-grey ml-2 italic"
          >* Klik pada baris untuk memilih customer</span
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
  text-transform: uppercase;
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
