<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  modelValue: boolean;
  historyData: any[];
  isLoading: boolean;
  selectedItem: any;
}>();

const emit = defineEmits(["update:modelValue"]);

const closeDialog = () => {
  emit("update:modelValue", false);
};

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

const historyHeaders = [
  { title: "Tanggal Update", key: "Tanggal", width: "180px" },
  { title: "Harga Jual", key: "Harga", align: "end" as const, width: "150px" }, // <--- Tambahkan as const di sini
  { title: "Diupdate Oleh", key: "Created", width: "150px" },
];
</script>

<template>
  <v-dialog v-model="dialogVisible" persistent max-width="600px">
    <v-card class="dialog-card rounded-lg">
      <v-card-title class="bg-primary text-white pa-4 d-flex align-center">
        <v-icon color="white" class="mr-2">mdi-history</v-icon>
        <span class="text-subtitle-1 font-weight-bold">
          Riwayat Harga: {{ selectedItem?.Nama }} ({{ selectedItem?.Ukuran }})
        </span>
        <v-spacer></v-spacer>
        <v-btn
          icon="mdi-close"
          variant="text"
          color="white"
          size="small"
          @click="closeDialog"
        ></v-btn>
      </v-card-title>

      <v-card-text class="pa-4 bg-grey-lighten-4">
        <v-data-table
          :headers="historyHeaders"
          :items="historyData"
          :loading="isLoading"
          density="compact"
          class="elevation-1 rounded-lg colored-header zebra-table"
          items-per-page="10"
        >
          <template #[`item.Harga`]="{ value }">
            <span class="font-weight-bold text-primary">{{
              formatCurrency(value)
            }}</span>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

          <template v-slot:no-data>
            <div class="text-center pa-4 text-grey">
              Tidak ada riwayat harga ditemukan.
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.dialog-card :deep(*) {
  font-size: 11px !important;
}
.colored-header :deep(thead th) {
  background-color: #455a64 !important; /* Gunakan Abu-abu Gelap untuk sub-tabel */
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}
.zebra-table :deep(tbody tr:nth-of-type(odd)) {
  background-color: #fcfcfc !important;
}
</style>
