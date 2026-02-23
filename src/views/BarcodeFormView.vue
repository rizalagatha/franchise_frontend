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
import JsBarcode from 'jsbarcode';
import ItemLookupModal from '@/components/lookup/ItemLookupModal.vue';

(window as any).JsBarcode = JsBarcode;

// Store & composables
const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '13';

// Interface untuk item di grid detail
interface BarcodeItem {
  id: number; // ID unik sementara untuk v-for key
  kode: string;
  barcode: string;
  nama: string;
  ukuran: string;
  harga: number | null;
  jumlah: number | null;
}

// Interface F1 (hanya kode & nama)
interface LookupItem {
  kode: string;
  nama: string;
}
// Interface Detail (yang diambil API kedua)
interface LookupResultItem {
  kode: string;
  barcode: string;
  nama: string;
  ukuran: string;
  harga: number | null;
}

// Tentukan mode (Edit atau Baru)
const isEditMode = computed(() => !!route.params.nomor);
const pageTitle = computed(() => isEditMode.value ? 'Ubah Cetak Barcode' : 'Buat Cetak Barcode');
const requiredPermission = computed(() => isEditMode.value ? 'edit' : 'insert');

// Hak akses (Tambahkan definisi ini)
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view')); // View (mungkin tidak dipakai di form, tapi ada)
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete')); // Meskipun tidak dipakai di form

// State untuk Header Form
const formHeader = ref({
  nomor: '', // Akan diisi saat edit atau setelah save baru
  tanggal: format(new Date(), 'yyyy-MM-dd'),
});

// State untuk Grid Detail
const items = ref<BarcodeItem[]>([]);
const nextItemId = ref(1); // Counter untuk ID unik sementara

// State Loading & Saving
const isLoading = ref(true); // Loading data awal (untuk edit)
const isSaving = ref(false);

// State untuk Lookup Barang
const searchTerm = ref('');
const lookupResults = ref<LookupItemResult[]>([]);
const isLookupLoading = ref(false);
const isLookupVisible = ref(false); // Kontrol visibility modal lookup
const editingRowIndex = ref<number | null>(null); // Index baris grid yg aktif

// State untuk Konfirmasi
const isConfirmDialogVisible = ref(false);
const confirmText = ref('');
const pendingAction = ref<(() => void) | null>(null);

// --- State BARU untuk Opsi Cetak ---
const selectedPrinter = ref<'XP-360B' | '360B'>('XP-360B'); // Default printer type
const showPriceOnLabel = ref(false); // Default: harga tidak tampil
const isPrinting = ref(false); // Loading state for print preparation

// --- State BARU untuk Print Preview ---
const isPrintPreviewVisible = ref(false);
const printPreviewData = ref<any[]>([]); // Data yang akan ditampilkan di preview

// Header Tabel Detail
const tableHeaders: VDataTableHeaders = [
  { title: '#', key: 'no', sortable: false, width: '50px' },
  { title: 'Kode Barang', key: 'kode', width: '120px' },
  { title: 'Barcode', key: 'barcode', width: '130px' },
  { title: 'Nama Barang', key: 'nama', width: '300px' },
  { title: 'Size', key: 'ukuran', align: 'center', width: '80px' },
  { title: 'Harga', key: 'harga', align: 'end', width: '100px' },
  { title: 'Jumlah', key: 'jumlah', align: 'end', width: '120px' },
  { title: 'Actions', key: 'actions', sortable: false, width: '50px', align: 'center' },
];

// --- Methods ---
const printStylesXP360B = `
  @page {
    size: 68mm 15mm landscape;
    margin: 0;
  }

  html, body {
    margin: 0; padding: 0;
    width: 68mm; height: auto;
    overflow: visible !important;
    font-family: Arial, sans-serif;
    transform: rotate(180deg);
    transform-origin: center;
  }

  .label-pair-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 68mm;
    height: 15mm;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    page-break-after: always !important;
  }

  .label-pair-container:last-child {
    page-break-after: avoid;
  }

  .barcode-label {
    width: 33mm;
    height: 15mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    overflow: hidden;
    box-sizing: border-box;
    padding: 0.5mm 1mm;
    margin: 0;
    border: 0.1mm dashed #ccc;
    font-size: 5px;
    line-height: 1.1;
  }

  .item-info {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    margin: 0;
  }
  .item-name { font-weight: bold; }
  .item-size { font-weight: normal; }

  .barcode-svg {
    width: 28mm;
    height: 7mm;
    margin: 0.3mm 0;
    display: block;
  }

  .label-footer {
    display: flex;
    justify-content: space-between;
    width: 90%;
    font-size: 5px;
  }

  @media print {
    .barcode-label { border: none; }
  }
`;

