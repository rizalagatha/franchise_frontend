<script setup lang="ts">
import { ref, watch, computed } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import type { AxiosError } from "axios";

const toast = useToast();

interface LookupItem {
  kode: string;
  nama: string;
  barcode: string;
  ukuran: string;
  stok: number;
  harga: number;
}

const props = defineProps<{
  modelValue: boolean;
  // TAMBAHAN: Tambahkan 'minta-barang' ke dalam daftar source
  source:
    | "cetak-barcode"
    | "koreksi-stok"
    | "kasir"
    | "barcode"
    | "minta-barang";
  tanggal?: string;
}>();

const emit = defineEmits(["update:modelValue", "item-selected"]);

// State Modal
const items = ref<LookupItem[]>([]);
const loading = ref(false);
const search = ref("");
const options = ref({ page: 1, itemsPerPage: 15 });
const totalItems = ref(0);

// Endpoint dinamis berdasarkan asal panggil
const apiUrl = computed(() => {
  if (props.source === "koreksi-stok") return "/koreksi-stok/lookup/f1";
  // TAMBAHAN: Rute khusus untuk minta barang dari server Pusat
  if (props.source === "minta-barang")
    return "/minta-barang-kaosan/lookup/barang";

  // Default
  return "/barcodes/lookup/barang";
});

// Header dinamis
const headers = computed(() => {
  const base = [
    { title: "KODE", key: "kode", width: "120px" },
    { title: "BARCODE", key: "barcode", width: "130px" },
    { title: "NAMA BARANG", key: "nama", minWidth: "200px" },
    { title: "SIZE", key: "ukuran", width: "80px", align: "center" as const },
  ];

  // Kasir & Koreksi butuh info finansial & stok
  if (props.source === "kasir" || props.source === "koreksi-stok") {
    return [
      ...base,
      { title: "HARGA", key: "harga", width: "110px", align: "end" as const },
      { title: "STOK", key: "stok", width: "90px", align: "end" as const },
    ];
  }

  // Untuk minta-barang & barcode, cukup return 'base' saja
  return base;
});

const loadItems = async () => {
  if (!props.modelValue) return;
  loading.value = true;
  try {
    const response = await api.get(apiUrl.value, {
      params: {
        term: search.value,
        keyword: search.value, // Kita kirim dua-duanya agar backend mana pun tetap jalan
        page: options.value.page,
        itemsPerPage: options.value.itemsPerPage,
        tanggal: props.tanggal,
      },
    });

    // PERBAIKAN: Handle perbedaan struktur respons API
    // (Ada API yang melempar array langsung, ada yang melempar objek { items, total })
    if (Array.isArray(response.data)) {
      items.value = response.data;
      totalItems.value = response.data.length;
    } else {
      items.value = response.data.items || [];
      totalItems.value = response.data.total || 0;
    }
  } catch (err) {
    const error = err as AxiosError<{ message?: string }>;
    toast.error(error.response?.data?.message || "Gagal memuat data barang.");
  } finally {
    loading.value = false;
  }
};

// Fungsi handler klik baris
const handleRowClick = (event: any, { item }: any) => {
  selectItem(item);
};

const selectItem = (item: any) => {
  emit("item-selected", item);
  emit("update:modelValue", false);
};

// Search dengan debounce
let timer: any;
watch(search, () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    options.value.page = 1;
    loadItems();
  }, 500);
});

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      search.value = "";
      options.value.page = 1;
      loadItems();
    }
  },
);

const formatCurrency = (v: any) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(v || 0);
const formatNumber = (v: any) => new Intl.NumberFormat("id-ID").format(v || 0);
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
        <v-icon class="ml-4 mr-2">mdi-magnify</v-icon>
        <span class="text-subtitle-2 font-weight-bold"
          >Bantuan - Cari Data Barang</span
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
          label="Ketik Kode, Nama, atau Scan Barcode..."
          variant="outlined"
          density="compact"
          bg-color="white"
          prepend-inner-icon="mdi-magnify"
          hide-details
          autofocus
          class="mb-4"
          @keyup.enter="loadItems"
        ></v-text-field>

        <div class="table-border rounded-lg overflow-hidden border">
          <v-data-table-server
            v-model:page="options.page"
            v-model:items-per-page="options.itemsPerPage"
            :headers="headers"
            :items="items"
            :items-length="totalItems"
            :loading="loading"
            density="compact"
            fixed-header
            height="450px"
            hover
            class="lookup-table colored-header"
            @update:options="loadItems"
            @click:row="handleRowClick"
          >
            <template #[`item.kode`]="{ item }">
              <span class="font-weight-bold text-blue-darken-2">{{
                item.kode
              }}</span>
            </template>

            <template #[`item.harga`]="{ value }">
              <span class="font-weight-black text-primary">{{
                formatCurrency(value)
              }}</span>
            </template>

            <template #[`item.stok`]="{ value }">
              <v-chip
                :color="value <= 0 ? 'error' : 'success'"
                size="x-small"
                variant="flat"
                class="font-weight-bold"
              >
                {{ formatNumber(value) }}
              </v-chip>
            </template>

            <template v-slot:loading>
              <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
            </template>
          </v-data-table-server>
        </div>
      </v-card-text>

      <v-divider></v-divider>
      <v-card-actions class="pa-3 bg-white">
        <span class="text-caption text-grey ml-2 italic"
          >* Klik pada baris data atau tekan Enter untuk memilih</span
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
.lookup-table :deep(tbody tr:hover) {
  background-color: #e3f2fd !important;
  cursor: pointer;
}
.table-border {
  border: 1px solid #e0e0e0;
}

.lookup-table :deep(tbody tr) {
  cursor: pointer !important;
}
.lookup-table :deep(tbody tr:hover) {
  background-color: #e3f2fd !important;
}
</style>
