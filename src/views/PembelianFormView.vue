<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { VDataTableHeaders } from 'vuetify/components';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import type { AxiosError } from 'axios';

// Store & composables
const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '22';

// Interface untuk item di grid (sesuai Delphi GetCDS)
interface PembelianItem {
  id: number; // ID unik FE
  kode: string;
  barcode: string;
  nama: string;
  ukuran: string;
  qtyinv: number | null;
  jumlah: number | null; // Qty Terima (editable)
  hpp: number | null;
  jual: number | null;
  total: number;
  // Field data master (untuk simpan baru)
  ktgp?: string;
  ktg?: string;
  bahan?: string;
  jeniskaos?: string;
  tipe?: string;
  lengan?: string;
  jeniskain?: string;
  warna?: string;
}

// Tentukan mode
const isEditMode = computed(() => !!route.params.nomor);
const pageTitle = computed(() => isEditMode.value ? 'Ubah Data Pembelian' : 'Input Pembelian Baru');
const requiredPermission = computed(() => isEditMode.value ? 'edit' : 'insert');

// State Header Form
const formHeader = ref({
  nomor: '',
  tanggal: format(new Date(), 'yyyy-MM-dd'),
  noInvoice: '',
  tglInvoice: format(new Date(), 'yyyy-MM-dd'),
  keterangan: '',
});

// State Grid Detail
const items = ref<PembelianItem[]>([]);
const nextItemId = ref(1);
const grandTotal = ref(0); // Total keseluruhan (edtTotal)

// State Loading & Saving
const isLoading = ref(true); // Loading data awal (untuk edit)
const isSaving = ref(false);
const isLookupLoading = ref(false); // Loading saat scan/tarik invoice

// State Scan Barcode
const scanBarcode = ref('');

// State Konfirmasi
const isConfirmDialogVisible = ref(false);
const confirmText = ref('');
const pendingAction = ref<(() => void) | null>(null);

// Header Tabel Detail
const tableHeaders: VDataTableHeaders = [
  { title: '#', key: 'no', sortable: false, width: '40px' },
  { title: 'Kode Barang', key: 'kode', width: '120px' },
  { title: 'Barcode', key: 'barcode', width: '130px' },
  { title: 'Nama Barang', key: 'nama', width: '300px' },
  { title: 'Size', key: 'ukuran', align: 'center', width: '80px' },
  { title: 'Qty Inv', key: 'qtyinv', align: 'end', width: '100px' },
  { title: 'Qty Terima', key: 'jumlah', align: 'end', width: '120px' },
  { title: 'HPP', key: 'hpp', align: 'end', width: '100px' },
  { title: 'Harga Jual', key: 'jual', align: 'end', width: '100px' },
  { title: 'Total', key: 'total', align: 'end', width: '130px' },
  { title: 'Actions', key: 'actions', sortable: false, width: '50px', align: 'center' },
];

// --- Methods ---

// Hitung total per baris dan grand total
const calculateTotals = () => {
  let total = 0;
  items.value.forEach(item => {
    const jumlah = item.jumlah || 0;
    const hpp = item.hpp || 0;
    item.total = jumlah * hpp;
    total += item.total;
  });
  grandTotal.value = total;
};

// Watcher untuk menghitung ulang saat 'jumlah' atau 'hpp' berubah
watch(items, calculateTotals, { deep: true });

// Format Angka
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

// Load data jika mode Edit
const loadDataForEdit = async (nomor: string) => {
  isLoading.value = true;
  try {
    const response = await api.get(`/pembelian/form/${nomor}`);
    const { header, items: loadedItems } = response.data;

    formHeader.value = {
      nomor: header.bpb_nomor,
      tanggal: header.bpb_tanggal,
      noInvoice: header.bpb_inv_nomor,
      tglInvoice: header.bpb_inv_tanggal,
      keterangan: header.bpb_ket,
    };
    items.value = loadedItems.map((item: any) => ({
      ...item,
      id: nextItemId.value++
    }));

    addEmptyRow(); // Tambah baris kosong di akhir
    calculateTotals(); // Hitung total awal

  } catch (error: unknown) {
    toast.error('Gagal memuat data.');
    router.back();
  } finally {
    isLoading.value = false;
  }
};

