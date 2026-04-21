<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { VForm } from "vuetify/components";
import api from "@/services/api";
import { useToast } from "vue-toastification";

const props = defineProps<{
  modelValue: boolean;
  productData: any; // Data awal barang
}>();

const emit = defineEmits(["update:modelValue", "saved"]);

const toast = useToast();
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const formRef = ref<VForm | null>(null);
const isSaving = ref(false);
const confirmDialogVisible = ref(false);
const confirmCancelDialogVisible = ref(false);

const formData = ref({ Kode: "", Nama: "", Ukuran: "", Hpp: 0, Harga: 0 });

// Isi data form ketika dialog dibuka
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && props.productData) {
      formData.value = {
        Kode: props.productData.Kode,
        Nama: props.productData.Nama,
        Ukuran: props.productData.Ukuran,
        Hpp: Math.round(Number(props.productData.Hpp) || 0),
        Harga: Math.round(Number(props.productData.Harga) || 0),
      };
      formRef.value?.resetValidation();
    }
  },
);

const numberRule = (v: any) =>
  (v !== null && v !== "" && !isNaN(Number(v))) || "Harus angka";
const nonNegativeRule = (v: any) =>
  (v !== null && v >= 0) || "Tidak boleh negatif";

// Fungsi saat tombol "Batal" diklik (Membuka peringatan)
const handleClose = () => {
  confirmCancelDialogVisible.value = true;
};

// Fungsi saat user klik "Ya, Batalkan" di dialog peringatan
const executeCancel = () => {
  confirmCancelDialogVisible.value = false; // Tutup peringatan
  emit("update:modelValue", false); // TUTUP DIALOG UTAMA
};

const handleSave = async () => {
  const { valid } = await formRef.value!.validate();
  if (!valid) return toast.warning("Mohon periksa HPP dan Harga Jual.");
  confirmDialogVisible.value = true; // Munculkan dialog konfirmasi simpan
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    await api.put(
      `/price-list/${formData.value.Kode}/${formData.value.Ukuran}`,
      {
        hpp: formData.value.Hpp,
        harga: formData.value.Harga,
      },
    );

    toast.success("Harga berhasil diperbarui!");
    confirmDialogVisible.value = false;
    emit("update:modelValue", false); // Menutup dialog utama dengan benar
    emit("saved"); // Beritahu parent untuk refresh data
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menyimpan harga.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <v-dialog v-model="dialogVisible" persistent max-width="450px">
    <v-card class="dialog-card rounded-lg">
      <v-form ref="formRef" @submit.prevent="handleSave">
        <v-card-title class="bg-primary text-white pa-4 d-flex align-center">
          <v-icon color="white" class="mr-2">mdi-tag-edit</v-icon>
          <span class="text-subtitle-1 font-weight-bold"
            >Update Harga Jual</span
          >
          <v-spacer></v-spacer>
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            size="small"
            @click="handleClose"
          ></v-btn>
        </v-card-title>

        <v-card-text class="pa-4 bg-grey-lighten-4">
          <div class="bg-white pa-4 rounded-lg border mb-4">
            <div class="text-caption text-grey-darken-1 font-weight-bold mb-2">
              IDENTITAS BARANG
            </div>
            <v-text-field
              v-model="formData.Kode"
              label="Kode"
              variant="filled"
              density="compact"
              readonly
              hide-details
              class="mb-2"
            />
            <v-text-field
              v-model="formData.Nama"
              label="Nama Barang"
              variant="filled"
              density="compact"
              readonly
              hide-details
              class="mb-2"
            />
            <v-text-field
              v-model="formData.Ukuran"
              label="Ukuran"
              variant="filled"
              density="compact"
              readonly
              hide-details
            />
          </div>

          <div class="bg-white pa-4 rounded-lg border border-primary-light">
            <div class="text-caption text-primary font-weight-bold mb-3">
              INPUT HARGA BARU
            </div>
            <v-text-field
              v-model.number="formData.Hpp"
              label="HPP Baru *"
              type="number"
              prefix="Rp"
              variant="outlined"
              density="compact"
              color="primary"
              :rules="[numberRule, nonNegativeRule]"
              hide-details="auto"
              class="mb-3 text-right-input"
            />
            <v-text-field
              v-model.number="formData.Harga"
              label="Harga Jual Baru *"
              type="number"
              prefix="Rp"
              variant="outlined"
              density="compact"
              color="primary"
              :rules="[numberRule, nonNegativeRule]"
              hide-details="auto"
              class="text-right-input"
            />
          </div>
        </v-card-text>

        <v-card-actions class="pa-4 border-t bg-white">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            color="grey-darken-1"
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
            class="px-6 font-weight-bold"
            >Update Harga</v-btn
          >
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmDialogVisible" max-width="400px" persistent>
    <v-card class="rounded-lg">
      <v-card-title
        class="text-subtitle-1 font-weight-bold pa-4 d-flex align-center"
      >
        <v-icon color="primary" class="mr-2">mdi-help-circle</v-icon>Konfirmasi
        Update
      </v-card-title>
      <v-card-text class="pa-4 pt-0">
        Yakin ingin mengupdate harga jual untuk barang ini? Riwayat harga lama
        akan otomatis tersimpan.
      </v-card-text>
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
          >Ya, Update</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmCancelDialogVisible" max-width="400px" persistent>
    <v-card class="rounded-lg">
      <v-card-title
        class="text-subtitle-1 font-weight-bold pa-4 d-flex align-center"
      >
        <v-icon color="error" class="mr-2">mdi-alert</v-icon>Peringatan
      </v-card-title>
      <v-card-text class="pa-4 pt-0">
        Input belum disimpan. Yakin ingin membatalkan perubahan harga ini?
      </v-card-text>
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
  font-size: 11px !important;
}
.text-right-input :deep(input) {
  text-align: right;
  font-weight: bold;
  color: #1976d2;
}
.border-primary-light {
  border: 2px solid #e3f2fd !important;
}
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
