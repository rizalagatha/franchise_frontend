<script setup lang="ts">
// Props untuk mengontrol visibilitas modal
const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'select']);

// Fungsi untuk mengirim pilihan layout cetak [cite: 2025-09-03]
const selectOption = (type: 'a4' | 'kasir' | 'wa') => {
  emit('select', type);
  emit('update:modelValue', false);
};
</script>

<template>
  <v-dialog :model-value="modelValue" @update:modelValue="$emit('update:modelValue', $event)" max-width="350px">
    <v-card class="rounded-xl pa-2">
      <v-card-title class="text-center text-subtitle-2 font-weight-bold pt-4">
        Pilih Format Cetak
      </v-card-title>

      <v-card-text class="pa-4">
        <div class="d-flex flex-column gap-3">
          <v-btn block variant="tonal" color="primary" prepend-icon="mdi-file-document-outline" class="rounded-lg py-6"
            @click="selectOption('a4')">
            Invoice Standar (A4)
          </v-btn>

          <v-btn block variant="tonal" color="secondary" prepend-icon="mdi-printer-pos-outline" class="rounded-lg py-6"
            @click="selectOption('kasir')">
            Struk Kasir (58mm)
          </v-btn>

          <v-btn block variant="text" color="success" prepend-icon="mdi-whatsapp" class="rounded-lg"
            @click="selectOption('wa')">
            Kirim via WhatsApp
          </v-btn>
        </div>
      </v-card-text>

      <v-card-actions class="justify-center pb-4">
        <v-btn variant="plain" size="small" @click="$emit('update:modelValue', false)">
          Batal
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Paksa font 11px sesuai instruksi sebelumnya */
:deep(*) {
  font-size: 11px !important;
}

.gap-3 {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
