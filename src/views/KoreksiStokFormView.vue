<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { VForm } from 'vuetify/components'
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import type { AxiosError } from 'axios';
import ItemLookupModal from '@/components/lookup/ItemLookupModal.vue'; // Asumsi modal lookup F1
import logoUrl from '@/assets/logo.png';

// Store & composables
const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '23';

// Interface Grid Item (sesuai Delphi GetCDS)
interface KoreksiItem {
  id: number;
  kode: string;
  barcode: string;
  nama: string;
  ukuran: string;
  stok: number | null;
  jumlah: number | null; // Qty Real (editable)
  selisih: number;
  hpp: number | null;
  total: number;
  keterangan: string | null; // Editable
}

// Interface F1 Lookup (Minimal)
interface LookupItem {
  kode: string;
  nama: string;
}
// Interface F1/Scan Lookup (Detail)
interface LookupResultItem {
  kode: string;
  barcode: string;
  nama: string;
  ukuran: string;
  hpp: number | null;
  stok: number | null;
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
const pageTitle = computed(() => isEditMode.value ? 'Ubah Koreksi Stok' : 'Koreksi Stok Baru');
const requiredPermission = computed(() => isEditMode.value ? 'edit' : 'insert');
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete'));

// State Header Form
const formHeader = ref({
  nomor: '',
  tanggal: format(new Date(), 'yyyy-MM-dd'),
  keterangan: '',
});

// State Grid Detail
const items = ref<KoreksiItem[]>([]);
const nextItemId = ref(1);
const grandTotal = ref(0);

// State Loading & Saving
const isLoading = ref(true);
const isSaving = ref(false);
const isLookupLoading = ref(false);

// State Scan/F1
const scanBarcode = ref(''); // Untuk input scan
const isLookupVisible = ref(false); // Modal F1
const editingRowIndex = ref<number | null>(null);

// [FIX] Tambahkan 'dialogVisible' dan 'formRef'
const dialogVisible = ref(false); // (Ini tidak dipakai di form, tapi ada di Customer. Abaikan jika tidak perlu)
const formRef = ref<VForm | null>(null);

// State Konfirmasi
const isConfirmDialogVisible = ref(false);
const confirmText = ref('');
const pendingAction = ref<(() => void) | null>(null);
const confirmCancelDialogVisible = ref(false);

// State Print Preview
const isPrintPreviewVisible = ref(false);
const printPreviewData = ref<{ header: any; details: any[]; totalNominal: number } | null>(null);
const isPrinting = ref(false);
const isPrintConfirmDialogVisible = ref(false);
const savedNomorForPrint = ref('');

// Header Tabel Detail
const tableHeaders: TableHeader[] = [
  { title: '#', key: 'no', sortable: false, width: '40px' },
  { title: 'Kode Barang', key: 'kode', width: '120px' },
  { title: 'Nama Barang', key: 'nama', width: '300px' },
  { title: 'Size', key: 'ukuran', align: 'center', width: '80px' },
  { title: 'Stok Awal', key: 'stok', align: 'end', width: '90px' },
  { title: 'Jumlah Real', key: 'jumlah', align: 'end', width: '120px' },
  { title: 'Selisih', key: 'selisih', align: 'end', width: '90px' },
  { title: 'HPP', key: 'hpp', align: 'end', width: '100px' },
  { title: 'Total', key: 'total', align: 'end', width: '120px' },
  { title: 'Keterangan', key: 'keterangan', width: '150px' },
  { title: 'Barcode', key: 'barcode', width: '130px' },
  { title: 'Actions', key: 'actions', sortable: false, width: '50px', align: 'center' },
];

// --- Methods ---

// Hitung Selisih, Total, dan Grand Total
const calculateTotals = () => {
  let total = 0;
  items.value.forEach(item => {
    const stok = item.stok || 0;
    const jumlah = item.jumlah || 0;
    const hpp = item.hpp || 0;

    item.selisih = jumlah - stok;
    item.total = item.selisih * hpp;

    total += item.total;
  });
  grandTotal.value = total;
};
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
    const response = await api.get(`/koreksi-stok/form/${nomor}`);
    const { header, items: loadedItems } = response.data;

