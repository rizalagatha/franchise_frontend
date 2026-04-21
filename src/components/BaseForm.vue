<script setup lang="ts">
import PageLayout from "@/components/PageLayout.vue";

const props = defineProps<{
  title: string;
  menuId: string;
  icon?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  itemName?: string; // Teks khusus di dialog (Opsional)
}>();

// v-model untuk mengontrol dialog dari parent
const showSaveDialog = defineModel<boolean>("showSaveDialog");
const showCancelDialog = defineModel<boolean>("showCancelDialog");
const showCloseDialog = defineModel<boolean>("showCloseDialog");

const emit = defineEmits([
  "validate-save",
  "confirm-save",
  "confirm-cancel",
  "confirm-close",
]); // <--- TAMBAH confirm-close
</script>

<template>
  <PageLayout :title="title" :icon="icon" :menu-id="menuId" desktop-mode>
    <template #header-actions>
      <v-btn
        size="small"
        color="primary"
        @click="emit('validate-save')"
        :loading="isSaving"
        prepend-icon="mdi-content-save"
        >Simpan</v-btn
      >
      <v-btn
        size="small"
        variant="outlined"
        class="mx-2"
        @click="showCancelDialog = true"
        >Batal</v-btn
      >
      <v-btn
        size="small"
        variant="tonal"
        color="error"
        @click="showCloseDialog = true"
        prepend-icon="mdi-close"
        >Tutup</v-btn
      >
    </template>

    <v-overlay
      :model-value="isLoading"
      class="align-center justify-center"
      persistent
      scroll-strategy="none"
    >
      <v-progress-circular
        indeterminate
        color="primary"
        size="64"
      ></v-progress-circular>
    </v-overlay>

    <div class="form-grid-container bg-grey-lighten-3" v-if="!isLoading">
      <aside class="left-column">
        <slot name="left-column"></slot>
      </aside>
      <main class="right-column">
        <slot name="right-column"></slot>
      </main>
    </div>

    <v-dialog v-model="showSaveDialog" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pa-4">Konfirmasi Simpan</v-card-title>
        <v-card-text class="pa-4 pt-0">
          <div class="mb-2">
            Yakin ingin menyimpan pengaturan
            {{ itemName ? `untuk ${itemName}` : "ini" }}?
          </div>
          <slot name="dialog-warning"></slot>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showSaveDialog = false">Batal</v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            @click="emit('confirm-save')"
            :loading="isSaving"
            >Ya, Simpan</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showCancelDialog" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pa-4 d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert</v-icon>
          Konfirmasi Batal
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          Yakin ingin membatalkan? Perubahan pada data tidak akan disimpan.
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showCancelDialog = false">Tidak</v-btn>
          <v-btn
            color="error"
            variant="elevated"
            @click="emit('confirm-cancel')"
            >Ya, Batal</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showCloseDialog" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pa-4 d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-close-circle</v-icon>
          Konfirmasi Tutup
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          Yakin ingin keluar? Pastikan data sudah disimpan.
        </v-card-text>
        <v-card-actions class="pa-4 border-t">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showCloseDialog = false">Batal</v-btn>
          <v-btn color="error" variant="elevated" @click="emit('confirm-close')"
            >Ya, Keluar</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </PageLayout>
</template>

<style scoped>
.form-grid-container :deep(*) {
  font-size: 11px !important;
}
.form-grid-container {
  padding: 12px;
  height: calc(100vh - 180px);
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
}
.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.right-column {
  flex-grow: 1;
}

:deep(.desktop-form-section) {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white !important;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
}

:deep(.header-section) {
  border-top: 3px solid #1976d2 !important;
}
</style>
