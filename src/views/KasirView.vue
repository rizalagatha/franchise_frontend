<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import type { VDataTableHeaders } from 'vuetify/components';
import { format, subDays } from 'date-fns';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import PrintOptionModal from '@/components/PrintOptionModal.vue';
import KasirPrintPreviewModal from '@/components/KasirPrintPreviewModal.vue';
import InvoiceA4PrintPreviewModal from '@/components/InvoiceA4PrintPreviewModal.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import * as XLSX from 'xlsx';
import { formatRupiah } from '@/utils/formatRupiah';

// Store & Konfigurasi
const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();
const MENU_ID = '31';

// Interface Data
interface InvoiceHeader {
  Nomor: string;
  Tanggal: string;
  Kdcus: string;      // Kode Customer
  Nama: string;       // Nama Customer
  Alamat: string;
  Kota: string;
  Telp: string;
  Diskon: number;
  Biayakirim: number;
  Nominal: number;    // Total Netto
  Piutang: number;
  Bayar: number;
  SisaPiutang: number;
  RpTunai: number;
  RpCard: number;
  NoSetoran: string;
  NoRekening: string;
  NamaBank: string;
  UserCreate: string; // User Create
  DateCreate: string; // Date Create
}

interface InvoiceDetail {
  Kode: string;
  Nama: string;
  Ukuran: string;
  Jumlah: number;
  Harga: number;
  Diskon: number;
  Total: number;
}

// --- State ---
const headersData = ref<InvoiceHeader[]>([]);
const detailsData = ref<Record<string, InvoiceDetail[]>>({});
const selected = ref<InvoiceHeader[]>([]);
const isLoadingHeaders = ref(true);
const loadingDetails = ref<Set<string>>(new Set());
const expanded = ref<InvoiceHeader[]>([]);
const search = ref('');
const isPrintOptionVisible = ref(false);
const isKasirPreviewVisible = ref(false);
const selectedInvoice = ref<string | null>(null);
const isA4PreviewVisible = ref(false);

// Filter Tanggal
const startDate = ref(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));

// Hak Akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete'));
const isSingleSelected = computed(() => selected.value.length === 1);

// Formatters
const formatCurrency = (value: any) => formatRupiah(value);
const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value);

// Table Headers
const masterHeaders: VDataTableHeaders = [
  { title: 'Nomor', key: 'Nomor', width: '150px', fixed: true },
  { title: 'Tanggal', key: 'Tanggal', width: '110px' },
  { title: 'Kd Cus', key: 'Kdcus', width: '100px' },
  { title: 'Customer', key: 'Nama', minWidth: '200px' },
  { title: 'Alamat', key: 'Alamat', minWidth: '250px' },
  { title: 'Kota', key: 'Kota', width: '120px' },
  { title: 'Telp', key: 'Telp', width: '120px' },
  { title: 'Diskon', key: 'Diskon', align: 'end', width: '110px' },
  { title: 'Biaya Kirim', key: 'Biayakirim', align: 'end', width: '110px' },
  { title: 'Nominal', key: 'Nominal', align: 'end', width: '130px' },
  { title: 'Piutang', key: 'Piutang', align: 'end', width: '130px' },
  { title: 'Bayar', key: 'Bayar', align: 'end', width: '130px' },
  { title: 'Sisa Piutang', key: 'SisaPiutang', align: 'end', width: '130px' },
  { title: 'Rp Tunai', key: 'RpTunai', align: 'end', width: '110px' },
  { title: 'Rp Card', key: 'RpCard', align: 'end', width: '110px' },
  { title: 'No Setoran', key: 'NoSetoran', width: '150px' },
  { title: 'No Rekening', key: 'NoRekening', width: '150px' },
  { title: 'Bank', key: 'NamaBank', width: '120px' },
  { title: 'User Create', key: 'UserCreate', width: '120px' },
  { title: 'Date Create', key: 'DateCreate', width: '150px' },
  { title: '', key: 'data-table-expand', width: '40px', align: 'end' },
];

