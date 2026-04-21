<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { VForm } from "vuetify/components";
import api from "@/services/api";
import { useToast } from "vue-toastification";

// 1. Props & Emits
const props = defineProps<{
  modelValue: boolean; // v-model untuk show/hide dialog
  isNewMode: boolean; // True = Tambah, False = Ubah
  customerData?: any; // Data customer yang mau diedit
}>();

const emit = defineEmits(["update:modelValue", "saved"]);

// 2. State & Store
const toast = useToast();
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const formRef = ref<VForm | null>(null);
const isSaving = ref(false);
const confirmDialogVisible = ref(false);
const confirmCancelDialogVisible = ref(false);

// State data form
const formData = ref({
  cus_kode: "",
  cus_nama: "",
  cus_alamat: "",
  cus_kota: "",
  cus_telp: "",
  cus_nama_kontak: "",
  cus_aktif: "Y",
});

// 3. Watcher: Isi data otomatis saat dialog dibuka
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      if (props.isNewMode) {
        // Reset form untuk mode Baru
        formData.value = {
          cus_kode: "",
          cus_nama: "",
          cus_alamat: "",
          cus_kota: "",
          cus_telp: "",
          cus_nama_kontak: "",
          cus_aktif: "Y",
        };
      } else if (props.customerData) {
        // Isi form dengan data dari parent untuk mode Ubah
        formData.value = { ...props.customerData };
      }
      formRef.value?.resetValidation();
    }
  },
);

// 4. Rules Validasi
const requiredRule = (v: string) => !!v || "Field ini wajib diisi";
const numericRule = (v: string) =>
  !v || /^[0-9]+$/.test(v) || "Hanya boleh berisi angka";

// 5. Handlers
const handleClose = () => {
  confirmCancelDialogVisible.value = true;
};

const executeCancel = () => {
  confirmCancelDialogVisible.value = false;
  dialogVisible.value = false; // Tutup dialog utama
};

const handleSave = async () => {
  const { valid } = await formRef.value!.validate();
  if (!valid) {
    toast.warning("Mohon lengkapi semua field wajib.");
    return;
  }
  confirmDialogVisible.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      ...formData.value,
      cus_nama: formData.value.cus_nama?.trim(),
      cus_alamat: formData.value.cus_alamat?.trim(),
    };

    if (props.isNewMode) {
      await api.post("/customers", payload);
      toast.success("Customer baru berhasil ditambahkan!");
    } else {
      await api.put(`/customers/${formData.value.cus_kode}`, payload);
      toast.success("Data customer berhasil diperbarui!");
    }

    confirmDialogVisible.value = false;
    dialogVisible.value = false; // Tutup dialog
    emit("saved"); // Beri tahu parent agar me-refresh tabel
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <v-dialog v-model="dialogVisible" persistent max-width="600px">
    <v-card class="dialog-card">
      <v-form ref="formRef" @submit.prevent="handleSave">
        <v-card-title class="dialog-header bg-grey-lighten-4 border-b">
          <span class="text-subtitle-2 font-weight-bold text-primary">
            {{ isNewMode ? "TAMBAH CUSTOMER BARU" : "UBAH DATA CUSTOMER" }}
          </span>
          <v-spacer></v-spacer>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            @click="handleClose"
          ></v-btn>
        </v-card-title>

        <v-card-text class="pa-4">
          <v-container class="pa-0">
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model="formData.cus_kode"
                  label="Kode Customer"
                  variant="outlined"
                  density="compact"
                  :readonly="!isNewMode"
                  placeholder="Otomatis"
                  hide-details="auto"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="formData.cus_nama"
                  label="Nama Customer *"
                  variant="outlined"
                  density="compact"
                  :rules="[requiredRule]"
                  hide-details="auto"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="formData.cus_alamat"
                  label="Alamat *"
                  variant="outlined"
                  density="compact"
                  rows="2"
                  :rules="[requiredRule]"
                  hide-details="auto"
                ></v-textarea>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="formData.cus_kota"
                  label="Kota *"
                  variant="outlined"
                  density="compact"
                  :rules="[requiredRule]"
                  hide-details="auto"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="formData.cus_telp"
                  label="No Telp/Hp *"
                  variant="outlined"
                  density="compact"
                  :rules="[requiredRule, numericRule]"
                  hide-details="auto"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="formData.cus_nama_kontak"
                  label="Nama Kontak *"
                  variant="outlined"
                  density="compact"
                  :rules="[requiredRule]"
                  hide-details="auto"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <v-radio-group
                  v-model="formData.cus_aktif"
                  inline
                  label="Status"
                  density="compact"
                  hide-details
                  class="mt-1"
                >
                  <v-radio label="Aktif" value="Y" color="success"></v-radio>
                  <v-radio label="Pasif" value="N" color="error"></v-radio>
                </v-radio-group>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>

        <v-card-actions class="dialog-footer bg-grey-lighten-4 border-t pa-3">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="handleClose"
            :disabled="isSaving"
            class="font-weight-bold"
            >Batal</v-btn
          >
          <v-btn
            color="primary"
            type="submit"
            variant="elevated"
            :loading="isSaving"
            class="font-weight-bold px-6"
            >Simpan</v-btn
          >
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmDialogVisible" max-width="400px">
    <v-card class="rounded-lg">
      <v-card-title class="text-subtitle-1 font-weight-bold pa-4"
        ><v-icon color="primary" class="mr-2">mdi-help-circle</v-icon
        >Konfirmasi</v-card-title
      >
      <v-card-text class="pa-4 pt-0"
        >Yakin ingin menyimpan data customer ini?</v-card-text
      >
      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          @click="confirmDialogVisible = false"
          :disabled="isSaving"
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

  <v-dialog v-model="confirmCancelDialogVisible" max-width="400px">
    <v-card class="rounded-lg">
      <v-card-title class="text-subtitle-1 font-weight-bold pa-4"
        ><v-icon color="error" class="mr-2">mdi-alert</v-icon
        >Peringatan</v-card-title
      >
      <v-card-text class="pa-4 pt-0"
        >Perubahan belum disimpan. Yakin ingin membatalkan?</v-card-text
      >
      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="confirmCancelDialogVisible = false"
          >Lanjut Edit</v-btn
        >
        <v-btn color="error" variant="elevated" @click="executeCancel"
          >Ya, Buang</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.dialog-card :deep(*) {
  font-size: 11px !important; /* Standar font 11px */
}
.dialog-card :deep(.v-field__input) {
  padding-top: 6px !important;
  padding-bottom: 6px !important;
  min-height: 32px !important; /* Rampingkan input */
}
</style>
