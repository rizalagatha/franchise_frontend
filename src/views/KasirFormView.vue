<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import CustomerSearchModal from '@/components/lookup/CustomerSearchModal.vue';
import BankSearchModal from '@/components/lookup/BankSearchModal.vue';
import ItemLookupModal from '@/components/lookup/ItemLookupModal.vue';
import PaymentModal from '@/components/PaymentModal.vue';
import KasirPrintPreviewModal from '@/components/KasirPrintPreviewModal.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import type { AxiosError } from 'axios';

// Store & composables
const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '31'; // Menu Kasir

interface InvoiceItem {
  id: number;
  kode: string;
  barcode: string;
  nama: string;
  ukuran: string;
  stok: number;
  jumlah: number | null;
  harga: number | null;
  hpp: number;
  diskon: number | null;
  total: number;
}

type TableHeader = {
  title: string
  key: string
  width?: string
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
}

const isEditMode = computed(() => !!route.params.nomor);
const pageTitle = computed(() => isEditMode.value ? 'Ubah Invoice' : 'Kasir Baru / Input Invoice');
const requiredPermission = computed(() => isEditMode.value ? 'edit' : 'insert');

// State Header Form
const formHeader = ref({
  nomor: '',
  tanggal: format(new Date(), 'yyyy-MM-dd'),
  kdCus: '',
  namaCus: '',
  diskonGlobal: 0,
  biayaKirim: 0,
  rpTunai: 0,
  rpCard: 0,
  noRek: '',
  namaBank: '',
  pundiAmal: 0,
  kembalian: 0,
  keterangan: '',
});

// State Pendukung
const items = ref<InvoiceItem[]>([]);
const customers = ref<any[]>([]);
const banks = ref<any[]>([]);
const nextItemId = ref(1);
const isLoading = ref(true);
const isSaving = ref(false);
const isLookupLoading = ref(false);
const scanBarcode = ref('');
const showCustomerModal = ref(false);
const showBankModal = ref(false);
const isItemLookupVisible = ref(false);
const isConfirmDialogVisible = ref(false);
const confirmText = ref('Yakin ingin menyimpan data invoice ini?');
const showPaymentModal = ref(false);
const showPrintModal = ref(false);
const savedInvoiceNomor = ref('');
const confirmTitle = ref('Konfirmasi');
const isConfirmOnly = ref(false); // Jika true, hanya muncul tombol OK (mode warning)

// Header Tabel Detail
const tableHeaders: TableHeader[] = [
  { title: '#', key: 'no', sortable: false, width: '40px' },
  { title: 'Barcode', key: 'barcode', width: '130px' },
  { title: 'Nama Barang', key: 'nama', width: '300px' },
  { title: 'Size', key: 'ukuran', align: 'center', width: '80px' },
  { title: 'Stok', key: 'stok', align: 'end', width: '80px' },
  { title: 'Qty', key: 'jumlah', align: 'end', width: '100px' },
  { title: 'Harga', key: 'harga', align: 'end', width: '120px' },
  { title: 'Disc', key: 'diskon', align: 'end', width: '100px' },
  { title: 'Total', key: 'total', align: 'end', width: '130px' },
  { title: '', key: 'actions', sortable: false, width: '50px', align: 'center' },
];

// Perhitungan Totals
const subTotal = computed(() => {
  return items.value.reduce((acc, item) => acc + (item.total || 0), 0);
});

const grandTotal = computed(() => {
  return subTotal.value - (formHeader.value.diskonGlobal || 0) + (formHeader.value.biayaKirim || 0);
});

const sisaPiutang = computed(() => {
  const bayar = (formHeader.value.rpTunai || 0) + (formHeader.value.rpCard || 0);
  const sisa = grandTotal.value - bayar;
  return sisa > 0 ? sisa : 0;
});

const kembalian = computed(() => {
  const bayar = (formHeader.value.rpTunai || 0) + (formHeader.value.rpCard || 0);
  const sisa = bayar - grandTotal.value;
  return sisa > 0 ? sisa : 0;
});

const calculateItemTotal = (item: InvoiceItem) => {
  const qty = item.jumlah || 0;
  const harga = item.harga || 0;
  const disc = item.diskon || 0;
  item.total = qty * (harga - disc);
};

watch(items, () => {
  items.value.forEach(calculateItemTotal);
}, { deep: true });

// Formatters
const formatCurrency = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const handleGlobalKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'F1') {
    event.preventDefault();

    // Tambahkan validasi customer di sini
    if (!formHeader.value.kdCus) {
      return toast.warning('Pilih customer dulu sebelum mencari barang.');
    }

    isItemLookupVisible.value = true;
  }
};

