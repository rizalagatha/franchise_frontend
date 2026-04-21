<script setup lang="ts">
import { ref, watch } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";

const props = defineProps<{
  modelValue: boolean;
  itemData: any;
}>();

const emit = defineEmits(["update:modelValue", "saved"]);
const toast = useToast();

const isSaving = ref(false);
const maxField = ref<any>(null);

// State lokal form
const editForm = ref({
  kode: "",
  ukuran: "",
  nama: "",
  minBuffer: 0,
  maxBuffer: 0,
});

// Sinkronisasi data saat dialog dibuka
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.itemData) {
      editForm.value = {
        kode: props.itemData.Kode,
        ukuran: props.itemData.Ukuran,
        nama: props.itemData.Nama,
        minBuffer: props.itemData.MinBuffer,
        maxBuffer: props.itemData.MaxBuffer,
      };
    }
  },
);

const saveBuffer = async () => {
  isSaving.value = true;
  try {
    await api.put("/standart-stok/update", {
      kode: editForm.value.kode,
      ukuran: editForm.value.ukuran,
      minBuffer: editForm.value.minBuffer,
      maxBuffer: editForm.value.maxBuffer,
    });

    toast.success("Batas stok berhasil diperbarui.");
    emit("update:modelValue", false); // Tutup dialog
    emit("saved"); // Beri tahu parent untuk refresh tabel
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    max-width="450px"
    persistent
  >
    <v-card class="bg-grey-lighten-4 rounded-lg">
      <v-form @submit.prevent="saveBuffer">
        <v-toolbar color="primary" density="compact">
          <v-icon color="white" class="ml-4 mr-2">mdi-cog-outline</v-icon>
          <v-toolbar-title class="text-white font-weight-bold text-subtitle-2">
            Setting Buffer Stok
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn
            icon="mdi-close"
            color="white"
            variant="text"
            size="small"
            @click="emit('update:modelValue', false)"
          ></v-btn>
        </v-toolbar>

        <v-card-text class="pa-4">
          <div class="bg-white pa-4 rounded-lg border elevation-1">
            <v-alert
              v-if="editForm.nama"
              density="compact"
              color="primary"
              variant="tonal"
              class="mb-4 text-caption border-opacity-25 py-2"
            >
              <strong style="font-size: 12px">{{ editForm.nama }}</strong
              ><br />
              Ukuran: {{ editForm.ukuran }} | Kode: {{ editForm.kode }}
            </v-alert>

            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model.number="editForm.minBuffer"
                  label="Minimal Buffer"
                  type="number"
                  density="compact"
                  variant="outlined"
                  color="primary"
                  class="mb-2"
                  @keyup.enter="maxField?.focus()"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  ref="maxField"
                  v-model.number="editForm.maxBuffer"
                  label="Maximal Buffer"
                  type="number"
                  density="compact"
                  variant="outlined"
                  color="primary"
                  hide-details
                  @keyup.enter="saveBuffer"
                ></v-text-field>
              </v-col>
            </v-row>
          </div>
        </v-card-text>

        <v-card-actions class="pa-4 bg-white border-t">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            color="grey"
            @click="emit('update:modelValue', false)"
            >Batal</v-btn
          >
          <v-btn
            color="primary"
            variant="elevated"
            :loading="isSaving"
            type="submit"
            prepend-icon="mdi-check"
            class="px-6"
          >
            Simpan
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.v-dialog :deep(*) {
  font-size: 11px !important;
}
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