// --- AKHIR CSS ---

// Load data jika mode Edit
const loadDataForEdit = async (nomor: string) => {
  isLoading.value = true;
  try {
    const response = await api.get(`/barcodes/form/${nomor}`);
    const { header, items: loadedItems } = response.data;

    formHeader.value.nomor = header.bch_nomor;
    formHeader.value.tanggal = header.bch_tanggal; // Sudah format YYYY-MM-DD

    // Tambahkan ID unik ke items
    items.value = loadedItems.map((item: any, index: number) => ({
      ...item,
      id: nextItemId.value++ // Beri ID unik
    }));

    // Tambah baris kosong di akhir jika grid kosong setelah load
    if (items.value.length === 0) {
      addEmptyRow();
    }

  } catch (error: unknown) {
    toast.error('Gagal memuat data.');
    console.error(error);
    router.back(); // Kembali jika gagal load
  } finally {
    isLoading.value = false;
  }
};

// Cari barang via API (dipicu oleh Enter di searchTerm)
const searchItem = async () => {
  if (!searchTerm.value.trim()) return;
  isLookupLoading.value = true;
  try {
    const response = await api.get<{ items: LookupItemResult[], total: number }>('/barcodes/lookup/barang', {
      params: {
        term: searchTerm.value.trim(),
        page: 1,
        itemsPerPage: 10 // Ambil 10 hasil (cukup untuk scan)
      }
    });

    const items = response.data.items;
    const total = response.data.total;

    if (total === 0) {
      toast.warning(`Barang dengan kode/barcode "${searchTerm.value}" tidak ditemukan.`);
    } else if (total === 1) {
      // Jika HANYA 1 hasil, panggil addItemToGrid
      addItemToGrid(items[0]);
      searchTerm.value = ''; // Kosongkan search bar
    } else {
      // Jika > 1 hasil (misal scan kode produk), buka modal F1
      toast.info(`Ditemukan ${total} varian. Silakan pilih dari modal.`);
      isLookupVisible.value = true;
      // Modal akan otomatis mencari berdasarkan 'searchTerm'
    }
  } catch (error) {
    toast.error('Gagal mencari barang.');
    console.error(error);
  } finally {
    isLookupLoading.value = false;
  }
};

// Tambah item hasil lookup ke grid
const addItemToGrid = (itemToAdd: LookupResultItem) => {
  // Cek duplikasi di grid (berdasarkan kode & ukuran)
  const existingItem = items.value.find(i =>
    i.kode === itemToAdd.kode && i.ukuran === itemToAdd.ukuran
  );

  if (existingItem) {
    // Jika sudah ada, tambahkan jumlahnya
    existingItem.jumlah = (existingItem.jumlah || 0) + 1;
    toast.info(`Jumlah ${existingItem.nama} (${existingItem.ukuran}) ditambah 1.`);
  } else {
    // Jika belum ada, tambahkan sebagai baris baru
    // Hapus baris kosong terakhir (jika ada)
    const lastRow = items.value[items.value.length - 1];
    if (lastRow && !lastRow.kode && !lastRow.nama) {
      items.value.pop();
    }

    items.value.push({
      id: nextItemId.value++,
      kode: itemToAdd.kode,
      barcode: itemToAdd.barcode,
      nama: itemToAdd.nama,
      ukuran: itemToAdd.ukuran,
      harga: itemToAdd.harga,
      jumlah: 1, // Default Qty 1
    });

    addEmptyRow(); // Tambah baris kosong baru di akhir
    toast.success(`${itemToAdd.nama} (${itemToAdd.ukuran}) ditambahkan.`);
  }
};