    formHeader.value = {
      nomor: header.kor_nomor,
      tanggal: header.kor_tanggal,
      keterangan: header.kor_ket,
    };
    items.value = loadedItems.map((item: any) => ({
      ...item,
      id: nextItemId.value++
    }));
    addEmptyRow();
    calculateTotals();

  } catch (error: unknown) { /* ... error handling ... */ }
  finally { isLoading.value = false; }
};

// Fungsi Universal untuk menambah item (dari Scan atau F1)
const processLookupResult = (itemResult: LookupResultItem, targetIndex: number) => {
  // Cek duplikat di baris LAIN
  const existingItemIndex = items.value.findIndex((i, idx) =>
    i.kode === itemResult.kode &&
    i.ukuran === itemResult.ukuran &&
    idx !== targetIndex
  );

  if (existingItemIndex > -1) {
    toast.warning(`Barang ${itemResult.nama} (${itemResult.ukuran}) sudah ada di baris ${existingItemIndex + 1}.`);
    // Jika scan, tambahkan jumlah di baris yang ada?
    if (targetIndex === -1) { // -1 menandakan dari scan bar
      const existingItem = items.value[existingItemIndex]
      if (existingItem) {
        existingItem.jumlah = (existingItem.jumlah || 0) + 1
      }
      toast.info(`Jumlah ${itemResult.nama} (${itemResult.ukuran}) ditambah 1.`);
    }
    return false; // Gagal tambah
  }

  // Tentukan baris target (baris F1 atau baris kosong terakhir)
  let rowToUpdate: KoreksiItem;
  if (targetIndex === -1) { // Dari scan bar
    const lastRow = items.value[items.value.length - 1];
    if (lastRow && !lastRow.kode) items.value.pop();

    rowToUpdate = {
      id: nextItemId.value++,
      ...itemResult, // Ambil semua data dari lookup
      jumlah: 1, // Default 1 untuk scan
      selisih: 0, total: 0, keterangan: ''
    };
    items.value.push(rowToUpdate);
  } else { // Dari F1
    const target = items.value[targetIndex]
    if (!target) return false
    rowToUpdate = target
    // Isi data dari F1
    Object.assign(rowToUpdate, itemResult);
    rowToUpdate.jumlah = 0; // Default 0 untuk F1
  }

  // Hitung ulang selisih & total untuk baris ini
  const stok = rowToUpdate.stok || 0;
  const jumlah = rowToUpdate.jumlah || 0;
  const hpp = rowToUpdate.hpp || 0;
  rowToUpdate.selisih = jumlah - stok;
  rowToUpdate.total = rowToUpdate.selisih * hpp;

  // Jika ini baris terakhir, tambah baris kosong baru
  const lastItem = items.value[items.value.length - 1];
  if (lastItem && lastItem.kode) {
    addEmptyRow();
  }

  return true; // Sukses tambah
};

// Scan Barcode (Enter)
const onScanBarcode = async () => {
  if (!scanBarcode.value.trim() || isLookupLoading.value) return;

  const barcode = scanBarcode.value.trim();
  isLookupLoading.value = true;

  try {
    const response = await api.get(`/koreksi-stok/lookup/barcode`, {
      params: {
        barcode: barcode,
        tanggal: formHeader.value.tanggal,
        nomor: formHeader.value.nomor // Kirim nomor koreksi saat ini (untuk cekkor)
      }
    });

    const itemResult = response.data as LookupResultItem;

    if (processLookupResult(itemResult, -1)) { // -1 = mode scan
      scanBarcode.value = ''; // Kosongkan scan bar
      // Fokus ke input jumlah
      await nextTick();
      const inputs = document.querySelectorAll<HTMLInputElement>('.qty-real-input');
      const lastInput = inputs[inputs.length - 2]; // -2 karena ada baris kosong
      lastInput?.focus();
      lastInput?.select();
    }

  } catch (error: unknown) {
    const err = error as AxiosError<{ message?: string }>;
    toast.error(err.response?.data?.message || 'Gagal memproses barcode.');
    scanBarcode.value = '';
  } finally {
    isLookupLoading.value = false;
  }
};

// F1 Lookup
const openLookup = (index: number) => {
  if (!canInsert.value && !canEdit.value) return;
  editingRowIndex.value = index;
  isLookupVisible.value = true;
};
const closeLookupModal = () => { isLookupVisible.value = false; editingRowIndex.value = null; };
const onItemSelected = async (selectedItem: LookupResultItem) => {
  if (editingRowIndex.value !== null) {
    // Langsung panggil processLookupResult dengan data lengkap dari modal
    processLookupResult(selectedItem, editingRowIndex.value);
  }
  closeLookupModal();
};

