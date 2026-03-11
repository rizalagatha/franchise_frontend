<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { VDataTableHeaders } from 'vuetify/components';
import { format, subDays } from 'date-fns';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import { formatRupiah } from '@/utils/formatRupiah';
import SetoranPembayaranPrintModal from '@/components/SetoranPembayaranPrintModal.vue';

const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();
const MENU_ID = '33';

// --- State ---
const masterData = ref<any[]>([]);
const detailsData = ref<Record<string, any[]>>({});
const selected = ref<any[]>([]);
const expanded = ref<string[]>([]);
const isLoading = ref(true);
const search = ref('');
const showPrintModal = ref(false);
const printNomor = ref('');

const startDate = ref(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));

// Hak Akses
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete'));
const isSingleSelected = computed(() => selected.value && selected.value.length === 1);

// Logika Bisnis: Data otomatis tidak boleh diubah/hapus
const isSelectedOtomatis = computed(() => {
  const item = selected.value?.[0];
  if (!item) return false;
  // Cek jika item adalah objek (Otomatis) atau cari di masterData jika item hanya string Nomor
  const fullItem = typeof item === 'object' ? item : masterData.value.find(d => d.Nomor === item);
  return fullItem?.Otomatis === 'YA';
});

const masterHeaders: any[] = [
  { title: 'Nomor', key: 'Nomor', width: '150px', fixed: true },
  { title: 'Tanggal', key: 'Tanggal', width: '100px' },
  { title: 'Jenis', key: 'JenisBayar', width: '100px' },
  { title: 'Nominal', key: 'Nominal', align: 'end', width: '120px' },
  { title: 'Dibayar', key: 'diBayarkan', align: 'end', width: '120px' },
  { title: 'Sisa', key: 'Sisa', align: 'end', width: '120px' },
  { title: 'Customer', key: 'Customer', minWidth: '200px' },
  { title: 'Bank', key: 'NamaBank', width: '120px' },
  { title: 'Otomatis', key: 'Otomatis', width: '80px', align: 'center' },
  { title: '', key: 'data-table-expand' },
];

// --- Methods ---

const fetchData = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/setoran-pembayaran', {
      params: { startDate: startDate.value, endDate: endDate.value }
    });
    masterData.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data setoran.');
  } finally {
    isLoading.value = false;
  }
};

const fetchDetails = async (payload: any) => {
  // 1. Guard clause: Jika payload kosong, batalkan
  if (!payload) return;

  // 2. Ekstrak nomor dengan sangat aman menggunakan Optional Chaining (?.)
  // Vuetify bisa saja mengirim: String, Object Mentah (payload.Nomor), atau Wrapper (payload.raw.Nomor)
  const nomor = typeof payload === 'string'
    ? payload
    : (payload?.raw?.Nomor || payload?.Nomor);

  // 3. Guard clause: Jika nomor tidak ditemukan atau rincian sudah ada, batalkan
  if (!nomor || detailsData.value[nomor]) return;

  try {
    const res = await api.get(`/setoran-pembayaran/${nomor}/details`);
    detailsData.value[nomor] = res.data;
  } catch (error) {
    toast.error(`Gagal memuat rincian untuk ${nomor}`);
  }
};

// Logika Pewarnaan Baris
const getRowTextColor = (item: any) => {
  if (item.Otomatis === 'YA') return 'text-blue-darken-2 font-weight-bold'; // Biru jika otomatis
  if (Number(item.Sisa) !== 0) return 'text-red-darken-2'; // Merah jika belum lunas
  return '';
};

// Fungsi ini yang akan disuntikkan ke tabel untuk mengatur kelas (warna) tiap baris
const myRowProps = (data: any) => {
  // Ambil data mentah dengan aman
  const rawItem = data.item?.raw || data.item;
  return {
    class: getRowTextColor(rawItem),
    style: 'cursor: pointer' // Biar kursor jadi tangan saat di-hover
  };
};

// Fungsi agar saat baris di-klik (bukan cuma checkbox-nya), baris langsung terpilih
const handleRowClick = (event: any, { item }: any) => {
  const raw = item?.raw || item;
  // Karena select-strategy="single", kita atur array-nya
  if (selected.value.length > 0 && selected.value[0]?.Nomor === raw.Nomor) {
    selected.value = []; // Hilangkan centang jika di-klik lagi
  } else {
    selected.value = [raw]; // Centang baris
  }
};

const handleEdit = () => {
  // Gunakan optional chaining untuk keamanan
  const item = selected.value?.[0];

  if (item && item.Nomor) {
    console.log("Navigasi ke:", item.Nomor);
    router.push(`/transaksi/setoran-pembayaran/ubah/${item.Nomor}`);
  } else {
    toast.warning("Silakan pilih baris terlebih dahulu.");
  }
};

const handlePrint = () => {
  const item = selected.value?.[0];
  const nomor = typeof item === 'object' ? item?.Nomor : item;

  if (nomor) {
    printNomor.value = nomor;
    showPrintModal.value = true;
  } else {
    toast.warning('Pilih satu data setoran untuk dicetak.');
  }
};

