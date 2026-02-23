<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { VDataTableHeaders } from 'vuetify/components'; // Import type
import type { VForm } from 'vuetify/components';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue'; // Gunakan PageLayout
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import * as XLSX from 'xlsx'; // Untuk export

// Store & composables
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '11'; // Menu ID untuk Master Customer

// Interface data (sesuaikan dengan backend)
interface Customer {
  Kode: string;
  Nama: string;
  Alamat: string;
  Kota: string;
  Telp: string;
  Nama_Kontak: string;
  Aktif: 'Y' | 'N'; // Sesuaikan dengan tipe data di DB
  Created: string;
  Modified: string;
}
// Interface data browse (sesuaikan dengan backend)
interface CustomerBrowse {
  Kode: string;
  Nama: string;
  Alamat: string;
  Kota: string;
  Telp: string;
  Nama_Kontak: string;
  Aktif: 'Y' | 'N';
  Created: string;
  Modified: string;
}
interface CustomerFormData {
  cus_kode?: string; // Kode hanya ada saat edit
  cus_nama: string;
  cus_alamat: string;
  cus_kota: string;
  cus_telp: string;
  cus_nama_kontak: string;
  cus_aktif: 'Y' | 'N';
  // NPWP tidak ada di Delphi Franchise
}

// --- State ---
const customers = ref<Customer[]>([]);
const search = ref('');
const isLoading = ref(true);
const selected = ref<Customer[]>([]); // Untuk menampung item yang dipilih

// --- State untuk Dialog ---
const dialogVisible = ref(false);
const isNewMode = ref(true); // True = Baru, False = Ubah
const editedCustomer = ref<Partial<CustomerFormData>>({}); // Data di dalam dialog
const isSaving = ref(false); // Loading saat menyimpan
const formRef = ref<VForm | null>(null); // Referensi ke v-form untuk validasi

// --- State BARU untuk Dialog Konfirmasi ---
const confirmDialogVisible = ref(false); // Kontrol visibility dialog konfirmasi
const pendingSaveAction = ref<(() => Promise<void>) | null>(null); // Menyimpan fungsi save yang akan dijalankan
const confirmCancelDialogVisible = ref(false);

// Hak akses (menggunakan computed agar reaktif)
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));

// Konfigurasi header tabel (sesuai Delphi)
const headers: VDataTableHeaders = [
  { title: 'Kode', key: 'Kode', width: '120px' },
  { title: 'Nama', key: 'Nama', width: '250px' }, // Width disesuaikan
  { title: 'Alamat', key: 'Alamat', width: '200px' },
  { title: 'Kota', key: 'Kota', width: '120px' },
  { title: 'Telp', key: 'Telp', width: '120px' },
  { title: 'Nama Kontak', key: 'Nama_Kontak', width: '150px' },
  { title: 'Aktif', key: 'Aktif', align: 'center', width: '80px' },
  { title: 'Created', key: 'Created', width: '100px' },
  { title: 'Modified', key: 'Modified', width: '100px' },
  // Kolom Actions hanya muncul jika punya hak edit (untuk tombol edit inline)
  ...(canEdit.value ? [{ title: 'Actions', key: 'actions', sortable: false, width: '60px', align: 'center' as const }] : [])
];

// --- Rules Validasi ---
const requiredRule = (v: string) => !!v || 'Field ini wajib diisi';
const numericRule = (v: string | null | undefined): boolean | string => {
  if (!v) return true; // Kosong = valid (biarkan requiredRule menangani)
  return /^[0-9]+$/.test(v) || 'Hanya boleh berisi angka';
};

// --- Methods ---

