<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { VForm } from "vuetify/components";
import api from "@/services/api";
import { useToast } from "vue-toastification";

const props = defineProps<{
  modelValue: boolean;
  isNewMode: boolean;
  itemData?: any;
}>();

const emit = defineEmits(["update:modelValue", "update:isNewMode", "saved"]);

const toast = useToast();
const formRef = ref<VForm | null>(null);
const isSaving = ref(false);
const isChecking = ref(false);
const confirmDialogVisible = ref(false);

const formData = ref({
  rek_nomor: "",
  rek_namabank: "",
  rek_atasnama: "",
});

// Sync data saat dialog dibuka
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      if (props.isNewMode) {
        formData.value = { rek_nomor: "", rek_namabank: "", rek_atasnama: "" };
      } else if (props.itemData) {
        formData.value = { ...props.itemData };
      }
      formRef.value?.resetValidation();
    }
  },
);

// Logika Delphi: Cek apakah No Rekening sudah ada saat Blur
const checkExists = async () => {
  if (!props.isNewMode || !formData.value.rek_nomor || isChecking.value) return;

  isChecking.value = true;
  try {
    const res = await api.get(`/rekening/form/${formData.value.rek_nomor}`);
    if (res.data) {
      emit("update:isNewMode", false); // Switch ke mode Edit
      formData.value = res.data;
      toast.info("No Rekening sudah ada. Beralih ke mode Ubah.");
    }
  } finally {
    isChecking.value = false;
  }
};

const handleSave = async () => {
  const { valid } = await formRef.value!.validate();
  if (valid) confirmDialogVisible.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = { data: formData.value, isNew: props.isNewMode };
    await api.post("/rekening/save", payload);
    toast.success("Data rekening berhasil disimpan");
    confirmDialogVisible.value = false;
    emit("update:modelValue", false);
    emit("saved");
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal menyimpan data");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    persistent
    max-width="480px"
  >
    <v-card class="dialog-card rounded-lg bg-grey-lighten-4">
      <v-form ref="formRef" @submit.prevent="handleSave">
        <v-card-title class="bg-primary text-white pa-4 d-flex align-center">
          <v-icon color="white" class="mr-2">mdi-bank-plus</v-icon>
          <span class="text-subtitle-1 font-weight-bold">{{
            isNewMode ? "TAMBAH REKENING" : "UBAH REKENING"
          }}</span>
          <v-spacer></v-spacer>
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            size="small"
            @click="emit('update:modelValue', false)"
          ></v-btn>
        </v-card-title>

        <v-card-text class="pa-4">
          <div class="bg-white pa-4 rounded-lg border elevation-1">
            <v-text-field
              v-model="formData.rek_nomor"
              label="No. Rekening *"
              variant="outlined"
              density="compact"
              :readonly="!isNewMode || isChecking"
              @blur="checkExists"
              :loading="isChecking"
              hide-details="auto"
              class="mb-3"
            />
            <v-text-field
              v-model="formData.rek_namabank"
              label="Nama Bank *"
              variant="outlined"
              density="compact"
              hide-details="auto"
              class="mb-3"
            />
            <v-text-field
              v-model="formData.rek_atasnama"
              label="Atas Nama"
              variant="outlined"
              density="compact"
              hide-details="auto"
            />
          </div>
        </v-card-text>

        <v-card-actions class="pa-4 bg-white border-t">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="emit('update:modelValue', false)"
            >Batal</v-btn
          >
          <v-btn
            color="primary"
            type="submit"
            variant="elevated"
            :loading="isSaving"
            class="px-6"
            >Simpan Rekening</v-btn
          >
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmDialogVisible" max-width="400px">
    <v-card class="rounded-lg">
      <v-card-title
        class="text-subtitle-1 font-weight-bold pa-4 d-flex align-center"
      >
        <v-icon color="primary" class="mr-2">mdi-help-circle</v-icon>Konfirmasi
      </v-card-title>
      <v-card-text class="pa-4 pt-0"
        >Yakin ingin menyimpan data rekening ini?</v-card-text
      >
      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="confirmDialogVisible = false"
          >Batal</v-btn
        >
        <v-btn
          color="primary"
          variant="elevated"
          @click="executeSave"
          :loading="isSaving"
          >Ya, Simpan</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.dialog-card :deep(*) {
  font-size: 11px !important;
}
</style>