// Tarik data dari Invoice Eksternal (edtNomorInvExit)
const onNoInvoiceBlur = async () => {
  const invNomor = formHeader.value.noInvoice;
  // Hanya jalankan jika mode Baru dan No. Invoice diisi
  if (isEditMode.value || !invNomor.trim() || isLookupLoading.value) return;

  isLookupLoading.value = true;
  try {
    const response = await api.get(`/pembelian/lookup/invoice/${invNomor.trim()}`);
    const { header, items: loadedItems } = response.data;

    // Isi Tgl Invoice
    formHeader.value.tglInvoice = header.tglInvoice;

    // Isi grid
    items.value = loadedItems.map((item: any) => ({ ...item, id: nextItemId.value++ }));
    addEmptyRow();
    calculateTotals();

    toast.success(`Data dari Invoice ${invNomor} berhasil ditarik.`);

  } catch (error: unknown) {
    const err = error as AxiosError<{ message?: string }>;
    toast.error(err.response?.data?.message || 'Gagal menarik data invoice.');
  } finally {
    isLookupLoading.value = false;
  }
};

// Scan Barcode (loadbrg)
const onScanBarcode = async () => {
  if (!scanBarcode.value.trim() || isLookupLoading.value) return;

  const barcode = scanBarcode.value.trim();
  isLookupLoading.value = true;

  try {
    // 1. Cek duplikat di grid (Delphi: loop cxGrdMaster)
    const existingItem = items.value.find(i => i.barcode === barcode);
    if (existingItem) {
      existingItem.jumlah = (existingItem.jumlah || 0) + 1; // Tambah Qty Terima
      toast.info(`Jumlah ${existingItem.nama} (${existingItem.ukuran}) ditambah.`);
      scanBarcode.value = ''; // Kosongkan scan bar
      isLookupLoading.value = false;
      // Fokus ke input jumlah item tsb (opsional)
      return;
    }

    console.log('🔹 Lookup barcode', barcode);
    // 2. Jika tidak duplikat, panggil API
    const response = await api.get(`/pembelian/lookup/barcode/${barcode}?_=${Date.now()}`);
    console.log('✅ Response:', response);
    const itemResult = response.data;

    // Hapus baris kosong terakhir
    const lastRow = items.value[items.value.length - 1];
    if (lastRow && !lastRow.kode && !lastRow.nama) {
      items.value.pop();
    }

    // 3. Tambah item baru
    items.value.push({
      id: nextItemId.value++,
      kode: itemResult.kode,
      barcode: itemResult.barcode,
      nama: itemResult.nama,
      ukuran: itemResult.ukuran,
      qtyinv: 0, // Manual scan tidak ada Qty Inv
      jumlah: 1, // Default Qty Terima 1
      hpp: itemResult.hpp,
      jual: itemResult.jual,
      total: 0, // Akan dihitung ulang oleh watcher
    });

    addEmptyRow(); // Tambah baris kosong baru
    scanBarcode.value = ''; // Kosongkan scan bar

    // Fokus ke input jumlah item yg baru ditambahkan
    await nextTick();
    const inputs = document.querySelectorAll('.qty-terima-input');
    const lastInput = inputs[inputs.length - 2]; // -2 karena ada baris kosong

    if (lastInput instanceof HTMLInputElement) {
      lastInput.focus();
      lastInput.select();
    }

  } catch (error: unknown) {
    console.error('❌ Catch error on scan', error);
    const err = error as AxiosError<{ message?: string }>;
    toast.error(err.response?.data?.message || 'Gagal memproses barcode.');
  } finally {
    isLookupLoading.value = false;
  }
};

// Hapus item dari grid
const removeItem = (itemToRemove: PembelianItem) => {
  items.value = items.value.filter(item => item.id !== itemToRemove.id);
  if (items.value.length === 0) {
    addEmptyRow();
  }
  calculateTotals(); // Hitung ulang total
};

// Tambah baris kosong
const addEmptyRow = () => {
  items.value.push({
    id: nextItemId.value++,
    kode: '', barcode: '', nama: '', ukuran: '',
    qtyinv: null, jumlah: null, hpp: null, jual: null, total: 0,
  });
};