// Hapus item dari grid
const removeItem = (itemToRemove: KoreksiItem) => {
  items.value = items.value.filter(item => item.id !== itemToRemove.id);
  if (items.value.length === 0) {
    addEmptyRow();
  }
  calculateTotals(); // Hitung ulang total
};

const addEmptyRow = () => {
  items.value.push({
    id: nextItemId.value++,
    kode: '', barcode: '', nama: '', ukuran: '',
    stok: null, jumlah: null, selisih: 0, hpp: null, total: 0,
    keterangan: null,
  });
};

// Simpan data
const save = () => {
  // Validasi (btnSimpanClick Delphi)
  if (!formHeader.value.keterangan?.trim()) {
    return toast.error('Keterangan harus diisi.');
  }
  const validItems = items.value.filter(item => item.kode && item.selisih !== 0);
  if (validItems.length === 0) {
    return toast.error('Detail barang harus diisi dan minimal ada 1 selisih.');
  }

  showConfirmation(executeSave, "Yakin ingin simpan data koreksi stok ini?");
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      items: items.value.filter(item => item.kode), // Kirim semua yg ada kodenya
      isNew: !isEditMode.value,
    };

    const response = await api.post('/koreksi-stok/save', payload);
    toast.success(response.data.message);

    savedNomorForPrint.value = response.data.nomor; // 1. Simpan nomor untuk dialog cetak
    isConfirmDialogVisible.value = false; // 2. Tutup dialog "Yakin Simpan?"
    isPrintConfirmDialogVisible.value = true; // 3. BUKA dialog "Ingin Cetak?"

  } catch (err) {
    const error = err as AxiosError<{ message?: string }>;
    toast.error(error.response?.data?.message || 'Gagal menyimpan data.');
    isSaving.value = false;
    closeConfirmDialog();
  }
  // 'finally' dihapus agar 'isSaving' tetap true sampai konfirmasi cetak selesai
};

const onPrintConfirmYes = () => {
  isPrintConfirmDialogVisible.value = false;
  if (savedNomorForPrint.value) {
    handlePrint(savedNomorForPrint.value); // Panggil handlePrint (yang membuka preview)
  }
  // Navigasi kembali (router.push) akan di-handle oleh dialog preview
};

// Dipanggil saat klik "Tidak (Tutup)"
const onPrintConfirmNo = () => {
  isPrintConfirmDialogVisible.value = false;
  router.push('/transaksi/koreksi-stok'); // Langsung kembali ke browse
};

// Reset form (Batal)
const resetForm = () => {
  if (isEditMode.value) {
    // Jika edit, load ulang data asli
    loadDataForEdit(route.params.nomor as string);
  } else {
    // Sesuai refreshdata Delphi
    formHeader.value = {
      nomor: '',
      tanggal: format(new Date(), 'yyyy-MM-dd'),
      keterangan: '',
    };
    items.value = [];
    addEmptyRow();
  }
  toast.info("Form dibatalkan.");
};

// Konfirmasi
const showConfirmation = (action: () => void, text: string) => {
  pendingAction.value = action;
  confirmText.value = text;
  isConfirmDialogVisible.value = true;
  // Hapus semua logika 'isPrintConfirm' dari sini
};

const executePendingAction = () => {
  if (pendingAction.value) {
    pendingAction.value();
  }
  closeConfirmDialog();
};
const closeConfirmDialog = () => {
  isConfirmDialogVisible.value = false;
  pendingAction.value = null;
};
const closeForm = () => { router.push('/transaksi/koreksi-stok'); };
const executeCancel = () => {
  dialogVisible.value = false;
  confirmCancelDialogVisible.value = false;
};
const cancelCancelConfirmation = () => {
  confirmCancelDialogVisible.value = false;
};

