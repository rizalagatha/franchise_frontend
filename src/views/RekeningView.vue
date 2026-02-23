<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import type { VDataTableHeaders, VForm } from 'vuetify/components';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import type { AxiosError } from 'axios';
import * as XLSX from 'xlsx';

// Store & composables
const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();
const MENU_ID = '14';

// Interface Data Header (Master)
interface RekeningHeader {
  NoRekening: string;
  NamaBank: string;
  AtasNama: string;
}

// Interface Form Data (nama field disamakan dengan Delphi/DB)
interface RekeningFormData {
  rek_nomor: string;
  rek_namabank: string;
  rek_atasnama: string | null;
}

// --- State Browse ---
const headersData = ref<RekeningHeader[]>([]);
const selected = ref<RekeningHeader[]>([]);
const isLoading = ref(true); // Loading utama tabel
const search = ref('');

// --- State Dialog Form ---
const dialogVisible = ref(false);
const isNewMode = ref(true); // FlagEdit
const editedItem = ref<Partial<RekeningFormData>>({});
const isSaving = ref(false); // Loading simpan
const formRef = ref<VForm | null>(null);
const isCheckingKode = ref(false); // Loading saat cek nomor

// --- State Dialog Konfirmasi ---
const confirmDeleteDialogVisible = ref(false);
const itemToDelete = ref<RekeningHeader | null>(null);
const isDeleting = ref(false);
const confirmDialogVisible = ref(false); // Simpan
const pendingSaveAction = ref<(() => Promise<void>) | null>(null);
const pendingAction = ref<null | (() => void)>(null);
const confirmCancelDialogVisible = ref(false); // Batal
const confirmText = ref('');

// Hak akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete'));
const isSingleSelected = computed(() => selected.value.length === 1);

// Header Tabel Master (Simple)
const masterHeaders: VDataTableHeaders = [
  { title: 'No Rekening', key: 'NoRekening', width: '200px' },
  { title: 'Nama Bank', key: 'NamaBank', width: '250px' },
  { title: 'Atas Nama', key: 'AtasNama' },
  { title: 'Actions', key: 'actions', sortable: false, width: '100px', align: 'center' },
];

// --- Rules Validasi Dialog ---
const requiredRule = (v: string | null | undefined): boolean | string => !!(v && v.trim()) || 'Field ini wajib diisi';

// Format Angka
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

// --- Methods Browse ---
const fetchHeadersData = async () => {
  isLoading.value = true;
  selected.value = [];
  try {
    const response = await api.get('/rekening');
    headersData.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data rekening.');
  } finally {
    isLoading.value = false;
  }
};

// --- Methods Dialog ---
const openNewDialog = () => {
  if (!canInsert.value) return toast.error("Anda tidak punya hak akses.");
  isNewMode.value = true;
  editedItem.value = { // Sesuai Delphi refreshdata
    rek_nomor: '',
    rek_namabank: '',
    rek_atasnama: '',
  };
  formRef.value?.resetValidation();
  dialogVisible.value = true;
};

const openEditDialog = async (item: RekeningHeader) => {
  const itemToEdit = item || selected.value[0];
  if (!itemToEdit) return;
  if (!canEdit.value) return toast.error("Anda tidak punya hak akses.");

  isNewMode.value = false; // Mode Ubah
  formRef.value?.resetValidation();

  try {
    // Panggil API untuk load data (loaddata Delphi)
    const response = await api.get(`/rekening/form/${itemToEdit.NoRekening}`);
    if (response.data) {
      editedItem.value = response.data;
      dialogVisible.value = true;
    } else {
      toast.error('Data rekening tidak ditemukan.');
      fetchHeadersData(); // Refresh grid jika data hilang
    }
  } catch (error) {
    toast.error('Gagal memuat data rekening.');
  }
};