// Hapus item dari grid
const removeItem = (itemToRemove: BarcodeItem) => {
  items.value = items.value.filter(item => item.id !== itemToRemove.id);
  // Jika grid jadi kosong, tambahkan baris kosong
  if (items.value.length === 0) {
    addEmptyRow();
  }
};

// Tambah baris kosong di akhir grid
const addEmptyRow = () => {
  items.value.push({
    id: nextItemId.value++,
    kode: '',
    barcode: '',
    nama: '',
    ukuran: '',
    harga: null,
    jumlah: null,
  });
};

// Simpan data (Create/Update)
const save = () => {
  // Validasi Header
  if (!formHeader.value.tanggal) {
    return toast.error('Tanggal harus diisi.');
  }

  // Validasi Detail
  const validItems = items.value.filter(item => item.kode && (item.jumlah || 0) > 0);
  if (validItems.length === 0) {
    return toast.error('Detail barang belum diisi atau jumlah masih nol.');
  }

  // Tampilkan konfirmasi
  showConfirmation(executeSave, "Yakin ingin simpan data cetak barcode ini?");
};

// Eksekusi Save API Call
const executeSave = async () => {
  isSaving.value = true;
  let savedItems: BarcodeItem[] = [];
  let savedNomor: string = '';
  try {
    const payload = {
      header: formHeader.value,
      // Kirim hanya item yang valid
      items: items.value.filter(item => item.kode && (item.jumlah || 0) > 0),
      isNew: !isEditMode.value,
    };

    // Gunakan endpoint /save
    const response = await api.post('/barcodes/save', payload);

    savedNomor = response.data.nomor;

    savedItems = payload.items.filter(item => item.kode && (item.jumlah || 0) > 0);

    toast.success(response.data.message);

    const printOptions = {
      showPrice: showPriceOnLabel.value,
      printerType: selectedPrinter.value,
    };
    const dataToPrint = preparePrintData(savedItems, printOptions, savedNomor, format(new Date(formHeader.value.tanggal), 'dd/MM/yy'));
    handlePrint(dataToPrint);

  } catch (err) {
    const error = err as AxiosError<{ message: string }>;
    toast.error(error.response?.data?.message || 'Gagal menyimpan data.');
    console.error(err);
  } finally {
    isSaving.value = false;
    isConfirmDialogVisible.value = false; // Tutup konfirmasi
  }
};

const closePreviewAndNavigate = () => {
  isPrintPreviewVisible.value = false; // Tutup dialog preview
  // Pindahkan navigasi ke sini
  router.push('/daftar/cetak-barcode');
};

// Reset form (dipanggil oleh tombol Batal)
const resetForm = () => {
  if (isEditMode.value) {
    // Jika edit, load ulang data asli
    loadDataForEdit(route.params.nomor as string);
  } else {
    // Jika baru, reset ke state awal
    formHeader.value = {
      nomor: '',
      tanggal: format(new Date(), 'yyyy-MM-dd'),
    };
    items.value = [];
    addEmptyRow(); // Tambah baris kosong
  }
  toast.info("Form dibatalkan.");
};

// Tampilkan dialog konfirmasi
const showConfirmation = (action: () => void, text: string) => {
  pendingAction.value = action;
  confirmText.value = text;
  isConfirmDialogVisible.value = true;
};

// Eksekusi action yang ditunda (setelah konfirmasi 'Ya')
const executePendingAction = () => {
  if (pendingAction.value) {
    pendingAction.value();
  }
  closeConfirmDialog(); // Tutup dialog setelah eksekusi
};

// Tutup dialog konfirmasi
const closeConfirmDialog = () => {
  isConfirmDialogVisible.value = false;
  pendingAction.value = null;
};

// Tutup form (kembali ke browse)
const closeForm = () => {
  router.push('/daftar/cetak-barcode');
};