// --- Logika Cetak ---
const handlePrint = async (nomor: string) => {
  isPrinting.value = true;
  try {
    const response = await api.get(`/koreksi-stok/print/${nomor}`);
    printPreviewData.value = response.data; // { header, details, totalNominal }
    isPrintPreviewVisible.value = true; // Tampilkan dialog preview
  } catch (error) {
    toast.error('Gagal mengambil data cetak.');
  } finally {
    isPrinting.value = false;
    isSaving.value = false; // Matikan loading simpan SEKARANG
    closeConfirmDialog(); // Tutup dialog konfirmasi (jika ada)
  }
};

const closePreviewAndNavigate = () => {
  isPrintPreviewVisible.value = false;
  router.push('/transaksi/koreksi-stok'); // Kembali ke browse
};

const triggerBrowserPrint = async () => {
  // optional: tunggu nextTick kalau dialog dibuka baru saja
  await nextTick();

  const printContent = document.querySelector('#print-area .print-layout');
  if (!printContent) {
    console.error('Area cetak tidak ditemukan.');
    toast.error('Area cetak tidak ditemukan.');
    return;
  }

  const iframe = document.createElement('iframe');
  // buat iframe "invisible"
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    toast.error('Gagal menyiapkan dokumen cetak.');
    document.body.removeChild(iframe);
    return;
  }

  // --- CSS print manual (sesuaikan bila perlu) ---
  const css = `
    .print-layout body, .print-layout div, .print-layout p, .print-layout h1, .print-layout table, .print-layout td, .print-layout th {
    margin: 0;
    padding: 0;
    box-sizing: border-box; /* Pastikan padding/border tidak menambah ukuran elemen */
    }
    .print-layout {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      width: 210mm;
      margin: auto;
      padding: 1cm;
      color: #000;
    }
    .print-header { display: flex; align-items: center; font-size: 8pt; margin-bottom: 10px; }
    .logo-container { display: flex; align-items: center; }
    .print-logo { width: 35px; height: 35px; margin-right: 8px; flex-shrink: 0; }
    .company-info { font-size: 8pt; line-height: 1.2; }
    .company-info strong { font-size: 10pt; }
    .print-title { text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px; }
    .header-table { width: 60%; max-width: 400px; font-size: 9pt; margin-bottom: 15px; border-collapse: collapse; }
    .header-table td { padding: 1px 0; vertical-align: top; }
    .header-table td:first-child { width: auto; white-space: nowrap; padding-right: 5px; }
    .header-table td:nth-child(2) { width: 10px; padding-right: 5px; }
    .header-table td:nth-child(3) { width: 100%; }
    .detail-table-print { width: 100%; font-size: 9pt; border-collapse: collapse; margin-top: 10px; }
    .detail-table-print th, .detail-table-print td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; }
    .detail-table-print th { background-color: #f0f0f0; text-align: center; }
    .text-end { text-align: right; }
    .font-weight-bold { font-weight: bold; }
    .print-footer { margin-top: 20px; display: flex; justify-content: space-around; text-align: center; font-size: 9pt; page-break-inside: avoid; }
    @page { size: A4 portrait; margin: 1cm; }
  `;

  // Tulis dokumen iframe
  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>Cetak Koreksi Stok</title>
        <style>${css}</style>
      </head>
      <body>
        ${printContent.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  // fungsi helper untuk print + cleanup
  const doPrintAndCleanup = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print error:', e);
      toast.error('Gagal membuka dialog cetak.');
    } finally {
      // hapus iframe setelah jeda supaya print dialog sempat muncul
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1200);
    }
  };

  // coba andalkan onload, tapi juga sediakan fallback timeout
  let didPrint = false;
  iframe.onload = () => {
    if (didPrint) return;
    didPrint = true;
    doPrintAndCleanup();
  };

  // fallback: beberapa browser tidak memicu onload untuk dokumen yang kita tulis langsung
  setTimeout(() => {
    if (!didPrint) {
      didPrint = true;
      doPrintAndCleanup();
    }
  }, 700);
};

// Lifecycle hook
onMounted(() => {
  // Pengecekan izin sudah dipindah ke router
  const nomor = route.params.nomor as string;
  if (isEditMode.value && nomor) {
    loadDataForEdit(nomor);
  } else {
    addEmptyRow();
    isLoading.value = false;
  }
});
</script>