// Cek nomor rekening saat input 'No. Rekening' di-blur (edtKodeExit)
const checkRekeningExists = async () => {
  const kode = editedItem.value.rek_nomor;
  // Hanya cek jika mode Baru dan kode tidak kosong
  if (!isNewMode.value || !kode || isCheckingKode.value) return;

  isCheckingKode.value = true;
  try {
    const response = await api.get(`/rekening/form/${kode}`);
    if (response.data) {
      // Ditemukan! (Delphi: not Eof)
      isNewMode.value = false; // Ganti ke mode Ubah
      editedItem.value = response.data;
      toast.info('No Rekening sudah ada. Beralih ke mode Ubah.');
    } else {
      // Tidak ditemukan (Delphi: Eof)
      // Biarkan isNewMode = true
      toast.success('No Rekening tersedia (Mode Baru).');
    }
  } catch (error) {
    toast.error('Gagal memeriksa No Rekening.');
  } finally {
    isCheckingKode.value = false;
  }
};

// Simpan data (Baru/Ubah)
const saveRekening = async () => {
  const validationResult = await formRef.value?.validate();
  if (!validationResult?.valid) {
    toast.warning("Mohon periksa kembali isian form.");
    return;
  }

  // Tampilkan dialog konfirmasi
  showConfirmation(executeSave, "Yakin ingin simpan data rekening ini?");
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      data: editedItem.value,
      isNew: isNewMode.value // Kirim flag isNew ke backend
    };

    // Panggil satu endpoint save
    const response = await api.post('/rekening/save', payload);

    toast.success(response.data.message);

    closeDialog(true); // Tutup paksa
    fetchHeadersData(); // Refresh grid

  } catch (error: unknown) {
    const err = error as AxiosError<{ message?: string }>;
    toast.error(err.response?.data?.message || 'Gagal menyimpan data.');
  } finally {
    isSaving.value = false;
    confirmDialogVisible.value = false; // Tutup konfirmasi
    pendingSaveAction.value = null;
  }
};

// Logika dialog konfirmasi (Simpan & Batal)
const showConfirmation = (action: () => void, text: string) => {
  // pendingAction.value = action; // <-- SALAH
  pendingSaveAction.value = action; // <-- PERBAIKI INI

  confirmText.value = text;

  // isConfirmDialogVisible.value = true; // <-- SALAH
  confirmDialogVisible.value = true; // <-- PERBAIKI INI
};
const executePendingAction = () => {
  // if (pendingAction.value) pendingAction.value(); // <-- SALAH
  if (pendingSaveAction.value) pendingSaveAction.value(); // <-- PERBAIKI INI

  closeConfirmDialog();
};

const closeConfirmDialog = () => {
  confirmDialogVisible.value = false;
  // pendingAction.value = null; // <-- SALAH
  pendingSaveAction.value = null; // <-- PERBAIKI INI
};
const closeDialog = (force: boolean = false) => {
  if (force) {
    dialogVisible.value = false;
    confirmCancelDialogVisible.value = false; // Tutup juga dialog batal jika terbuka
    return;
  }
  // Delphi: btnBatalClick
  confirmCancelDialogVisible.value = true;
};
const executeCancel = () => {
  dialogVisible.value = false;
  confirmCancelDialogVisible.value = false;
};
const cancelCancelConfirmation = () => {
  confirmCancelDialogVisible.value = false;
};

// --- Methods Hapus ---
const confirmDelete = (item: RekeningHeader) => {
  const itemToDeleteVal = item || selected.value[0];
  if (!itemToDeleteVal) return;
  if (!canDelete.value) return toast.error("Anda tidak punya hak akses.");

  itemToDelete.value = itemToDeleteVal;
  confirmDeleteDialogVisible.value = true;
};

