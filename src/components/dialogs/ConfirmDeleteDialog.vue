<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  itemName: string;
  isLoading: boolean;
}>();

const emit = defineEmits(["update:modelValue", "confirm"]);

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});
</script>

<template>
  <v-dialog v-model="dialogVisible" persistent max-width="400px">
    <v-card class="rounded-lg">
      <v-card-title
        class="text-subtitle-1 font-weight-bold pa-4 d-flex align-center"
      >
        <v-icon color="error" class="mr-2">mdi-delete-alert-outline</v-icon>
        {{ title || "Konfirmasi Hapus" }}
      </v-card-title>
      <v-card-text class="pa-4 pt-0">
        Yakin ingin menghapus data <strong>{{ itemName }}</strong
        >? Tindakan ini tidak dapat dibatalkan.
      </v-card-text>
      <v-card-actions class="pa-4 border-t bg-grey-lighten-4">
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          color="grey-darken-1"
          @click="dialogVisible = false"
          :disabled="isLoading"
          class="font-weight-bold"
          >Batal</v-btn
        >
        <v-btn
          color="error"
          variant="elevated"
          @click="emit('confirm')"
          :loading="isLoading"
          class="font-weight-bold px-6"
          >Ya, Hapus</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.v-card-text {
  font-size: 12px;
}
</style>