// Buka modal lookup dan simpan index baris
const openLookup = (index: number) => {
  // Hanya izinkan lookup jika user punya hak insert atau edit
  if (!canInsert.value && !canEdit.value) {
    toast.warning("Anda tidak punya hak akses untuk mencari barang.");
    return;
  }
  editingRowIndex.value = index;
  isLookupVisible.value = true;
};

// Tutup modal lookup
const closeLookupModal = () => {
  isLookupVisible.value = false;
  editingRowIndex.value = null; // Reset index
};

// Handler saat item dipilih dari modal lookup
const onItemSelected = async (selectedItem: LookupItem) => {
  if (editingRowIndex.value === null) {
    closeLookupModal();
    return;
  }

  const targetRowIndex = editingRowIndex.value;
  closeLookupModal();
  isLookupLoading.value = true; // Tampilkan loading di form

  try {
    // Panggil API kedua untuk dapat SEMUA varian
    // Endpoint ini DARI barcodeService.js (getVarianDetailsByKode)
    const response = await api.get(`/barcodes/details/${encodeURIComponent(selectedItem.kode)}`);
    const varianDetails: LookupResultItem[] = response.data;

    if (varianDetails.length === 0) {
      toast.error(`Detail varian untuk kode ${selectedItem.kode} tidak ditemukan.`);
      isLookupLoading.value = false;
      return;
    }

    // Hapus baris kosong tempat F1 ditekan
    const originalTargetRow = items.value[targetRowIndex];
    if (originalTargetRow && !originalTargetRow.kode) {
      items.value.splice(targetRowIndex, 1);
    }

    // Tambahkan SEMUA varian ke grid
    let addedCount = 0;
    varianDetails.forEach(varian => {
      const isDuplicate = items.value.some(existing =>
        existing.kode === varian.kode && existing.ukuran === varian.ukuran
      );
      if (!isDuplicate) {
        items.value.push({
          id: nextItemId.value++,
          kode: varian.kode,
          barcode: varian.barcode,
          nama: varian.nama,
          ukuran: varian.ukuran,
          harga: varian.harga,
          jumlah: null, // Default
        });
        addedCount++;
      }
    });
    addEmptyRow(); // Tambah baris kosong di akhir
    if (addedCount < varianDetails.length) {
      toast.warning('Beberapa ukuran sudah ada di dalam list.');
    }

  } catch (error: unknown) {
    const err = error as AxiosError<{ message?: string }>;
    toast.error(err.response?.data?.message || 'Gagal mengambil detail varian barang.');
  } finally {
    isLookupLoading.value = false;
  }
};

const preparePrintData = (
  itemsToPrint: BarcodeItem[],
  options: { showPrice: boolean; printerType: 'XP-360B' | '360B' },
  nomorDokumen: string = 'TES', // Default 'TES' untuk test printer
  tanggalDokumen: string = format(new Date(), 'dd/MM/yy') // Default tgl hari ini
): any[] => {
  const outputLabels = [];
  let labelCounter = 1; // Mirip 'r' di Delphi

  itemsToPrint.forEach(item => {
    // Delphi: if (CDS.FieldByName('barcode').asstring <> '') and (CDS.FieldByName('jumlah').AsInteger<>0) then
    if (item.barcode && (item.jumlah || 0) > 0) {
      const qty = item.jumlah || 0;
      // Delphi: while i<= CDS.FieldByName('jumlah').AsInteger do
      for (let i = 1; i <= qty; i++) {
        // Delphi: s:=s+quot('Rp '+ Trim(FormatFloat('###,###,###',CDS.FieldByName('harga').AsFloat)))+','
        const hargaFormatted = options.showPrice && item.harga && item.harga > 0
          ? `Rp ${new Intl.NumberFormat('id-ID').format(item.harga)}`
          : '';

        // Membuat object untuk satu label
        outputLabels.push({
          nomor: nomorDokumen,
          tgl: tanggalDokumen,
          kode: item.kode,
          ukuran: item.ukuran,
          barcode: item.barcode,
          nama: item.nama,
          harga: item.harga?.toString() ?? '', // Harga angka asli (jika perlu)
          charga: hargaFormatted, // Harga terformat
          nourut: labelCounter++, // Nomor urut label
          // Tambahkan properti lain jika layout butuh (tergantung pilihan printer)
          layoutType: options.printerType
        });
      }
    }
  });
  return outputLabels;
};