// Methods
const fetchInitialData = async () => {
  try {
    const [custRes, bankRes] = await Promise.all([
      api.get('/customers'),
      api.get('/rekening')
    ]);
    customers.value = custRes.data;
    banks.value = bankRes.data;
  } catch (error) {
    toast.error('Gagal memuat data pendukung.');
  }
};

const onScanBarcode = async () => {
  if (!scanBarcode.value.trim() || isLookupLoading.value) return;
  if (!formHeader.value.kdCus) {
    toast.warning('Pilih customer dulu!');
    scanBarcode.value = '';
    return;
  }
  const barcode = scanBarcode.value.trim();
  isLookupLoading.value = true;

  try {
    const existingItem = items.value.find(i => i.barcode === barcode);
    if (existingItem) {
      existingItem.jumlah = (existingItem.jumlah || 0) + 1;
      scanBarcode.value = '';
      return;
    }

    const response = await api.get(`/pembelian/lookup/barcode/${barcode}`); // Gunakan lookup barcode yang sudah ada
    const res = response.data;

    items.value.unshift({
      id: nextItemId.value++,
      kode: res.kode,
      barcode: res.barcode,
      nama: res.nama,
      ukuran: res.ukuran,
      stok: res.stok || 0,
      jumlah: 1,
      harga: res.jual,
      hpp: res.hpp || 0,
      diskon: 0,
      total: res.jual,
    });
    scanBarcode.value = '';
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Barcode tidak ditemukan.');
  } finally {
    isLookupLoading.value = false;
  }
};

// --- Handler saat item dipilih dari modal F1 ---
const onItemSelected = (selectedItem: any) => {
  // Samakan property dari modal (kode, nama, barcode, hpp, harga)
  // ke structure items kasir
  const existing = items.value.find(i => i.barcode === selectedItem.barcode || i.kode === selectedItem.kode);

  if (existing) {
    existing.jumlah = (existing.jumlah ?? 0) + 1;
    toast.info(`Jumlah ${selectedItem.nama} ditambah.`);
  } else {
    items.value.unshift({
      id: nextItemId.value++,
      kode: selectedItem.kode,
      barcode: selectedItem.barcode || '',
      nama: selectedItem.nama,
      ukuran: selectedItem.ukuran || '',
      stok: selectedItem.stok || 0,
      jumlah: 1,
      harga: selectedItem.harga || selectedItem.hpp || 0, // Fallback ke HPP jika harga jual null
      hpp: selectedItem.hpp || 0,
      diskon: 0,
      total: selectedItem.harga || selectedItem.hpp || 0
    });
    toast.success(`${selectedItem.nama} ditambahkan.`);
  }
};

const removeItem = (id: number) => {
  items.value = items.value.filter(i => i.id !== id);
};

const save = () => {
  if (items.value.length === 0) return toast.error('Detail barang kosong.');
  if (!formHeader.value.kdCus) return toast.error('Customer harus dipilih.');

  // Validasi pembayaran
  if (formHeader.value.rpTunai === 0 && formHeader.value.rpCard === 0) {
    toast.warning("Pembayaran masih kosong. Akan tercatat sebagai Piutang Penuh.");
  }

  isConfirmDialogVisible.value = true;
};

// Eksekusi simpan yang sebenarnya
const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      // Kirim item yang qty-nya > 0 saja
      items: items.value.filter(item => (item.jumlah || 0) > 0),
      isNew: !isEditMode.value
    };

    // Eksekusi API Simpan
    const response = await api.post('/kasir/save', payload);

    // Simpan nomor invoice yang baru saja di-generate untuk keperluan cetak
    savedInvoiceNomor.value = response.data.nomor;
    toast.success(response.data.message || 'Invoice berhasil disimpan.');

    // Tutup dialog konfirmasi dan modal pembayaran
    isConfirmDialogVisible.value = false;
    showPaymentModal.value = false;

    // Transisi: Tunggu render DOM selesai lalu buka modal print
    await nextTick();
    showPrintModal.value = true;

  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Gagal menyimpan invoice.');
  } finally {
    isSaving.value = false;
  }
};

const onCustomerSelected = (customer: any) => {
  // customer berisi properti dengan huruf kapital sesuai alias SQL
  formHeader.value.kdCus = customer.Kode;
  formHeader.value.namaCus = customer.Nama; // Tampilkan nama di text-field
};

const onBankSelected = (bank: any) => {
  // Pastikan mengambil properti yang benar dari objek
  formHeader.value.noRek = bank.NoRekening;
  formHeader.value.namaBank = bank.NamaBank; // String, bukan Object
};