const detailHeaders: VDataTableHeaders = [
  { title: 'Kode', key: 'Kode', width: '120px' },
  { title: 'Nama Barang', key: 'Nama', minWidth: '250px' },
  { title: 'Ukuran', key: 'Ukuran', align: 'center', width: '80px' },
  { title: 'Qty', key: 'Jumlah', align: 'end', width: '70px' },
  { title: 'Harga', key: 'Harga', align: 'end', width: '110px' },
  { title: 'Total', key: 'Total', align: 'end', width: '120px' },
];

// --- Methods ---

const fetchHeadersData = async () => {
  isLoadingHeaders.value = true;
  try {
    const response = await api.get('/kasir', { params: { startDate: startDate.value, endDate: endDate.value } });
    headersData.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data kasir.');
  } finally {
    isLoadingHeaders.value = false;
  }
};

const fetchDetailsData = async (nomor: string) => {
  loadingDetails.value.add(nomor);
  try {
    const response = await api.get(`/kasir/${nomor}/details`);
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail ${nomor}`);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// Fungsi warna baris: Merah jika Sisa Piutang != 0
const getRowTextColor = (item: InvoiceHeader) => {
  return item.SisaPiutang > 0 ? 'text-error font-weight-bold' : '';
};

const getRowProps = ({ item }: any) => {
  if (item.SisaPiutang !== 0) {
    return { class: 'text-error font-weight-bold' };
  }
  return {};
};

const openPrintOptions = (nomor: string) => {
  // Pastikan nomor masuk ke state sebelum modal terbuka
  if (!nomor) return toast.error("Pilih invoice terlebih dahulu.");
  selectedInvoice.value = nomor;
  isPrintOptionVisible.value = true;
};

const handlePrintSelection = (type: 'a4' | 'kasir' | 'wa') => {
  if (!selectedInvoice.value) return;

  if (type === 'a4') {
    // SEKARANG: Buka modal preview, bukan window.open
    isA4PreviewVisible.value = true;
  } else if (type === 'kasir') {
    isKasirPreviewVisible.value = true;
  }
};

/**
 * Fungsi utama untuk memuat detail (loadDetails)
 * Dipicu oleh event @update:expanded pada v-data-table
 */
const loadDetails = async (newlyExpanded: any[]) => {
  if (newlyExpanded.length === 0) return;

  // Ambil item terakhir yang dibuka
  const lastItem = newlyExpanded[newlyExpanded.length - 1];

  // Deteksi: Apakah lastItem itu objek atau langsung string Nomor?
  const nomor = typeof lastItem === 'object' ? lastItem.Nomor : lastItem;

  if (!nomor) {
    console.error("Gagal mendapatkan Nomor Invoice. Cek item-value di v-data-table.");
    return;
  }

  // Jika sudah ada datanya atau sedang loading, abaikan
  if (detailsData.value[nomor] || loadingDetails.value.has(nomor)) return;

  loadingDetails.value.add(nomor);
  try {
    const response = await api.get(`/kasir/${nomor}/details`);
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail ${nomor}`);
    detailsData.value[nomor] = [];
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// Navigasi & Action
const openNewForm = () => router.push({ name: 'KasirBaru' });
const openEditForm = () => {
  if (selected.value.length > 0) {
    router.push({
      name: 'KasirUbah',
      params: { nomor: selected.value[0].Nomor }
    });
  }
};

const exportHeader = () => {
  const worksheet = XLSX.utils.json_to_sheet(headersData.value);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoice");
  XLSX.writeFile(workbook, "Export_Invoice_Header.xlsx");
};

onMounted(() => { if (hasViewPermission.value) fetchHeadersData(); });
</script>

<template>
  <PageLayout title="Kasir / Invoice" :menu-id="MENU_ID" icon="mdi-cash-register">
    <template #header-actions>
      <v-btn v-if="canInsert" size="small" color="primary" @click="openNewForm" prepend-icon="mdi-plus">Baru</v-btn>
      <v-btn v-if="canEdit" size="small" :disabled="!isSingleSelected" @click="openEditForm"
        prepend-icon="mdi-pencil">Ubah</v-btn>
      <v-btn v-if="canDelete" size="small" color="error" :disabled="!isSingleSelected"
        prepend-icon="mdi-delete">Hapus</v-btn>
      <v-btn v-if="hasViewPermission" size="small" color="green" :disabled="!isSingleSelected"
        prepend-icon="mdi-printer" @click="openPrintOptions(selected[0]?.Nomor)">
        Cetak
      </v-btn>
      <v-menu offset-y>
        <template v-slot:activator="{ props }">
          <v-btn size="small" color="green" prepend-icon="mdi-file-excel" v-bind="props">Export</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item @click="exportHeader"><v-list-item-title>Export Header</v-list-item-title></v-list-item>
        </v-list>
      </v-menu>
    </template>

    <div v-if="hasViewPermission" class="browse-content">
      <div class="filter-section d-flex align-center mb-4">
        <v-text-field v-model="startDate" type="date" label="Mulai" density="compact" variant="outlined" hide-details
          class="mr-2" style="max-width: 180px"></v-text-field>
        <v-text-field v-model="endDate" type="date" label="Sampai" density="compact" variant="outlined" hide-details
          class="mr-2" style="max-width: 180px"></v-text-field>
        <v-text-field v-model="search" label="Cari Nomor / Nama..." density="compact" variant="outlined" hide-details
          prepend-inner-icon="mdi-magnify"></v-text-field>
        <v-btn @click="fetchHeadersData" icon="mdi-refresh" variant="text" class="ml-2"></v-btn>
      </div>

      <div class="table-container">
        <v-data-table v-model="selected" v-model:expanded="expanded" :headers="masterHeaders" :items="headersData"
          :search="search" :loading="isLoadingHeaders" :row-props="getRowProps" item-value="Nomor" show-select
          show-expand return-object select-strategy="single" density="compact" fixed-header
          class="desktop-table fill-height-table" @update:expanded="loadDetails"
          :item-props="(item) => ({ class: getRowTextColor(item) })">
          <template #[`item.Tanggal`]="{ value }">
            {{ value ? format(new Date(value), 'dd/MM/yyyy') : '-' }}
          </template>

          <template #[`item.DateCreate`]="{ value }">
            {{ value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : '-' }}
          </template>

          <template
            v-for="col in ['Diskon', 'BiayaKirim', 'Nominal', 'Piutang', 'Bayar', 'SisaPiutang', 'RpTunai', 'RpCard']"
            :key="col" #[`item.${col}`]="{ value }">
            {{ formatCurrency(value) }}
          </template>

          <template #[`item.SisaPiutang`]="{ value }">
            <span :class="value > 0 ? 'text-error font-weight-bold' : ''">
              {{ formatCurrency(value) }}
            </span>
          </template>

          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="expanded-detail-cell">
                <div class="detail-container">
                  <div class="detail-table-wrapper">
                    <v-data-table v-if="detailsData[item.Nomor]" :headers="detailHeaders"
                      :items="detailsData[item.Nomor]" density="compact" hide-default-footer class="inner-detail-table">
                      <template #[`item.Harga`]="{ value }">{{ formatCurrency(value) }}</template>
                      <template #[`item.Total`]="{ value }">{{ formatCurrency(value) }}</template>
                    </v-data-table>

                    <v-progress-linear v-else indeterminate color="primary" height="2"></v-progress-linear>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </div>

    <PrintOptionModal v-model="isPrintOptionVisible" :options="['a4', 'kasir']" @select="handlePrintSelection" />

    <KasirPrintPreviewModal v-model="isKasirPreviewVisible" :nomor-invoice="selectedInvoice"
      @close="isKasirPreviewVisible = false" />

    <InvoiceA4PrintPreviewModal v-model="isA4PreviewVisible" :nomorInvoice="selectedInvoice" />
  </PageLayout>
</template>

<style scoped>
/* 6. Terapkan font 11px secara global pada tabel */
.desktop-table :deep(*) {
  font-size: 11px !important;
}

.browse-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.table-container {
  flex-grow: 1;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.expanded-detail-cell {
  padding: 0 !important;
  background-color: #f8f9fa;
}

.detail-container {
  padding: 8px 16px 8px 50px;
}

.detail-table-wrapper {
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  overflow: hidden;
}
</style>