// Ambil data dari backend
const fetchCustomers = async () => {
  isLoading.value = true;
  selected.value = []; // Reset pilihan
  try {
    const response = await api.get('/customers');
    customers.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data customer.');
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

// Buka Dialog Mode BARU
const openNewDialog = () => {
  if (!canInsert.value) {
    toast.error("Anda tidak punya hak akses untuk menambah data.");
    return;
  }
  isNewMode.value = true;
  // Reset form (sesuai Delphi refreshdata)
  editedCustomer.value = {
    cus_nama: '',
    cus_alamat: '',
    cus_kota: '',
    cus_telp: '',
    cus_nama_kontak: '',
    cus_aktif: 'Y', // Default Aktif
  };
  dialogVisible.value = true;
  formRef.value?.resetValidation(); // Reset validasi jika ada
};

// Buka Dialog Mode UBAH
const openEditDialog = async (item?: CustomerBrowse) => {
  if (!canEdit.value) {
    toast.error("Anda tidak punya hak akses untuk mengubah data.");
    return;
  }
  const customerToEdit = item || selected.value[0];
  if (!customerToEdit) return;

  isNewMode.value = false;
  isLoading.value = true; // Tampilkan loading sementara
  dialogVisible.value = true;
  formRef.value?.resetValidation();

  try {
    // Panggil API GET /api/customers/:kode
    const response = await api.get(`/customers/${customerToEdit.Kode}`);
    editedCustomer.value = response.data; // Isi form dengan data dari backend
  } catch (error) {
    toast.error('Gagal memuat detail customer.');
    console.error(error);
    dialogVisible.value = false; // Tutup dialog jika gagal load
  } finally {
    isLoading.value = false;
  }
};

// Tutup Dialog (Tombol Batal)
const closeDialog = () => {
  // Hanya buka konfirmasi jika ada perubahan yang belum disimpan (opsional, tapi bagus)
  // Anda bisa menambahkan logika perbandingan data awal vs editedCustomer di sini jika mau

  confirmCancelDialogVisible.value = true; // Buka dialog konfirmasi batal
  // Jangan langsung: dialogVisible.value = false;
  // Jangan langsung: editedCustomer.value = {};
};

// Fungsi yang dipanggil saat tombol "Ya, Batalkan" diklik
const executeCancel = () => {
  confirmCancelDialogVisible.value = false; // Tutup dialog konfirmasi
  dialogVisible.value = false;          // TUTUP dialog edit/tambah UTAMA
  editedCustomer.value = {};             // Kosongkan data
};

// Fungsi yang dipanggil saat tombol "Lanjut Edit" diklik
const cancelCancelConfirmation = () => {
  confirmCancelDialogVisible.value = false; // Hanya tutup dialog konfirmasi
};

// Simpan Data (Tombol Simpan)
const saveCustomer = async () => {
  // 1. Validasi Form Vuetify (tetap sama)
  const validationResult = await formRef.value?.validate();
  if (!validationResult?.valid) {
    toast.warning("Mohon periksa kembali isian form.");
    return;
  }

  // --- MODIFIKASI: Buka Dialog Konfirmasi ---
  // Simpan logika API call ke dalam pendingSaveAction
  pendingSaveAction.value = async () => {
    isSaving.value = true;
    try {
      let response;
      const payload = {
        ...editedCustomer.value,
        isNew: isNewMode.value,
        cus_nama: editedCustomer.value.cus_nama?.trim(),
        cus_alamat: editedCustomer.value.cus_alamat?.trim(),
        cus_kota: editedCustomer.value.cus_kota?.trim(),
        cus_telp: editedCustomer.value.cus_telp?.trim(),
        cus_nama_kontak: editedCustomer.value.cus_nama_kontak?.trim(),
      };

      if (isNewMode.value) {
        response = await api.post('/customers', payload);
        const newCode = response.data.kode || '';
        toast.success(response.data.message || `Berhasil disimpan dengan kode ${newCode}`);
      } else {
        response = await api.put(`/customers/${editedCustomer.value.cus_kode}`, payload);
        toast.success(response.data.message || 'Customer berhasil diperbarui!');
      }

      closeDialog();      // Tutup dialog edit/tambah
      fetchCustomers();   // Refresh tabel
      confirmDialogVisible.value = false; // Tutup dialog konfirmasi (setelah sukses)

    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Gagal menyimpan data customer.');
      console.error(error);
      confirmDialogVisible.value = false; // Tutup dialog konfirmasi jika error
    } finally {
      isSaving.value = false;
      pendingSaveAction.value = null; // Bersihkan action
    }
  };

  // Tampilkan dialog konfirmasi
  confirmDialogVisible.value = true;
  // --- AKHIR MODIFIKASI ---
};

// Fungsi export (mirip retail, disesuaikan kolomnya)
const exportData = () => {
  if (customers.value.length === 0) {
    toast.info("Tidak ada data untuk diexport.");
    return;
  }
  // Hanya export kolom yang relevan
  const dataToExport = customers.value.map(c => ({
    Kode: c.Kode,
    Nama: c.Nama,
    Alamat: c.Alamat,
    Kota: c.Kota,
    Telepon: c.Telp,
    'Nama Kontak': c.Nama_Kontak,
    Aktif: c.Aktif,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
  XLSX.writeFile(workbook, "MasterCustomer.xlsx");
};

// Computed property untuk cek apakah tombol Ubah di header aktif
const canEditFromHeader = computed(() => selected.value.length === 1 && canEdit.value);

// Fungsi untuk styling baris (membuat teks merah jika Aktif = 'N')
// Sesuai Delphi: cxGrdMasterCustomDrawCell
const getRowProps = ({ item }: { item: Customer }) => {
  if (item.Aktif === 'N') {
    return { class: 'inactive-row' };
  }
  return {};
};

// Fungsi yang dipanggil saat tombol "Ya, Simpan" diklik
const executePendingSave = async () => {
  if (pendingSaveAction.value) {
    await pendingSaveAction.value(); // Jalankan fungsi save yang disimpan
  }
};

// Fungsi yang dipanggil saat tombol "Batal" di dialog konfirmasi diklik
const cancelSaveConfirmation = () => {
  confirmDialogVisible.value = false;
  pendingSaveAction.value = null; // Hapus action yang tertunda
};

// Lifecycle hook: Ambil data saat komponen dimuat
onMounted(() => {
  if (hasViewPermission.value) {
    fetchCustomers();
  } else {
    isLoading.value = false; // Set loading false agar pesan akses ditolak muncul
    toast.error("Anda tidak memiliki izin untuk melihat halaman ini.");
  }
});
</script>

<template>
  <PageLayout title="Master Customer" :menu-id="MENU_ID" icon="mdi-account-multiple">

    <!-- Tombol Header -->
    <template #header-actions>
      <!-- Tombol Baru: Hanya muncul jika punya hak insert -->
      <v-btn v-if="canInsert" size="small" color="primary" @click="openNewDialog" prepend-icon="mdi-plus">
        Baru
      </v-btn>
      <v-btn v-if="canEdit" size="small" :disabled="!canEditFromHeader" @click="openEditDialog()"
        prepend-icon="mdi-pencil">
        Ubah
      </v-btn>
      <v-btn v-if="hasViewPermission" size="small" @click="exportData" prepend-icon="mdi-file-excel">
        Export
      </v-btn>
    </template>

    <!-- Konten Utama: Tampilkan jika punya hak view -->
    <div v-if="hasViewPermission" class="browse-content">
      <!-- Filter Section -->
      <div class="filter-section">
        <v-text-field v-model="search" density="compact" label="Cari Customer (Kode, Nama, Alamat...)"
          prepend-inner-icon="mdi-magnify" variant="outlined" hide-details single-line></v-text-field>
        <v-spacer></v-spacer>
        <v-btn @click="fetchCustomers" icon="mdi-refresh" variant="text" size="small" :disabled="isLoading"
          aria-label="Refresh Data"></v-btn>
      </div>

      <!-- Table Section -->
      <v-data-table v-model="selected" :headers="headers" :items="customers" :search="search" :loading="isLoading"
        item-value="Kode" density="compact" class="desktop-table fill-height-table" fixed-header show-select
        return-object :row-props="getRowProps">
        <!-- Customisasi kolom 'Aktif' -->
        <template #[`item.Aktif`]="{ item }">
          <v-chip :color="item.Aktif === 'Y' ? 'success' : 'error'" size="x-small" variant="tonal"
            class="font-weight-bold">
            {{ item.Aktif === 'Y' ? 'Aktif' : 'Pasif' }}
          </v-chip>
        </template>

        <!-- Customisasi kolom 'actions' (ikon pensil) -->
        <template #[`item.actions`]="{ item }">
          <v-icon v-if="canEdit" size="small" class="me-2" @click="openEditDialog(item)" color="primary"
            aria-label="Ubah Customer">
            mdi-pencil
          </v-icon>
        </template>

        <!-- Pesan jika loading -->
        <template v-slot:loading>
          <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
        </template>

        <!-- Pesan jika tidak ada data -->
        <template v-slot:no-data>
          <div class="text-center pa-4">
            Tidak ada data customer yang tersedia.
          </div>
        </template>
      </v-data-table>
    </div>

    <!-- Tampilan jika tidak punya hak view -->
    <div v-else class="state-container">
      <v-icon size="64" class="mb-4">mdi-lock-outline</v-icon>
      <h3 class="text-h6">Akses Ditolak</h3>
      <p>Anda tidak memiliki izin untuk melihat Master Customer.</p>
    </div>

    <v-dialog v-model="dialogVisible" persistent max-width="600px">
      <v-card class="dialog-card">
        <v-form ref="formRef" @submit.prevent="saveCustomer">
          <v-card-title class="dialog-header">
            <span class="text-subtitle-1 font-weight-medium">
              {{ isNewMode ? 'Tambah Customer Baru' : 'Ubah Data Customer' }}
            </span>
            <v-spacer></v-spacer>
            <v-btn icon="mdi-close" variant="text" size="small" @click="closeDialog"></v-btn>
          </v-card-title>

          <v-card-text class="pa-4">
            <v-container>
              <v-row dense>
                <!-- Kode (Readonly saat Ubah) -->
                <v-col cols="12">
                  <v-text-field v-model="editedCustomer.cus_kode" label="Kode" variant="outlined" density="compact"
                    :readonly="!isNewMode" placeholder="(Otomatis saat baru)" hide-details="auto"></v-text-field>
                </v-col>

                <!-- Nama (Wajib) -->
                <v-col cols="12">
                  <v-text-field v-model="editedCustomer.cus_nama" label="Nama Customer *" variant="outlined"
                    density="compact" :rules="[requiredRule]" hide-details="auto"></v-text-field>
                </v-col>

                <!-- Alamat (Wajib) -->
                <v-col cols="12">
                  <v-textarea v-model="editedCustomer.cus_alamat" label="Alamat *" variant="outlined" density="compact"
                    rows="2" :rules="[requiredRule]" hide-details="auto"></v-textarea>
                </v-col>

                <!-- Kota (Wajib) -->
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedCustomer.cus_kota" label="Kota *" variant="outlined" density="compact"
                    :rules="[requiredRule]" hide-details="auto"></v-text-field>
                </v-col>

                <!-- Telp (Wajib) -->
                <v-col cols="12" sm="6">
                  <v-text-field v-model="editedCustomer.cus_telp" label="No Telp/Hp *" variant="outlined"
                    density="compact" :rules="[requiredRule, numericRule]" hide-details="auto"
                    inputmode="numeric"></v-text-field>
                </v-col>

                <!-- Nama Kontak (Wajib) -->
                <v-col cols="12">
                  <v-text-field v-model="editedCustomer.cus_nama_kontak" label="Nama Kontak Person *" variant="outlined"
                    density="compact" :rules="[requiredRule]" hide-details="auto"></v-text-field>
                </v-col>

                <!-- Status (Aktif/Pasif) -->
                <v-col cols="12">
                  <v-radio-group v-model="editedCustomer.cus_aktif" inline label="Status" density="compact" hide-details
                    class="mt-n1 mb-n1">
                    <v-radio label="Aktif" value="Y" color="success"></v-radio>
                    <v-radio label="Pasif" value="N" color="error"></v-radio>
                  </v-radio-group>
                </v-col>

                <!-- NPWP tidak ada -->

              </v-row>
            </v-container>
          </v-card-text>

          <v-card-actions class="dialog-footer">
            <v-spacer></v-spacer>
            <v-btn variant="text" @click="closeDialog" :disabled="isSaving">Batal</v-btn>
            <v-btn color="primary" type="submit" variant="elevated" :loading="isSaving" :disabled="isSaving">
              Simpan
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card>
    </v-dialog>
    <!-- === AKHIR DIALOG === -->

    <v-dialog v-model="confirmDialogVisible" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
          Konfirmasi Penyimpanan
        </v-card-title>
        <v-card-text>
          Yakin ingin simpan data customer ini?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="cancelSaveConfirmation" :disabled="isSaving">
            Batal
          </v-btn>
          <v-btn color="primary" variant="elevated" @click="executePendingSave" :loading="isSaving"
            :disabled="isSaving">
            Ya, Simpan
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
          Yakin ingin membatalkan perubahan? Data yang belum disimpan akan hilang.
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

  </PageLayout>
</template>

<style scoped>
/* Styling untuk baris yang tidak aktif (merah) */
.inactive-row {
  color: red !important;
}

/* Pastikan chip status pasif juga ikut merah tulisannya */
.inactive-row .v-chip {
  color: red !important;
}

/* Pastikan konten mengisi tinggi halaman */
.browse-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  /* Sesuaikan tinggi berdasarkan header/footer */
}

.filter-section {
  flex-shrink: 0;
  /* Jangan biarkan filter section mengecil */
}

/* VDataTable perlu flex-grow untuk mengisi sisa ruang */
.v-data-table {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

/* Wrapper tabel harus bisa scroll jika kontennya panjang */
.v-data-table :deep(.v-table__wrapper) {
  overflow: auto;
}

/* Dialog Styles (dari referensi retail Anda) */
.dialog-card {
  font-size: 12px;
}

.dialog-header {
  border-bottom: 1px solid #e0e0e0;
  padding: 8px 16px;
  background-color: #f5f5f5;
  display: flex;
  /* Untuk v-spacer */
  align-items: center;
  /* Untuk v-spacer */
}

.dialog-footer {
  border-top: 1px solid #e0e0e0;
  padding: 8px 16px;
  background-color: #f5f5f5;
}

.dialog-card :deep(.v-label) {
  font-size: 11px !important;
}

.dialog-card :deep(input),
.dialog-card :deep(textarea),
.dialog-card :deep(.v-select__selection-text) {
  font-size: 12px !important;
}

/* Menyesuaikan margin agar lebih rapat */
.dialog-card :deep(.v-input) {
  margin-bottom: 4px;
}

.dialog-card :deep(.v-radio-group) {
  margin-bottom: 0px !important;
}

.v-container {
  padding-top: 8px;
  /* Kurangi padding atas container */
  padding-bottom: 8px;
  /* Kurangi padding bawah container */
}

.v-card-text {
  padding-bottom: 0px !important;
  /* Hilangkan padding bawah card text */
}
</style>