const openPayment = () => {
  if (items.value.length === 0) return toast.error('Barang masih kosong!');
  if (!formHeader.value.kdCus) return toast.error('Pilih customer dulu!');

  // --- VALIDASI STOK (DELPHI LOGIC) ---
  const overStockItem = items.value.find(item => (item.jumlah || 0) > item.stok);
  if (overStockItem) {
    return toast.error(`Stok tidak cukup untuk: ${overStockItem.nama} (${overStockItem.ukuran}). Sisa stok: ${overStockItem.stok}`);
  }
  // ------------------------------------

  showPaymentModal.value = true;
};

const handleFinalSave = async (paymentData: any) => {
  // 1. Ambil variabel untuk validasi
  const gtot = grandTotal.value;
  const bayar = (paymentData.rpTunai || 0) + (paymentData.rpCard || 0);
  const rpCard = paymentData.rpCard || 0;
  const noRek = paymentData.noRek || '';

  // 2. Mapping data ke state formHeader agar siap saat executeSave dipanggil
  formHeader.value.rpTunai = paymentData.rpTunai;
  formHeader.value.rpCard = paymentData.rpCard;
  formHeader.value.noRek = paymentData.noRek;

  formHeader.value.pundiAmal = paymentData.pundiAmal; // Nilai receh (misal: 500)
  formHeader.value.kembalian = paymentData.kembalian; // Nilai netto kembali (misal: 5.000)

  // 3. Validasi No. Rekening (Mode Peringatan/mtWarning)
  if (rpCard !== 0 && (!noRek || noRek.trim() === '')) {
    confirmTitle.value = 'Peringatan';
    confirmText.value = 'No. Rekening harus diisi.';
    isConfirmOnly.value = true; // Hanya tombol OK yang muncul
    isConfirmDialogVisible.value = true;
    return;
  }

  // 4. Logika Konfirmasi Simpan (Mode Konfirmasi/MessageDlg)
  isConfirmOnly.value = false; // Muncul tombol Ya/Tidak

  if (bayar !== 0 && bayar < gtot) {
    // Jika bayar kurang dari total
    confirmTitle.value = 'Konfirmasi Pembayaran';
    confirmText.value = 'Total bayar kurang. Akan tetap disimpan?';
  } else {
    // Jika bayar cukup atau pas
    confirmTitle.value = 'Konfirmasi Simpan';
    confirmText.value = 'Akan disimpan?';
  }

  isConfirmDialogVisible.value = true;
};

const onPrintModalClosed = () => {
  showPrintModal.value = false;
  router.push('/transaksi/kasir'); // Kembali ke browse setelah selesai cetak
};

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeyDown);
  await fetchInitialData();
  if (isEditMode.value) {
    // Logic load data edit di sini
  } else {
    isLoading.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown);
});
</script>

