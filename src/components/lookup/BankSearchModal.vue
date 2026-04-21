<script setup lang="ts">
import { ref, watch } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";

interface BankItem {
  NoRekening: string;
  NamaBank: string;
  AtasNama: string;
}

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits(["update:modelValue", "bank-selected"]);

const toast = useToast();
const items = ref<BankItem[]>([]);
const loading = ref(false);
const search = ref("");

const headers = [
  { title: "NO. REKENING", key: "NoRekening", width: "180px" },
  { title: "NAMA BANK", key: "NamaBank", width: "200px" },
  { title: "ATAS NAMA", key: "AtasNama", minWidth: "200px" },
];

const loadBanks = async () => {
  if (!props.modelValue) return;
  loading.value = true;
  try {
    const response = await api.get("/rekening");
    items.value = response.data;
  } catch (err) {
    toast.error("Gagal memuat data rekening bank.");
  } finally {
    loading.value = false;
  }
};

const handleRowClick = (event: any, { item }: any) => {
  selectBank(item);
};

const selectBank = (bank: BankItem) => {
  emit("bank-selected", bank);
  emit("update:modelValue", false);
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      search.value = "";
      loadBanks();
    }
  },
);
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="800px"
    persistent
    scrollable
  >
    <v-card class="dialog-lookup rounded-lg">
      <v-toolbar color="primary" density="compact">
        <v-icon class="ml-4 mr-2">mdi-bank-outline</v-icon>
        <span class="text-subtitle-2 font-weight-bold"
          >Bantuan - Pilih Rekening Bank</span
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
          label="Cari bank, nomor rekening, atau atas nama..."
          variant="outlined"
          density="compact"
          bg-color="white"
          prepend-inner-icon="mdi-magnify"
          hide-details
          autofocus
          class="mb-4"
        ></v-text-field>

        <div class="table-border rounded-lg overflow-hidden border">
          <v-data-table
            :headers="headers"
            :items="items"
            :search="search"
            :loading="loading"
            item-value="NoRekening"
            hover
            density="compact"
            fixed-header
            height="400px"
            class="lookup-table colored-header"
            @click:row="handleRowClick"
          >
            <template #[`item.NoRekening`]="{ value }">
              <span class="font-weight-bold text-blue-darken-2">{{
                value
              }}</span>
            </template>

            <template v-slot:loading>
              <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
            </template>

            <template v-slot:no-data>
              <div class="pa-4 text-center text-grey">
                Data rekening tidak ditemukan.
              </div>
            </template>
          </v-data-table>
        </div>
      </v-card-text>

      <v-divider></v-divider>
      <v-card-actions class="pa-3 bg-white">
        <span class="text-caption text-grey ml-2 italic"
          >* Klik pada baris untuk memilih rekening</span
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