// Simpan data
const save = () => {
  // Validasi (btnSimpanClick Delphi)
  const validItems = items.value.filter(item => item.kode && (item.jumlah || 0) > 0);
  if (validItems.length === 0) {
    return toast.error('Detail barang harus diisi dan Qty Terima tidak boleh nol.');
  }

  showConfirmation(executeSave, "Yakin ingin simpan data pembelian ini?");
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      items: items.value.filter(item => item.kode && (item.jumlah || 0) > 0),
      isNew: !isEditMode.value,
    };

    const response = await api.post('/pembelian/save', payload);
    toast.success(response.data.message);
    router.push('/transaksi/pembelian'); // Kembali ke browse

  } catch (err) {
    const error = err as AxiosError<{ message?: string }>;
    toast.error(error.response?.data?.message || 'Gagal menyimpan data.');
  } finally {
    isSaving.value = false;
    closeConfirmDialog();
  }
};

// Reset form (Batal)
const resetForm = () => {
  if (isEditMode.value) {
    loadDataForEdit(route.params.nomor as string);
  } else {
    // Sesuai refreshdata Delphi
    formHeader.value = {
      nomor: '',
      tanggal: format(new Date(), 'yyyy-MM-dd'),
      noInvoice: '',
      tglInvoice: format(new Date(), 'yyyy-MM-dd'),
      keterangan: '',
    };
    items.value = [];
    addEmptyRow();
  }
  toast.info("Form dibatalkan.");
};

// Konfirmasi & Tutup
const showConfirmation = (action: () => void, text: string) => {
  pendingAction.value = action;
  confirmText.value = text;
  isConfirmDialogVisible.value = true;
};
const executePendingAction = () => {
  if (pendingAction.value) pendingAction.value();
  closeConfirmDialog();
};
const closeConfirmDialog = () => {
  isConfirmDialogVisible.value = false;
  pendingAction.value = null;
};
const closeForm = () => {
  router.push('/transaksi/pembelian'); // Kembali ke browse
};

// Lifecycle hook
onMounted(async () => { // <-- Jadikan 'async'
  // Cek izin akses
  if (!authStore.can(MENU_ID, requiredPermission.value)) {
    toast.error(`Anda tidak memiliki izin untuk ${isEditMode.value ? 'mengubah' : 'membuat'} data.`);
    router.replace({ name: 'Pembelian' });
    return;
  }

  // Load data jika mode Edit
  const nomor = route.params.nomor as string;
  if (isEditMode.value && nomor) {
    loadDataForEdit(nomor);
  } else {
    // Mode Baru: Tambah baris kosong awal
    addEmptyRow();
    isLoading.value = false; // Tidak perlu loading
  }
});
</script>