const handlePrint = (dataForPrint: any[]) => {
  if (dataForPrint.length === 0) {
    toast.warning("Tidak ada item valid untuk dicetak.");
    return;
  }

  isPrinting.value = true;
  console.log("--- Data Siap Cetak ---", dataForPrint);
  toast.info(`Siap mencetak ${dataForPrint.length} label (${selectedPrinter.value}, Harga: ${showPriceOnLabel.value ? 'Ya' : 'Tidak'}).`);

  // --- BUKA DIALOG PREVIEW ---
  printPreviewData.value = dataForPrint;
  isPrintPreviewVisible.value = true;
  // --- AKHIR BUKA DIALOG ---

  // Matikan loading (karena preview sudah muncul)
  isPrinting.value = false;
};

/**
 * Fungsi untuk tombol "Tes Printer".
 * Membuat data dummy dan memanggil handlePrint.
 */
const testPrinter = () => {
  // Delphi: btnTesPrinterClick
  const dummyItems: BarcodeItem[] = [{
    id: Date.now(),
    kode: '12345678',
    barcode: '12345678',
    nama: 'TES PRINTER',
    ukuran: 'TES',
    harga: 50000, // Harga contoh
    jumlah: 4, // Jumlah contoh
  }];

  const printOptions = {
    showPrice: showPriceOnLabel.value,
    printerType: selectedPrinter.value,
  };

  const dataToPrint = preparePrintData(dummyItems, printOptions, 'TES'); // Nomor 'TES'
  handlePrint(dataToPrint);

  // Tidak perlu reset form (refreshdata) di sini, biarkan user yg reset manual
};

// Fungsi untuk memicu dialog print browser
const triggerBrowserPrint = () => {
  // Fokus ke area cetak dan panggil window.print
  const printContent = document.getElementById('print-area');
  if (printContent) {
    // Cara sederhana: langsung print seluruh window (dialog akan ikut tercetak)
    // window.print();

    // Cara lebih baik (tapi lebih kompleks):
    // 1. Ambil HTML dari #print-area
    // 2. Buat iframe tersembunyi
    // 3. Masukkan HTML ke iframe
    // 4. Panggil print() pada iframe
    // 5. Hapus iframe
    // Ini mencegah UI lain ikut tercetak
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.width = '100mm';
    printFrame.style.height = '400mm'; // biar semua label muat
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      let stylesToInject = '';
      if (selectedPrinter.value === 'XP-360B') {
        stylesToInject += printStylesXP360B;
      } else {
        // Tambahkan style untuk printer '360B' jika ada
        // stylesToInject += printStyles360B;
      }
      frameDoc.write(`<html><head><title>Cetak Barcode</title><style>${stylesToInject}</style></head><body>`);
      frameDoc.write(printContent.innerHTML);
      frameDoc.write('</body></html>');
      frameDoc.close();

      // Generate barcode di dalam iframe SEBELUM print
      generateBarcodesInIframe(printFrame);

      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        // Hapus iframe setelah print (beri jeda sedikit)
        setTimeout(() => { document.body.removeChild(printFrame); }, 1500);
      }, 500); // Delay 500ms

      isPrintPreviewVisible.value = false;
      router.push('/daftar/cetak-barcode');

    } else {
      toast.error("Area cetak tidak ditemukan.");
    }
  };
}

const generateBarcodesInIframe = (iframe: HTMLIFrameElement) => {
  const frameDoc = iframe.contentWindow?.document;
  if (frameDoc && window.JsBarcode) { // Pastikan JsBarcode sudah ada
    const svgs = frameDoc.querySelectorAll('.barcode-svg');
    svgs.forEach((svgElement) => {
      const barcodeValue = svgElement.getAttribute('data-barcode-value');
      if (barcodeValue) {
        try {
          JsBarcode(svgElement as SVGElement, barcodeValue, {
            format: "CODE128", // Atau format lain
            lineColor: "#000",
            width: 1,      // Lebar bar (sesuaikan)
            height: 25,    // Tinggi bar (sesuaikan)
            displayValue: false, // Teks barcode akan kita tampilkan manual di footer
            margin: 0,
          });
        } catch (e) {
          console.error("JsBarcode error:", e);
          // Tampilkan pesan error di tempat barcode?
          svgElement.innerHTML = `<text x="0" y="10" font-size="6">Error</text>`;
        }
      }
    });
  }
};

