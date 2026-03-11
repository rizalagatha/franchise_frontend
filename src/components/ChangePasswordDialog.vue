<script setup lang="ts">
import { ref, watch } from 'vue';
import api from '@/services/api';
import { useToast } from 'vue-toastification';
import { usePasswordDialog } from '@/composables/usePasswordDialog';

const { isPasswordDialogOpen, closePasswordDialog } = usePasswordDialog();
const toast = useToast();

// State Form
const form = ref({
  lama: '',
  baru: '',
  ulangi: ''
});

const isSubmitting = ref(false);
const showOldPassword = ref(false);
const showNewPassword = ref(false);
const showRepeatPassword = ref(false);

// Reset form setiap kali dialog terbuka
watch(isPasswordDialogOpen, (isOpen) => {
  if (isOpen) {
    form.value = { lama: '', baru: '', ulangi: '' };
    showOldPassword.value = false;
    showNewPassword.value = false;
    showRepeatPassword.value = false;
  }
});

const handleSubmit = async () => {
  // Validasi (Mengikuti logika Delphi)
  if (!form.value.lama) {
    return toast.warning('Silahkan isi Password Lama!');
  }
  if (!form.value.baru) {
    return toast.warning('Silahkan isi Password Baru!');
  }
  if (form.value.baru !== form.value.ulangi) {
    return toast.error('Ulangi password beda.');
  }

  isSubmitting.value = true;
  try {
    await api.post('/users/change-password', {
      oldPassword: form.value.lama,
      newPassword: form.value.baru
    });

    toast.success('Password berhasil diganti.');
    closePasswordDialog();
  } catch (error: any) {
    // Menampilkan pesan error dari backend ("Password lama salah")
    toast.error(error.response?.data?.message || 'Gagal mengganti password.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <v-dialog v-model="isPasswordDialogOpen" max-width="400px" persistent>
    <v-card class="rounded-lg">
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">Ganti Password</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" @click="closePasswordDialog" :disabled="isSubmitting"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-4 pt-6">
        <v-text-field v-model="form.lama" label="Password Lama" :type="showOldPassword ? 'text' : 'password'"
          density="comfortable" variant="outlined" class="mb-2"
          :append-inner-icon="showOldPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showOldPassword = !showOldPassword" @keyup.enter="handleSubmit" autofocus />

        <v-text-field v-model="form.baru" label="Password Baru" :type="showNewPassword ? 'text' : 'password'"
          density="comfortable" variant="outlined" class="mb-2"
          :append-inner-icon="showNewPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showNewPassword = !showNewPassword" @keyup.enter="handleSubmit" />

        <v-text-field v-model="form.ulangi" label="Ulangi Password" :type="showRepeatPassword ? 'text' : 'password'"
          density="comfortable" variant="outlined" hide-details
          :append-inner-icon="showRepeatPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showRepeatPassword = !showRepeatPassword" @keyup.enter="handleSubmit" />
      </v-card-text>

      <v-card-actions class="pa-4 pt-0">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="closePasswordDialog" :disabled="isSubmitting">Batal</v-btn>
        <v-btn color="primary" variant="elevated" @click="handleSubmit" :loading="isSubmitting"
          prepend-icon="mdi-check">Simpan</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
