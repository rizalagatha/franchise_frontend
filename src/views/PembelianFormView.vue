<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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

type TableHeader = {
  title: string
  key: string
  width?: string
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
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
const tableHeaders: TableHeader[] = [
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
    <div class="form-grid-container bg-grey-lighten-3">
      <aside class="left-column">
        <div class="desktop-form-section elevation-1 mb-3">
          <v-row dense>
            <v-col cols="12">
              <v-text-field label="Nomor" v-model="formHeader.nomor" readonly variant="filled" density="compact"
                hide-details>
                <template #append-inner>
                  <span v-if="!isEditMode && !formHeader.nomor"
                    class="text-caption text-disabled">&lt;Otomatis&gt;</span>
                </template>
              </v-text-field>
            </v-col>
            <v-col cols="12">
              <v-text-field label="Tanggal" v-model="formHeader.tanggal" type="date" variant="outlined"
                density="compact" hide-details />
            </v-col>
            <v-col cols="12">
              <v-text-field label="Nomor Invoice Kaosan" v-model="formHeader.noInvoice" variant="outlined"
                density="compact" hide-details :loading="isLookupLoading" :readonly="isLookupLoading || isEditMode"
                color="primary" @blur="onNoInvoiceBlur" placeholder="Ketik No. Inv lalu Enter"
                @keyup.enter="onNoInvoiceBlur" />
            </v-col>
            <v-col cols="12">
              <v-text-field label="Tgl. Invoice" v-model="formHeader.tglInvoice" type="date" variant="outlined"
                density="compact" hide-details />
            </v-col>
            <v-col cols="12">
              <v-textarea label="Keterangan" v-model="formHeader.keterangan" variant="outlined" rows="2"
                density="compact" hide-details />
            </v-col>
          </v-row>
        </div>

        <div class="desktop-form-section elevation-1 border-left-blue">
          <v-text-field label="Scan Barcode / Cari Kode Barang" v-model="scanBarcode" variant="outlined"
            density="compact" prepend-inner-icon="mdi-magnify" append-inner-icon="mdi-barcode-scan"
            @keyup.enter="onScanBarcode" :loading="isLookupLoading" :disabled="isLookupLoading"
            placeholder="Enter untuk menambah" clearable hide-details class="mb-3" color="primary" />

          <v-text-field label="Total Pembelian (HPP)" :model-value="formatCurrency(grandTotal)" readonly
            variant="filled" density="compact" hide-details class="total-field-highlight" />
        </div>
      </aside>

      <main class="right-column">
        <div class="desktop-form-section d-flex flex-column fill-height elevation-1 pa-0 overflow-hidden">
          <v-data-table :headers="tableHeaders" :items="items" :loading="isLoading" density="compact"
            class="desktop-table fill-height-table colored-header" fixed-header :items-per-page="-1"
            no-data-text="Scan barcode atau tarik dari invoice.">

            <template #[`item.no`]="{ index }">
              {{ index + 1 }}
            </template>

            <template #[`item.qtyinv`]="{ value }">{{ formatNumber(value) }}</template>
            <template #[`item.hpp`]="{ value }">{{ formatCurrency(value) }}</template>
            <template #[`item.jual`]="{ value }">{{ formatCurrency(value) }}</template>

            <template #[`item.total`]="{ value }">
              <span class="text-primary font-weight-bold">{{ formatCurrency(value) }}</span>
            </template>

            <template #[`item.jumlah`]="{ item }">
              <v-text-field v-model.number="item.jumlah" type="number" min="0" variant="underlined" density="compact"
                hide-details class="text-right-input" color="primary" @focus="$event.target.select()" />
            </template>

            <template #[`item.actions`]="{ item }">
              <v-icon v-if="item.kode" size="small" color="error" @click="removeItem(item)" tabindex="-1">
                mdi-delete-outline
              </v-icon>
            </template>

            <template v-slot:loading>
              <div class="text-center py-10">
                <v-progress-circular indeterminate color="primary" size="32" width="3"></v-progress-circular>
                <div class="mt-2 text-primary font-weight-bold" style="font-size: 11px;">
                  Menarik data dari server...
                </div>
              </div>
            </template>
            <template #bottom></template>
          </v-data-table>
        </div>
      </main>
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
/* 1. Global Font 11px untuk area Form */
.form-grid-container :deep(*) {
  font-size: 11px !important;
}

/* 2. Layout Grid */
.form-grid-container {
  padding: 12px;
  height: calc(100vh - 100px);
  display: grid;
  grid-template-columns: 320px 1fr;
  /* Lebar kolom kiri */
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

/* 3. Overlay Section Styling */
.desktop-form-section {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white !important;
}

/* Aksen Garis Biru Samping */
.border-left-blue {
  border-left: 4px solid #1976D2 !important;
}

/* 4. Konsistensi Biru (Tabel Header) */
.colored-header :deep(thead th) {
  background-color: #1976D2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
  height: 36px !important;
}

/* 5. Custom Input Grid */
.text-right-input :deep(input) {
  text-align: right;
  font-weight: bold;
}

/* Highlight Field Total */
.total-field-highlight :deep(input) {
  color: #1976D2 !important;
  font-weight: 900 !important;
  font-size: 15px !important;
  /* Total dibuat lebih besar sedikit */
}

/* Hilangkan Spinner Angka */
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

/* Table Wrapper */
.desktop-table {
  height: 100%;
}

.desktop-table :deep(.v-table__wrapper) {
  height: 100%;
  overflow-y: auto;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