// --- FUNGSI BARU: Generate Barcode di Dialog Preview ---
const generateBarcodesInPreview = async () => {
  await nextTick();
  const previewArea = document.getElementById('print-area');
  if (!previewArea || !window.JsBarcode) return;

  const svgs = previewArea.querySelectorAll<SVGElement>('.barcode-svg');
  svgs.forEach(svg => {
    const value = svg.getAttribute('data-barcode-value');
    if (!value) return;
    try {
      JsBarcode(svg, value, {
        format: 'CODE128',
        lineColor: '#000',
        width: 1,
        height: 25,
        displayValue: false,
        margin: 0,
      });
    } catch (err) {
      console.error('JsBarcode preview error:', err);
    }
  });
};

const onPreviewDialogEnter = async () => {
  await nextTick(); // pastikan semua node siap
  setTimeout(() => generateBarcodesInPreview(), 100); // beri waktu render 100ms
};

const onPreviewDialogClose = () => {
  // optional cleanup jika perlu
};

// Format harga (Rupiah)
const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

// Lifecycle hook
onMounted(() => {
  // Cek izin akses
  if (!authStore.can(MENU_ID, requiredPermission.value)) {
    toast.error(`Anda tidak memiliki izin untuk ${isEditMode.value ? 'mengubah' : 'membuat'} data Cetak Barcode.`);
    router.push({ name: 'CetakBarcode' }); // Arahkan kembali ke browse
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

watch(printPreviewData, (newVal) => {
  if (isPrintPreviewVisible.value && newVal.length > 0) {
    nextTick(() => setTimeout(generateBarcodesInPreview, 100));
  }
});
</script>

<template>
  <PageLayout :title="pageTitle" desktop-mode icon="mdi-barcode-scan">
    <template #header-actions>
      <v-btn size="small" color="secondary" @click="testPrinter" :loading="isPrinting"
        :disabled="isPrinting || isSaving" prepend-icon="mdi-printer-check">
        Tes Printer
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn v-if="authStore.can(MENU_ID, requiredPermission)" size="small" color="primary" @click="save"
        :loading="isSaving" :disabled="isSaving || isLoading" prepend-icon="mdi-content-save">
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
            <!-- Scan Barcode / Cari Kode -->
            <v-col cols="12">
              <v-text-field label="Scan Barcode / Cari Kode Barang" v-model="searchTerm" variant="outlined"
                density="compact" prepend-inner-icon="mdi-magnify" append-inner-icon="mdi-barcode-scan"
                @keyup.enter="searchItem" :loading="isLookupLoading" :disabled="isLookupLoading"
                placeholder="Enter untuk mencari..." clearable hide-details />
              <v-col cols="12">
                <v-radio-group v-model="selectedPrinter" inline label="Pilih Layout Printer" density="compact"
                  hide-details class="mb-n1 mt-1">
                  <v-radio label="XP-360B (Layout A)" value="XP-360B"></v-radio>
                  <v-radio label="360B (Layout B)" value="360B"></v-radio>
                </v-radio-group>
              </v-col>
              <v-col cols="12">
                <v-checkbox v-model="showPriceOnLabel" label="Tampilkan Harga Jual di Label" density="compact"
                  hide-details class="mt-n2"></v-checkbox>
              </v-col>
            </v-col>
          </v-row>
        </div>
      </div>

      <!-- Right Column (Grid Detail) -->
      <div class="right-column">
        <div class="desktop-form-section d-flex flex-column fill-height">
          <v-data-table :headers="tableHeaders" :items="items" :loading="isLoading" density="compact"
            class="desktop-table fill-height-table" fixed-header :items-per-page="-1"
            no-data-text="Scan barcode atau cari kode barang untuk menambah item.">
            <!-- Kolom Nomor Urut -->
            <template #[`item.no`]="{ index }">
              {{ index + 1 }}
            </template>

            <template #[`item.kode`]="{ item, index }">
              <v-text-field :model-value="item.kode" variant="underlined" density="compact" hide-details
                @keydown.f1.prevent="openLookup(index)" placeholder="F1 = Cari" readonly
                @click="!item.kode && openLookup(index)" style="cursor: pointer;" />
            </template>

            <!-- Kolom Harga -->
            <template #[`item.harga`]="{ item }">
              {{ formatCurrency(item.harga) }}
            </template>

            <!-- Kolom Jumlah (Editable) -->
            <template #[`item.jumlah`]="{ item }">
              <v-text-field v-model.number="item.jumlah" type="number" min="0" variant="underlined" density="compact"
                hide-details class="text-end" @focus="$event.target.select()" />
            </template>

            <!-- Kolom Actions (Hapus Baris) -->
            <template #[`item.actions`]="{ item, index }">
              <!-- Tombol hapus hanya muncul jika ada lebih dari 1 baris ATAU baris pertama tapi ada isinya -->
              <v-icon v-if="items.length > 1 || (index === 0 && item.kode)" size="small" color="error"
                @click="removeItem(item)">
                mdi-delete-outline
              </v-icon>
            </template>

            <!-- Loading & No Data -->
            <template v-slot:loading>
              <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
            </template>
            <!-- Footer dihilangkan -->
            <template #bottom></template>
          </v-data-table>
        </div>
      </div>
    </div>

    <!-- Dialog Konfirmasi -->
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
          <v-btn color="primary" variant="tonal" @click="executePendingAction">Ya, Lanjutkan</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="isPrintPreviewVisible" max-width="600px" scrollable>
      <v-card>
        <v-toolbar color="primary" density="compact">
          <v-toolbar-title>Pratinjau Cetak Barcode</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon="mdi-close" @click="closePreviewAndNavigate"></v-btn>
        </v-toolbar>

        <v-card-text class="pa-4 bg-grey-lighten-3">
          <div id="print-area">
            <div v-for="i in Math.ceil(printPreviewData.length / 2)" :key="`page-${i}`" class="label-pair-container">
              <div v-if="printPreviewData[(i - 1) * 2]" class="barcode-label">
                <div class="item-info item-name">{{ printPreviewData[(i - 1) * 2].nama }}</div>
                <div class="item-info item-size">{{ printPreviewData[(i - 1) * 2].ukuran }}</div>
                <svg class="barcode-svg" :data-barcode-value="printPreviewData[(i - 1) * 2].barcode"
                  :id="`preview-barcode-${(i - 1) * 2}`"></svg>
                <div class="label-footer">
                  <span>{{ printPreviewData[(i - 1) * 2].barcode }}</span>
                  <span>{{ printPreviewData[(i - 1) * 2].tgl }}</span>
                  <span>{{ printPreviewData[(i - 1) * 2].ukuran }}</span>
                  <span v-if="printPreviewData[(i - 1) * 2].charga">{{ printPreviewData[(i - 1) * 2].charga }}</span>
                </div>
              </div>
              <div v-else class="barcode-label barcode-label-empty"></div>

              <div v-if="printPreviewData[(i - 1) * 2 + 1]" class="barcode-label">
                <div class="item-info item-name">{{ printPreviewData[(i - 1) * 2 + 1].nama }}</div>
                <div class="item-info item-size">{{ printPreviewData[(i - 1) * 2 + 1].ukuran }}</div>
                <svg class="barcode-svg" :data-barcode-value="printPreviewData[(i - 1) * 2 + 1].barcode"
                  :id="`preview-barcode-${(i - 1) * 2 + 1}`"></svg>
                <div class="label-footer">
                  <span>{{ printPreviewData[(i - 1) * 2 + 1].barcode }}</span>
                  <span>{{ printPreviewData[(i - 1) * 2 + 1].tgl }}</span>
                  <span>{{ printPreviewData[(i - 1) * 2 + 1].ukuran }}</span>
                  <span v-if="printPreviewData[(i - 1) * 2 + 1].charga">{{ printPreviewData[(i - 1) * 2 + 1].charga
                  }}</span>
                </div>
              </div>
              <div v-else class="barcode-label barcode-label-empty"></div>
            </div>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closePreviewAndNavigate">Tutup</v-btn>
          <v-btn color="primary" @click="triggerBrowserPrint" prepend-icon="mdi-printer">
            Cetak via Browser
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ItemLookupModal v-model="isLookupVisible" source="cetak-barcode" @item-selected="onItemSelected"
      @close="closeLookupModal" />

  </PageLayout>
</template>

<style scoped>
/* Styles untuk layout grid, left/right column (dari referensi Mutasi Out) */
.form-grid-container {
  padding: 12px;
  height: calc(100vh - 120px);
  /* Sesuaikan tinggi */
  display: grid;
  grid-template-columns: 350px 1fr;
  /* Lebar kolom kiri lebih kecil */
  gap: 12px;
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  /* Penting untuk flex column */
}

.right-column {
  flex-grow: 1;
  /* Kolom kanan mengisi sisa ruang */
}

/* Section styling */
.desktop-form-section {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: white;
}

.header-section {
  flex-shrink: 0;
  /* Header tidak mengecil */
}

/* Tabel di kolom kanan mengisi tinggi */
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
  /* Angka rata kanan */
  -moz-appearance: textfield;
  /* Sembunyikan panah di Firefox */
}

/* Sembunyikan panah di Chrome, Safari, Edge */
.v-data-table :deep(input[type=number]::-webkit-inner-spin-button),
.v-data-table :deep(input[type=number]::-webkit-outer-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>

<style>
/* === STYLE GLOBAL UNTUK PREVIEW & CETAK === */

/* Preview container */
#print-area {
  background-color: #f5f5f5;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  overflow-y: auto;
}

/* Setiap baris label (2 kolom) - lebih lebar untuk mengisi ruang */
.label-pair-container {
  width: 148mm;
  /* Diperbesar dari 136mm */
  height: 32mm;
  /* Diperbesar dari 30mm */
  background-color: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  border-radius: 2px;
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  box-sizing: border-box;
  flex-shrink: 0;
  padding: 0;
  margin: 0;
}

/* Label individual */
.barcode-label {
  width: 74mm;
  /* 50% dari 148mm */
  height: 32mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  font-family: Arial, sans-serif;
  padding: 2mm;
  box-sizing: border-box;
  overflow: hidden;
}

.barcode-label-empty {
  visibility: hidden;
}

/* Info teks */
.item-info {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.2;
  margin: 0;
  color: #333;
}

.item-name {
  font-weight: bold;
  font-size: 11px;
  margin-bottom: 1mm;
}

.item-size {
  font-size: 9px;
  font-weight: normal;
  margin-bottom: 2mm;
}

.barcode-svg {
  width: 95%;
  max-width: 100%;
  height: auto;
  margin: 2mm 0;
  display: block;
}

.label-footer {
  font-size: 7px;
  display: flex;
  justify-content: space-between;
  width: 95%;
  margin-top: 1mm;
  gap: 3px;
}


/* --- MODE PRINT --- */
@media print {
  @page {
    size: 68mm 15mm;
    margin: 0;
  }

  body * {
    visibility: hidden;
  }

  #print-area,
  #print-area * {
    visibility: visible;
  }

  #print-area {
    position: absolute;
    left: 0;
    top: 0;
    background: white;
    padding: 0;
    display: block;
  }

  .label-pair-container {
    width: 68mm;
    height: 15mm;
    box-shadow: none;
    border-radius: 0;
    page-break-after: always;
    margin: 0;
  }

  .barcode-label {
    width: 33mm;
    height: 15mm;
    padding: 0.5mm;
  }

  .item-name {
    font-size: 5px;
  }

  .item-size {
    font-size: 4px;
  }

  .label-footer {
    font-size: 3px;
  }

  .barcode-svg {
    width: 90%;
  }
}
</style>