// Update handleDelete agar lebih aman
const handleDelete = async () => {
  const selectedItem = selected.value?.[0];
  if (!selectedItem) return;

  if (isSelectedOtomatis.value) {
    return toast.warning('Setoran Otomatis tidak bisa dihapus.');
  }

  if (confirm(`Yakin hapus setoran ${selectedItem.Nomor}?`)) {
    try {
      await api.delete(`/setoran-pembayaran/${selectedItem.Nomor}`);
      toast.success('Data dihapus.');
      fetchData();
      selected.value = [];
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal hapus.');
    }
  }
};

const handleExport = () => {
  // Logika export excel/csv
  toast.info('Fitur export sedang disiapkan.');
};

onMounted(fetchData);
</script>

<template>
  <PageLayout title="Setoran Pembayaran" :menu-id="MENU_ID" icon="mdi-cash-register">
    <template #header-actions>
      <v-btn v-if="canInsert" size="small" color="primary" prepend-icon="mdi-plus"
        @click="router.push('/transaksi/setoran-pembayaran/baru')">Baru</v-btn>

      <v-btn v-if="canEdit" size="small" :disabled="!isSingleSelected || isSelectedOtomatis" prepend-icon="mdi-pencil"
        @click="handleEdit">Ubah</v-btn>

      <v-btn v-if="canDelete" size="small" color="error" :disabled="!isSingleSelected || isSelectedOtomatis"
        prepend-icon="mdi-delete" @click="handleDelete">Hapus</v-btn>

      <v-btn size="small" color="secondary" :disabled="!isSingleSelected" prepend-icon="mdi-printer"
        @click="handlePrint">Cetak</v-btn>

      <v-btn size="small" variant="outlined" prepend-icon="mdi-file-export" @click="handleExport">Export</v-btn>
    </template>

    <div class="browse-content">
      <div class="filter-section d-flex align-center mb-4">
        <v-text-field v-model="startDate" type="date" label="Mulai" density="compact" variant="outlined" hide-details
          class="mr-2" style="max-width: 160px" />
        <v-text-field v-model="endDate" type="date" label="Sampai" density="compact" variant="outlined" hide-details
          class="mr-2" style="max-width: 160px" />
        <v-text-field v-model="search" label="Cari..." density="compact" variant="outlined" hide-details
          prepend-inner-icon="mdi-magnify" />
        <v-btn @click="fetchData" icon="mdi-refresh" variant="text" class="ml-2" :loading="isLoading" />
      </div>

      <div class="table-container">
        <v-data-table v-model="selected" v-model:expanded="expanded" :headers="masterHeaders" :items="masterData"
          :search="search" :loading="isLoading" item-value="Nomor" select-strategy="single" return-object show-select
          show-expand density="compact" fixed-header class="desktop-table fill-height-table" :row-props="myRowProps"
          @click:row="handleRowClick" @update:expanded="(val) => {
            if (val && val.length > 0) {
              fetchDetails(val[val.length - 1]);
            }
          }">

          <template #[`item.Tanggal`]="{ item }">
            {{ item.raw?.Tanggal ? format(new Date(item.raw.Tanggal), 'dd/MM/yyyy') : '-' }}
          </template>

          <template #[`item.Nominal`]="{ item }">
            {{ formatRupiah(item.raw?.Nominal) }}
          </template>

          <template #[`item.diBayarkan`]="{ item }">
            {{ formatRupiah(item.raw?.diBayarkan) }}
          </template>

          <template #[`item.Sisa`]="{ item }">
            {{ formatRupiah(item.raw?.Sisa) }}
          </template>

          <template #[`item.NamaBank`]="{ item }">
            {{ item.raw?.NamaBank || '-' }}
          </template>

          <template #[`item.Otomatis`]="{ item }">
            <v-chip v-if="item.raw?.Otomatis === 'YA'" size="x-small" color="blue" variant="flat">OTOMATIS</v-chip>
          </template>

          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="bg-grey-lighten-4 pa-2">
                <v-card v-if="item?.raw?.Nomor" variant="outlined" density="compact" class="mx-4 my-2">
                  <v-data-table v-if="detailsData[item.raw.Nomor]" :items="detailsData[item.raw.Nomor]" :headers="[
                    { title: 'Inv. Bayar', key: 'Invoice' },
                    { title: 'Tgl Inv', key: 'TglInvoice' },
                    { title: 'Nominal Inv', key: 'Nominal', align: 'end' },
                    { title: 'Jumlah Bayar', key: 'Bayar', align: 'end' },
                    { title: 'Ket', key: 'Keterangan' }
                  ]" density="compact" hide-default-footer>
                    <template #[`item.TglInvoice`]="{ value }">
                      {{ value ? format(new Date(value), 'dd/MM/yy') : '-' }}
                    </template>
                    <template #[`item.Nominal`]="{ value }">{{ formatRupiah(value) }}</template>
                    <template #[`item.Bayar`]="{ value }">{{ formatRupiah(value) }}</template>
                  </v-data-table>

                  <v-progress-linear v-else indeterminate color="primary" height="2"></v-progress-linear>
                </v-card>
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </div>

    <SetoranPembayaranPrintModal v-model="showPrintModal" :nomor="printNomor" />

  </PageLayout>
</template>

<style scoped>
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
</style>