<template>
  <PageLayout :title="pageTitle" desktop-mode icon="mdi-cart-arrow-down">
    <template #header-actions>
      <v-btn v-if="authStore.can(MENU_ID, requiredPermission)" size="small" color="primary" @click="save"
        :loading="isSaving" :disabled="isSaving || isLoading || isLookupLoading" prepend-icon="mdi-content-save">
        Simpan
      </v-btn>
      <v-btn size="small" @click="showConfirmation(resetForm, 'Yakin ingin batalkan perubahan?')"
        :disabled="isSaving || isLoading" prepend-icon="mdi-cancel">
        Batal
      </v-btn>
      <v-btn size="small" @click="showConfirmation(closeForm, 'Yakin ingin menutup form?')" :disabled="isSaving"
        prepend-icon="mdi-close">
        Tutup
      </v-btn>
    </template>

    <!-- Layout Form (Left-Right Column) -->
    <div class="form-grid-container">
      <!-- Left Column (Header) -->
      <div class="left-column">
        <div class="desktop-form-section header-section">
          <v-row dense>
            <!-- Nomor -->
            <v-col cols="12">
              <v-text-field label="Nomor" v-model="formHeader.nomor" readonly filled density="compact" hide-details>
                <template #append-inner>
                  <span v-if="!isEditMode && !formHeader.nomor"
                    class="text-caption text-disabled">&lt;Otomatis&gt;</span>
                </template>
              </v-text-field>
            </v-col>
            <!-- Tanggal -->
            <v-col cols="12">
              <v-text-field label="Tanggal" v-model="formHeader.tanggal" type="date" variant="outlined"
                density="compact" hide-details />
            </v-col>
            <!-- Nomor Invoice -->
            <v-col cols="12">
              <v-text-field label="Nomor Invoice" v-model="formHeader.noInvoice" variant="outlined" density="compact"
                hide-details :loading="isLookupLoading" :readonly="isLookupLoading || isEditMode"
                @blur="onNoInvoiceBlur" placeholder="Ketik No. Inv lalu Enter/Blur" @keyup.enter="onNoInvoiceBlur" />
            </v-col>
            <!-- Tgl Invoice -->
            <v-col cols="12">
              <v-text-field label="Tgl. Invoice" v-model="formHeader.tglInvoice" type="date" variant="outlined"
                density="compact" hide-details />
            </v-col>
            <!-- Keterangan -->
            <v-col cols="12">
              <v-textarea label="Keterangan" v-model="formHeader.keterangan" variant="outlined" rows="3"
                density="compact" hide-details />
            </v-col>
          </v-row>
        </div>

        <!-- Kolom Kiri Bawah (Scan & Total) -->
        <div class="desktop-form-section">
          <v-text-field label="Scan Barcode / Cari Kode Barang" v-model="scanBarcode" variant="outlined"
            density="compact" prepend-inner-icon="mdi-magnify" append-inner-icon="mdi-barcode-scan"
            @keyup.enter="onScanBarcode" :loading="isLookupLoading" :disabled="isLookupLoading"
            placeholder="Enter untuk menambah" clearable hide-details class="mb-3" />
          <v-text-field label="Total Pembelian (HPP)" :model-value="formatCurrency(grandTotal)" readonly filled
            density="compact" hide-details class="text-h6 font-weight-bold text-deep-purple" />
        </div>

      </div>

      <!-- Right Column (Grid Detail) -->
      <div class="right-column">
        <div class="desktop-form-section d-flex flex-column fill-height">
          <v-data-table :headers="tableHeaders" :items="items" :loading="isLoading" density="compact"
            class="desktop-table fill-height-table" fixed-header :items-per-page="-1"
            no-data-text="Scan barcode atau tarik dari invoice.">
            <!-- Kolom Nomor Urut -->
            <template #[`item.no`]="{ index }">
              {{ index + 1 }}
            </template>
            <!-- Kolom Readonly -->
            <template #[`item.qtyinv`]="{ value }">{{ formatNumber(value) }}</template>
            <template #[`item.hpp`]="{ value }">{{ formatCurrency(value) }}</template>
            <template #[`item.jual`]="{ value }">{{ formatCurrency(value) }}</template>
            <template #[`item.total`]="{ value }"><span class="font-weight-bold">{{ formatCurrency(value)
            }}</span></template>

            <!-- Kolom Qty Terima (Editable) -->
            <template #[`item.jumlah`]="{ item }">
              <v-text-field v-model.number="item.jumlah" type="number" min="0" variant="underlined" density="compact"
                hide-details class="text-end qty-terima-input" @focus="$event.target.select()" />
            </template>

            <!-- Kolom Actions (Hapus Baris) -->
            <template #[`item.actions`]="{ item }">
              <v-icon size="small" color="error" @click="removeItem(item)" tabindex="-1">
                mdi-delete-outline
              </v-icon>
            </template>

            <template v-slot:loading>...</template>
            <template #bottom></template> <!-- Footer dihilangkan -->
          </v-data-table>
        </div>
      </div>
    </div>

    <!-- Dialog Konfirmasi -->
    <v-dialog v-model="isConfirmDialogVisible" max-width="400px">
      <v-card>
        <v-card-title class="text-h6 font-weight-bold d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
          Konfirmasi
        </v-card-title>
        <v-card-text>{{ confirmText }}</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeConfirmDialog">Tidak</v-btn>
          <v-btn color="primary" variant="tonal" @click="executePendingAction" :loading="isSaving">Ya, Lanjutkan</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
/* Salin style dari BarcodeFormView.vue */
.form-grid-container {
  padding: 12px;
  height: calc(100vh - 120px);
  display: grid;
  grid-template-columns: 350px 1fr;
  /* Kolom kiri 350px */
  gap: 12px;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.right-column {
  flex-grow: 1;
}

.desktop-form-section {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: white;
}

.header-section {
  flex-shrink: 0;
}

.desktop-table {
  height: 100%;
}

.desktop-table :deep(.v-table__wrapper) {
  height: 100%;
  overflow-y: auto;
}

/* Styling input di dalam tabel */
.v-data-table :deep(input[type='number']) {
  text-align: right;
  -moz-appearance: textfield;
}

.v-data-table :deep(input[type=number]::-webkit-inner-spin-button),
.v-data-table :deep(input[type=number]::-webkit-outer-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.v-data-table :deep(.v-field--variant-underlined .v-field__input) {
  padding-top: 0;
  padding-bottom: 2px;
}
</style>