<template>
  <PageLayout :title="pageTitle" desktop-mode icon="mdi-clipboard-edit-outline">
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

    <div class="form-grid-container">
      <!-- Left Column (Header) -->
      <div class="left-column">
        <div class="desktop-form-section header-section">
          <v-row dense>
            <!-- Nomor -->
            <v-col cols="12">
              <v-text-field label="No. Koreksi" v-model="formHeader.nomor" readonly filled density="compact"
                hide-details>
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
            <!-- Note -->
            <v-col cols="12">
              <v-alert density="compact" type="info" variant="tonal" class="text-caption py-2"
                style="line-height: 1.3;">
                Note: Jumlah koreksi adalah Jumlah stok awal fisik pada tanggal koreksi tsb.
              </v-alert>
            </v-col>
            <!-- Keterangan (Wajib) -->
            <v-col cols="12">
              <v-textarea label="Keterangan *" v-model="formHeader.keterangan" variant="outlined" rows="3"
                density="compact" hide-details />
            </v-col>
          </v-row>
        </div>

        <!-- Kolom Kiri Bawah (Scan & Total) -->
        <div class="desktop-form-section">
          <v-text-field label="Scan Barcode / F1 Cari Kode" v-model="scanBarcode" variant="outlined" density="compact"
            prepend-inner-icon="mdi-magnify" append-inner-icon="mdi-barcode-scan" @keyup.enter="onScanBarcode"
            :loading="isLookupLoading" :disabled="isLookupLoading" placeholder="Enter untuk menambah" clearable
            hide-details class="mb-3" />
          <v-text-field label="Total Nominal Koreksi" :model-value="formatCurrency(grandTotal)" readonly filled
            density="compact" hide-details class="text-h6 font-weight-bold"
            :class="grandTotal > 0 ? 'text-success' : grandTotal < 0 ? 'text-error' : ''" />
        </div>
      </div>

      <!-- Right Column (Grid Detail) -->
      <div class="right-column">
        <div class="desktop-form-section d-flex flex-column fill-height">
          <v-data-table :headers="tableHeaders" :items="items" :loading="isLoading" density="compact"
            class="desktop-table fill-height-table" fixed-header :items-per-page="-1"
            no-data-text="Scan barcode atau F1 untuk menambah item.">
            <!-- Kolom Nomor Urut -->
            <template #[`item.no`]="{ index }"> {{ index + 1 }} </template>

            <!-- Kolom Kode (F1) -->
            <template #[`item.kode`]="{ item, index }">
              <v-text-field :model-value="item.kode" variant="underlined" density="compact" hide-details
                @keydown.f1.prevent="openLookup(index)" placeholder="F1 = Cari" readonly
                @click="!item.kode && openLookup(index)" style="cursor: pointer;" />
            </template>

            <!-- Kolom Readonly (Stok, Selisih, Hpp, Total, Barcode) -->
            <template #[`item.stok`]="{ value }">{{ formatNumber(value) }}</template>
            <template #[`item.selisih`]="{ value }">
              <span :class="value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''">{{ formatNumber(value) }}</span>
            </template>
            <template #[`item.hpp`]="{ value }">{{ formatCurrency(value) }}</template>
            <template #[`item.total`]="{ value }">
              <span class="font-weight-bold" :class="value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''">{{
                formatCurrency(value) }}</span>
            </template>
            <template #[`item.barcode`]="{ value }">{{ value }}</template>

            <!-- Kolom Jumlah Real (Editable) -->
            <template #[`item.jumlah`]="{ item }">
              <v-text-field v-model.number="item.jumlah" type="number" min="0" variant="underlined" density="compact"
                hide-details class="text-end qty-real-input" @focus="$event.target.select()" :disabled="!item.kode" />
            </template>

            <!-- Kolom Keterangan (Editable) -->
            <template #[`item.keterangan`]="{ item }">
              <v-text-field v-model="item.keterangan" variant="underlined" density="compact" hide-details
                :disabled="!item.kode" />
            </template>

            <!-- Kolom Actions (Hapus Baris) -->
            <template #[`item.actions`]="{ item }">
              <v-icon v-if="item.kode" size="small" color="error" @click="removeItem(item)" tabindex="-1">
                mdi-delete-outline
              </v-icon>
            </template>

            <template v-slot:loading>...</template>
            <template #bottom></template>
          </v-data-table>
        </div>
      </div>
    </div>

    <v-dialog v-model="isConfirmDialogVisible" max-width="400px" persistent>
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

    <!-- Dialog F1 Lookup -->
    <ItemLookupModal v-model="isLookupVisible" source="koreksi-stok" :tanggal="formHeader.tanggal"
      @item-selected="onItemSelected" @close="closeLookupModal" />

    <!-- Dialog Print Preview -->
    <v-dialog v-model="isPrintPreviewVisible" persistent max-width="90vw" max-height="90vh" scrollable>
      <v-card>
        <v-toolbar color="primary" density="compact">
          <v-toolbar-title>Cetak Koreksi Stok: {{ printPreviewData?.header?.nomor }}</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" @click="closePreviewAndNavigate"></v-btn>
        </v-toolbar>

        <v-card-text id="print-area" class="pa-4 flex-grow-1">
          <div v-if="printPreviewData" class="print-layout">
            <header class="print-header">
              <div class="logo-container">
                <img :src="logoUrl" alt="Logo" class="print-logo">
                <div class="company-info">
                  <strong>{{ printPreviewData.header.perusahaanNama }}</strong><br>
                  <span>{{ printPreviewData.header.perusahaanAlamat }}</span><br>
                  <span>{{ printPreviewData.header.perusahaanTelp }}</span>
                </div>
              </div>
            </header>
            <h1 class="print-title">Koreksi Stok</h1>
            <table class="header-table">
              <tr>
                <td>Nomor</td>
                <td>: {{ printPreviewData.header.nomor }}</td>
              </tr>
              <tr>
                <td>Tanggal</td>
                <td>: {{ printPreviewData.header.tanggal }}</td>
              </tr>
              <tr>
                <td>Keterangan</td>
                <td>: {{ printPreviewData.header.keterangan }}</td>
              </tr>
            </table>

            <table class="detail-table-print">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama</th>
                  <th>Ukuran</th>
                  <th>Stok</th>
                  <th>Koreksi</th>
                  <th>Selisih</th>
                  <th>Nominal</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in printPreviewData.details" :key="item.no">
                  <td>{{ item.no }}</td>
                  <td>{{ item.nama }}</td>
                  <td>{{ item.ukuran }}</td>
                  <td class="text-end">{{ formatNumber(item.stok) }}</td>
                  <td class="text-end">{{ formatNumber(item.koreksi) }}</td>
                  <td class="text-end">{{ formatNumber(item.selisih) }}</td>
                  <td class="text-end">{{ formatCurrency(item.nominal) }}</td>
                  <td>{{ item.keterangan }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="text-end font-weight-bold">Total Nominal:</td>
                  <td class="text-end font-weight-bold">{{ formatCurrency(printPreviewData.totalNominal) }}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            <footer class="print-footer">
              <div>Dibuat Oleh,<br><br><br>( {{ printPreviewData.header.userNama }} )</div>
              <div>Mengetahui,<br><br><br>( .................... )</div>
              <div>Manager,<br><br><br>( .................... )</div>
            </footer>
          </div>
        </v-card-text>

        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closePreviewAndNavigate">Tutup</v-btn>
          <v-btn color="primary" @click="triggerBrowserPrint" prepend-icon="mdi-printer">
            Cetak via Browser
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isPrintConfirmDialogVisible" persistent max-width="450px">
      <v-card>
        <v-card-title class="text-h6 d-flex align-center">
          <v-icon color="success" class="mr-2">mdi-check-circle-outline</v-icon>
          Berhasil Disimpan
        </v-card-title>
        <v-card-text>
          Data berhasil disimpan dengan Nomor:
          <br>
          <strong>{{ savedNomorForPrint }}</strong>
          <br><br>
          Ingin Cetak transaksi?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="onPrintConfirmNo">
            Tidak (Tutup)
          </v-btn>
          <v-btn color="primary" variant="elevated" @click="onPrintConfirmYes">
            Ya, Cetak
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
/* Styles untuk layout grid, left/right column */
.form-grid-container {
  padding: 12px;
  height: calc(100vh - 120px);
  display: grid;
  grid-template-columns: 350px 1fr;
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

.v-data-table :deep(input[type='number']) {
  text-align: right;
  -moz-appearance: textfield;
  appearance: textfield;
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

<style>
/* Reset margin/padding default */
.print-layout body,
.print-layout div,
.print-layout p,
.print-layout h1,
.print-layout table,
.print-layout td,
.print-layout th {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  /* Pastikan padding/border tidak menambah ukuran elemen */
}

.print-layout {
  font-family: 'Arial', sans-serif;
  font-size: 9pt;
  /* Ukuran font umum */
  width: 210mm;
  /* A4 width */
  min-height: 297mm;
  /* A4 height */
  padding: 15mm;
  /* Margin A4 */
  background-color: white;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.print-header {
  display: flex;
  align-items: flex-start;
  /* Logo dan teks rata atas */
  margin-bottom: 10px;
  /* Kurangi jarak bawah header */
}

.logo-container {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
  /* Kurangi jarak bawah logo jika ada */
}

.print-logo {
  width: 35px;
  /* Kecilkan ukuran logo */
  height: 35px;
  /* Kecilkan ukuran logo */
  margin-right: 8px;
  /* Kurangi jarak kanan logo */
  flex-shrink: 0;
  /* Pastikan logo tidak mengecil */
}

.company-info {
  font-size: 8pt;
  /* Ukuran font info perusahaan */
  line-height: 1.2;
  /* Jarak antar baris lebih rapat */
}

.company-info strong {
  font-size: 10pt;
  /* Nama perusahaan sedikit lebih besar */
}

.print-title {
  text-align: center;
  font-size: 14pt;
  /* Ukuran judul */
  font-weight: bold;
  margin-top: 5px;
  /* Kurangi jarak atas dari header */
  margin-bottom: 15px;
  /* Kurangi jarak bawah dari tabel header */
}

.header-table {
  width: 100%;
  margin-bottom: 15px;
  /* Kurangi jarak bawah tabel header */
  border-collapse: collapse;
  /* Pastikan tidak ada spasi antar sel */
}

.header-table td {
  padding: 2px 0;
  /* Kurangi padding sel */
  vertical-align: top;
}

.header-table td:first-child {
  width: 15%;
  /* Lebar kolom label (Nomor, Tanggal) */
}

.header-table td:nth-child(2) {
  width: 1%;
  /* Kolom titik dua */
}

.detail-table-print {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
  /* Kurangi jarak bawah tabel detail */
}

.detail-table-print th,
.detail-table-print td {
  border: 1px solid #000;
  padding: 4px 6px;
  /* Kurangi padding sel */
  text-align: left;
  font-size: 8pt;
  /* Ukuran font detail */
}

.detail-table-print th {
  background-color: #f0f0f0;
  font-weight: bold;
  text-align: center;
  /* Header tabel tengah */
}

.detail-table-print .text-end {
  text-align: right;
}

.detail-table-print .font-weight-bold {
  font-weight: bold;
}

.detail-table-print tfoot td {
  font-weight: bold;
  background-color: #f0f0f0;
}

.detail-table-print tfoot td:first-child {
  text-align: right;
}

.created-info {
  font-size: 7pt;
  /* Ukuran font lebih kecil */
  font-style: italic;
  margin-top: 5px;
  /* Kurangi jarak dari tabel */
  margin-bottom: 10px;
  /* Jarak ke footer */
}

.print-footer {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  /* Rata bawah */
  margin-top: auto;
  /* Dorong footer ke bawah (jika konten pendek) */
  padding-top: 20px;
  /* Jarak atas untuk garis */
  font-size: 8pt;
  /* Ukuran font tanda tangan */
}

.print-footer>div {
  text-align: center;
  width: 30%;
  /* Beri lebar agar terdistribusi */
  line-height: 1.2;
}

.print-footer>div:not(:last-child) {
  margin-right: 10px;
  /* Kurangi jarak antar kolom ttd */
}

.print-footer br {
  line-height: 1.5;
  /* Kontrol jarak baris di ttd */
}

/* Aturan khusus untuk browser print */
@media print {
  body * {
    visibility: hidden;
  }

  /* Targetkan ID unik */
  #print-area-browse,
  #print-area-browse * {
    visibility: visible;
  }

  #print-area-browse {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  /* Halaman print tanpa margin, elemen print-layout yang mengatur margin */
  @page {
    size: A4 portrait;
    margin: 0;
  }

  /* Penting: Set margin ke 0 */

  /* Reset background dan shadow untuk cetak */
  #print-area-browse>.print-layout {
    box-shadow: none;
    border: none;
    padding: 15mm;
    /* Terapkan padding A4 di sini */
  }
}
</style>