const executeDelete = async () => {
  if (!itemToDelete.value) return;
  isDeleting.value = true;
  try {
    const nomor = itemToDelete.value.NoRekening;
    await api.delete(`/rekening/${nomor}`);
    toast.success(`Rekening ${nomor} berhasil dihapus.`);
    fetchHeadersData(); // Muat ulang data master
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } } };
    toast.error(err.response?.data?.message || 'Gagal menghapus data.');
  } finally {
    isDeleting.value = false;
    confirmDeleteDialogVisible.value = false;
    itemToDelete.value = null;
  }
};

// Export (Header)
const exportHeaderData = () => {
  if (headersData.value.length === 0) return toast.warning('Tidak ada data header untuk diekspor.');
  const dataToExport = headersData.value.map(h => ({
    'No Rekening': h.NoRekening,
    'Nama Bank': h.NamaBank,
    'Atas Nama': h.AtasNama,
  }));
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekening");
  XLSX.writeFile(workbook, "Daftar_Rekening_Bank.xlsx");
};

// Ambil data awal
onMounted(() => {
  if (hasViewPermission.value) {
    fetchHeadersData();
  } else {
    isLoading.value = false;
    toast.error("Anda tidak memiliki izin untuk melihat halaman ini.");
  }
});
</script>

<template>
  <PageLayout title="Browse Rekening Bank" :menu-id="MENU_ID" icon="mdi-bank">

    <template #header-actions>
      <v-btn v-if="canInsert" size="small" color="primary" @click="openNewDialog" prepend-icon="mdi-plus">Baru</v-btn>
      <v-btn v-if="canEdit" size="small" :disabled="!isSingleSelected" @click="openEditDialog(selected[0])"
        prepend-icon="mdi-pencil">Ubah</v-btn>
      <v-btn v-if="canDelete" size="small" color="error" :disabled="!isSingleSelected"
        @click="confirmDelete(selected[0])" prepend-icon="mdi-delete">Hapus</v-btn>
      <v-btn v-if="hasViewPermission" size="small" color="green" @click="exportHeaderData"
        prepend-icon="mdi-file-excel">Export</v-btn>
    </template>

    <div v-if="hasViewPermission" class="browse-content">
      <div class="filter-section">
        <v-text-field v-model="search" density="compact" label="Cari Rekening (No, Nama Bank, Atas Nama...)"
          prepend-inner-icon="mdi-magnify" variant="outlined" hide-details single-line></v-text-field>
        <v-spacer></v-spacer>
        <v-btn @click="fetchHeadersData" icon="mdi-refresh" variant="text" size="small" :disabled="isLoading"
          aria-label="Refresh Data"></v-btn>
      </div>

      <div class="table-container">
        <v-data-table v-model="selected" :headers="masterHeaders" :items="headersData" :search="search"
          :loading="isLoading" item-value="NoRekening" density="compact" class="desktop-table fill-height-table"
          fixed-header show-select return-object :items-per-page="50">
          <template #[`item.actions`]="{ item }">
            <v-tooltip text="Ubah Rekening" location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" v-if="canEdit" size="small" class="me-2" @click.stop="openEditDialog(item)"
                  color="primary">
                  mdi-pencil
                </v-icon>
              </template>
            </v-tooltip>
            <v-tooltip text="Hapus Rekening" location="top">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" v-if="canDelete" size="small" @click.stop="confirmDelete(item)" color="error">
                  mdi-delete
                </v-icon>
              </template>
            </v-tooltip>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
          </template>
          <template v-slot:no-data>
            <div class="text-center pa-4">Tidak ada data rekening bank.</div>
          </template>
        </v-data-table>
      </div>
    </div>

    <div v-else class="state-container">
      <v-icon size="64" class="mb-4">mdi-lock-outline</v-icon>
      <h3 class="text-h6">Akses Ditolak</h3>
      <p>Anda tidak memiliki izin untuk melihat Rekening Bank.</p>
    </div>

    <v-dialog v-model="dialogVisible" persistent max-width="500px">
      <v-card class="dialog-card">
        <v-form ref="formRef" @submit.prevent="saveRekening">
          <v-card-title class="dialog-header">
            <span class="text-subtitle-1 font-weight-medium">
              {{ isNewMode ? 'Tambah Rekening Baru' : `Ubah Rekening: ${editedItem.rek_nomor}` }}
            </span>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-close" variant="text" size="small" @click="closeDialog()"></v-btn>
          </v-card-title>

          <v-card-text class="pa-4">
            <v-container>
              <v-row dense>
                <v-col cols="12">
                  <v-text-field v-model="editedItem.rek_nomor" label="No. Rekening *"
                    placeholder="Ketik No Rekening (lalu blur)" variant="outlined" density="compact"
                    :rules="[requiredRule]" :readonly="!isNewMode || isCheckingKode" :loading="isCheckingKode"
                    @blur="checkRekeningExists" hide-details="auto"></v-text-field>
                </v-col>

                <v-col cols="12">
                  <v-text-field v-model="editedItem.rek_namabank" label="Nama Bank *" variant="outlined"
                    density="compact" :rules="[requiredRule]" hide-details="auto"></v-text-field>
                </v-col>

                <v-col cols="12">
                  <v-text-field v-model="editedItem.rek_atasnama" label="Atas Nama" variant="outlined" density="compact"
                    hide-details="auto"></v-text-field>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>

          <v-card-actions class="dialog-footer">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="closeDialog()" :disabled="isSaving">Batal</v-btn>
            <v-btn color="primary" type="submit" variant="elevated" :loading="isSaving"
              :disabled="isSaving || isCheckingKode">
              Simpan
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 font-weight-bold d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
          Konfirmasi
        </v-card-title>
        <v-card-text>{{ confirmText }}</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeConfirmDialog" :disabled="isSaving">
            Tidak
          </v-btn>
          <v-btn color="primary" variant="tonal" @click="executePendingAction" :loading="isSaving">
            Ya, Lanjutkan
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmCancelDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
          Konfirmasi Batal
        </v-card-title>
        <v-card-text>
          Yakin ingin membatalkan? Data yang belum disimpan akan hilang.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="cancelCancelConfirmation">
            Lanjut Edit
          </v-btn>
          <v-btn color="error" variant="elevated" @click="executeCancel">
            Ya, Batalkan
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmDeleteDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-delete-alert-outline</v-icon>
          Konfirmasi Hapus
        </v-card-title>
        <v-card-text>
          Yakin ingin menghapus rekening <strong>{{ itemToDelete?.NoRekening }} - {{ itemToDelete?.NamaBank }}</strong>?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="confirmDeleteDialogVisible = false" :disabled="isDeleting">Batal</v-btn>
          <v-btn color="error" variant="elevated" @click="executeDelete" :loading="isDeleting"
            :disabled="isDeleting">Ya,
            Hapus</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
/* Style standar browse (sama seperti Customer/Barcode) */
.browse-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.filter-section {
  flex-shrink: 0;
}

.table-container {
  flex-grow: 1;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.v-data-table {
  height: 100%;
}

.v-data-table :deep(.v-table__wrapper) {
  height: 100%;
  overflow-y: auto;
}

.state-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Style standar dialog (sama seperti Customer) */
.dialog-card {
  font-size: 12px;
}

.dialog-header {
  border-bottom: 1px solid #e0e0e0;
  padding: 8px 16px;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
}

.dialog-footer {
  border-top: 1px solid #e0e0e0;
  padding: 8px 16px;
  background-color: #f5f5f5;
}

.dialog-card :deep(.v-label) {
  font-size: 11px !important;
}

.dialog-card :deep(input) {
  font-size: 12px !important;
}

.dialog-card :deep(.v-input) {
  margin-bottom: 4px;
}

.v-container {
  padding-top: 8px;
  padding-bottom: 8px;
}

.v-card-text {
  padding-bottom: 0px !important;
}
</style>