<template>
  <PageLayout title="Kasir Baru / Input Invoice" desktop-mode icon="mdi-cash-register">
    <template #header-actions>
      <div class="text-caption text-grey mr-4 d-flex align-center">
        <v-kbd>F1</v-kbd> <span class="ml-1">Cari Barang</span>
      </div>
      <v-btn color="primary" @click="openPayment" prepend-icon="mdi-cash-multiple">Bayar & Simpan</v-btn>
      <v-btn variant="outlined" @click="router.back()">Tutup</v-btn>
    </template>

    <div class="kasir-wrapper">
      <aside class="left-panel">
        <div class="desktop-form-section header-section mb-3">
          <v-text-field v-model="formHeader.nomor" label="Nomor Invoice" readonly density="compact" hide-details
            variant="filled" class="mb-2" />
          <v-text-field v-model="formHeader.tanggal" label="Tanggal" type="date" density="compact" hide-details
            variant="outlined" class="mb-2" />
          <v-text-field v-model="formHeader.namaCus" label="Customer" readonly density="compact" hide-details
            variant="outlined" prepend-inner-icon="mdi-account" append-inner-icon="mdi-magnify"
            @click="showCustomerModal = true" class="clickable-input" />
        </div>

        <v-card color="grey-lighten-4" class="rounded-lg pa-4 border shadow-none">
          <div class="summary-line"><span>Subtotal</span> <span>{{ formatCurrency(subTotal) }}</span></div>
          <div class="summary-line"><span>Diskon</span> <v-text-field v-model.number="formHeader.diskonGlobal"
              type="number" density="compact" hide-details variant="underlined" class="small-input" /></div>
          <div class="summary-line mb-3"><span>Biaya Kirim</span> <v-text-field v-model.number="formHeader.biayaKirim"
              type="number" density="compact" hide-details variant="underlined" class="small-input" /></div>
          <v-divider class="my-2"></v-divider>
          <div class="d-flex justify-space-between text-h5 font-weight-black text-primary total-text">
            <span>TOTAL</span> <span>{{ formatCurrency(grandTotal) }}</span>
          </div>
        </v-card>
      </aside>

      <main class="main-panel">
        <v-card variant="outlined" class="mb-3 rounded-lg border-primary border-opacity-50 bg-blue-lighten-5">
          <div class="d-flex align-center">
            <v-text-field v-model="scanBarcode" placeholder="Scan barcode di sini... (F1 untuk bantuan)"
              prepend-inner-icon="mdi-barcode-scan" variant="plain" hide-details
              class="px-4 py-1 barcode-scanner flex-grow-1" autofocus @keyup.enter="onScanBarcode" />
            <v-btn variant="text" color="primary" icon="mdi-text-search" @click="() => {
              if (!formHeader.value.kdCus) {
                toast.warning('Pilih customer dulu sebelum mencari barang.');
              } else {
                isItemLookupVisible = true;
              }
            }"></v-btn>
          </div>
        </v-card>

        <v-card variant="outlined" class="rounded-lg flex-grow-1 overflow-hidden">
          <v-data-table :headers="tableHeaders" :items="items" density="compact" class="fill-height-table" fixed-header
            :items-per-page="-1">
            <template #[`item.no`]="{ index }">{{ index + 1 }}</template>
            <template #[`item.stok`]="{ item }">
              <div :class="(item.stok - (item.jumlah || 0)) < 0 ? 'text-error font-weight-bold' : ''">
                {{ item.stok }}
              </div>
            </template>
            <template #[`item.jumlah`]="{ item }">
              <v-text-field v-model.number="item.jumlah" type="number" variant="underlined" density="compact"
                hide-details class="text-end" :color="(item.jumlah || 0) > item.stok ? 'error' : 'primary'" />
            </template>
            <template #[`item.harga`]="{ value }">{{ formatCurrency(value) }}</template>
            <template #[`item.diskon`]="{ item }"><v-text-field v-model.number="item.diskon" type="number"
                variant="underlined" density="compact" hide-details class="text-end" /></template>
            <template #[`item.total`]="{ item }"><span class="font-weight-bold">{{ formatCurrency((item.jumlah ?? 0) *
              ((item.harga ?? 0) - (item.diskon ?? 0))) }}</span></template>
            <template #[`item.actions`]="{ item }"><v-icon size="small" color="error"
                @click="items = items.filter(i => i.id !== item.id)">mdi-delete</v-icon></template>
            <template #bottom></template>
          </v-data-table>
        </v-card>
      </main>
    </div>

    <CustomerSearchModal v-model="showCustomerModal" @customer-selected="onCustomerSelected" />
    <BankSearchModal v-model="showBankModal" @bank-selected="onBankSelected" />
    <ItemLookupModal v-model="isItemLookupVisible" source="kasir" @item-selected="onItemSelected" />
    <PaymentModal v-model="showPaymentModal" :total-invoice="grandTotal" @confirm-payment="handleFinalSave" />
    <KasirPrintPreviewModal v-model="showPrintModal" :nomor-invoice="savedInvoiceNomor"
      @update:modelValue="(val) => !val && onPrintModalClosed()" />

    <v-dialog v-model="isConfirmDialogVisible" max-width="400px" persistent>
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 font-weight-bold d-flex align-center pa-4">
          <v-icon :color="isConfirmOnly ? 'warning' : 'primary'" class="mr-2">
            {{ isConfirmOnly ? 'mdi-alert-circle' : 'mdi-help-circle' }}
          </v-icon>
          {{ confirmTitle }}
        </v-card-title>

        <v-card-text class="pa-4 pt-0">{{ confirmText }}</v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>

          <v-btn v-if="isConfirmOnly" color="primary" variant="elevated"
            @click="isConfirmDialogVisible = false">OK</v-btn>

          <template v-else>
            <v-btn variant="text" @click="isConfirmDialogVisible = false" :disabled="isSaving">Tidak</v-btn>
            <v-btn color="primary" variant="elevated" @click="executeSave" :loading="isSaving">Ya, Simpan</v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </PageLayout>
</template>

<style scoped>
.kasir-wrapper :deep(*) {
  font-size: 11px !important;
}

.total-text :deep(span) {
  font-size: 18px !important;
}

.kasir-wrapper {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 12px;
  padding: 12px;
  height: calc(100vh - 100px);
  background: #fcfcfc;
}

.left-panel {
  display: flex;
  flex-direction: column;
}

.main-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.desktop-form-section {
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
}

.clickable-input :deep(input) {
  cursor: pointer !important;
}

.barcode-scanner :deep(input) {
  font-size: 12px !important;
  font-weight: bold;
  color: #1976D2;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.small-input {
  max-width: 90px;
}

.small-input :deep(input) {
  text-align: right;
  padding: 0;
}
</style>
