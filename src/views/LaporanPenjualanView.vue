<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { format, subDays } from 'date-fns';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import * as XLSX from 'xlsx';
import { formatRupiah } from '@/utils/formatRupiah';
import CabangSearchModal from '@/components/lookup/CabangSearchModal.vue';

const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '52';

// --- State ---
const filterStartDate = ref(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
const filterEndDate = ref(format(new Date(), 'yyyy-MM-dd'));
const filterCabang = ref(authStore.user?.cabang || 'F03');
const namaCabang = ref(authStore.user?.cabangNama || 'KAOSAN.OFFICIAL');
const showCabangModal = ref(false);

// Pilihan Group By
const groupByOptions = [
  { title: 'Tanggal', value: 'tanggal' },
  { title: 'Invoice', value: 'invoice' },
  { title: 'Customer', value: 'customer' }
];
const selectedGroupBy = ref('tanggal');

const dataLaporan = ref<any[]>([]);
const isLoading = ref(false);
const search = ref('');

// Hak Akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));

// --- Dynamic Headers berdasarkan Group By ---
const headers = computed(() => {
  if (selectedGroupBy.value === 'tanggal') {
    return [
      { title: 'Kode Cabang', key: 'Kode', width: '100px' },
      { title: 'Tanggal', key: 'Tanggal', width: '120px' },
      { title: 'Nominal', key: 'Nominal', align: 'end' },
      { title: 'HPP', key: 'Hpp', align: 'end' },
      { title: 'Laba', key: 'Laba', align: 'end' },
      { title: 'Pundi Amal', key: 'PundiAmal', align: 'end', width: '120px' },
    ];
  } else if (selectedGroupBy.value === 'invoice') {
    return [
      { title: 'Kode Cabang', key: 'Kode', width: '100px' },
      { title: 'No. Invoice', key: 'Invoice', width: '150px' },
      { title: 'Tanggal', key: 'Tanggal', width: '100px' },
      { title: 'Kode Cus', key: 'KdCus', width: '100px' },
      { title: 'Nama Customer', key: 'Customer' },
      { title: 'Nominal', key: 'Nominal', align: 'end' },
      { title: 'HPP', key: 'Hpp', align: 'end' },
      { title: 'Laba', key: 'Laba', align: 'end' },
      { title: 'Pundi Amal', key: 'PundiAmal', align: 'end', width: '120px' },
    ];
  } else { // customer
    return [
      { title: 'Kode Cus', key: 'KdCus', width: '100px' },
      { title: 'Nama Customer', key: 'Nama' },
      { title: 'Alamat', key: 'Alamat' },
      { title: 'Kota', key: 'Kota', width: '120px' },
      { title: 'Nominal', key: 'Nominal', align: 'end' },
      { title: 'HPP', key: 'Hpp', align: 'end' },
      { title: 'Laba', key: 'Laba', align: 'end' },
      { title: 'Pundi Amal', key: 'PundiAmal', align: 'end', width: '120px' },
    ];
  }
});

// --- Summary / Total Footer ---
const totalNominal = computed(() => dataLaporan.value.reduce((sum, item) => sum + (Number(item.Nominal) || 0), 0));
const totalHpp = computed(() => dataLaporan.value.reduce((sum, item) => sum + (Number(item.Hpp) || 0), 0));
const totalLaba = computed(() => dataLaporan.value.reduce((sum, item) => sum + (Number(item.Laba) || 0), 0));
const totalPundiAmal = computed(() => dataLaporan.value.reduce((sum, item) => sum + (Number(item.PundiAmal) || 0), 0));

// --- Methods ---
const fetchData = async () => {
  if (!filterCabang.value) return toast.warning('Pilih cabang terlebih dahulu.');

  isLoading.value = true;
  dataLaporan.value = []; // Reset data
  try {
    const response = await api.get('/laporan-penjualan', {
      params: {
        startDate: filterStartDate.value,
        endDate: filterEndDate.value,
        cabang: filterCabang.value,
        groupBy: selectedGroupBy.value
      }
    });
    dataLaporan.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat laporan penjualan.');
  } finally {
    isLoading.value = false;
  }
};

const onCabangSelected = (cabang: any) => {
  filterCabang.value = cabang.Kode;
  namaCabang.value = cabang.Nama;
};

// Kosongkan data jika grup berubah, paksa user klik Refresh
watch(selectedGroupBy, () => {
  dataLaporan.value = [];
});

watch(
  [filterStartDate, filterEndDate, filterCabang, selectedGroupBy],
  ([newStart, newEnd, newCab, newGroup], [oldStart, oldEnd, oldCab, oldGroup]) => {
    // Pastikan fetchData hanya dipanggil jika nilai benar-benar berubah
    // dan variabel penting tidak kosong
    if (newCab && newGroup) {
      console.log('Filter berubah, menarik data otomatis...');
      fetchData();
    }
  },
  { deep: true }
);

const handleExport = () => {
  if (dataLaporan.value.length === 0) return toast.warning('Data kosong.');
  const worksheet = XLSX.utils.json_to_sheet(dataLaporan.value);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Penjualan");
  XLSX.writeFile(workbook, `Laporan_Penjualan_${selectedGroupBy.value}_${filterStartDate.value}.xlsx`);
};

onMounted(() => {
  if (hasViewPermission.value) fetchData();
});
</script>

<template>
  <PageLayout title="Laporan Penjualan (Invoice)" :menu-id="MENU_ID" icon="mdi-receipt-text-outline">
    <template #header-actions>
      <v-btn size="small" color="success" prepend-icon="mdi-file-excel" @click="handleExport"
        :disabled="dataLaporan.length === 0">Export</v-btn>
      <v-btn size="small" variant="outlined" prepend-icon="mdi-close" @click="$router.back()">Tutup</v-btn>
    </template>

    <div v-if="hasViewPermission" class="browse-content">
      <div class="filter-section d-flex align-center flex-wrap bg-grey-lighten-4 pa-2 rounded mb-3 border gap-2">
        <span class="text-caption font-weight-bold mr-2">Tgl Invoice</span>
        <v-text-field v-model="filterStartDate" type="date" density="compact" variant="outlined" hide-details
          class="mr-1 small-input" />
        <span class="text-caption mr-1">sd</span>
        <v-text-field v-model="filterEndDate" type="date" density="compact" variant="outlined" hide-details
          class="mr-4 small-input" />

        <span class="text-caption font-weight-bold mr-2">Perusahaan</span>
        <v-text-field v-model="filterCabang" density="compact" variant="outlined" hide-details readonly
          class="mr-1 micro-input bg-white" @keyup.f1="showCabangModal = true" />
        <v-btn icon="mdi-magnify" size="x-small" variant="tonal" color="primary" class="mr-1"
          @click="showCabangModal = true"></v-btn>
        <v-text-field v-model="namaCabang" density="compact" variant="outlined" hide-details readonly
          class="mr-4 medium-input bg-white" />

        <span class="text-caption font-weight-bold mr-2">Group By</span>
        <v-radio-group v-model="selectedGroupBy" inline hide-details density="compact" class="mr-4 group-by-radio">
          <v-radio v-for="opt in groupByOptions" :key="opt.value" :label="opt.title" :value="opt.value"
            color="primary"></v-radio>
        </v-radio-group>

        <v-spacer></v-spacer>

        <v-text-field v-model="search" label="Cari..." density="compact" variant="outlined" hide-details
          prepend-inner-icon="mdi-magnify" class="mr-2 search-input" />
        <v-btn @click="fetchData" color="primary" prepend-icon="mdi-refresh" :loading="isLoading"
          size="small">Refresh</v-btn>
      </div>

      <div class="table-container">
        <v-data-table :headers="headers" :items="dataLaporan" :search="search" :loading="isLoading" density="compact"
          fixed-header class="desktop-table fill-height-table" :items-per-page="50" hover>

          <template #item="{ item }">
            <tr>
              <td v-if="selectedGroupBy === 'tanggal' || selectedGroupBy === 'invoice'">{{ item.Kode }}</td>
              <td v-if="selectedGroupBy === 'invoice'">{{ item.Invoice }}</td>
              <td v-if="selectedGroupBy === 'tanggal' || selectedGroupBy === 'invoice'">{{ item.Tanggal }}</td>

              <td v-if="selectedGroupBy === 'customer' || selectedGroupBy === 'invoice'">{{ item.KdCus }}</td>
              <td v-if="selectedGroupBy === 'customer'">{{ item.Nama }}</td>
              <td v-if="selectedGroupBy === 'invoice'">{{ item.Customer }}</td>

              <td v-if="selectedGroupBy === 'customer'">{{ item.Alamat }}</td>
              <td v-if="selectedGroupBy === 'customer'">{{ item.Kota }}</td>

              <td class="text-right">{{ formatRupiah(item.Nominal) }}</td>
              <td class="text-right">{{ formatRupiah(item.Hpp) }}</td>
              <td class="text-right font-weight-bold" :class="item.Laba < 0 ? 'text-error' : 'text-success'">
                {{ formatRupiah(item.Laba) }}
              </td>
              <td class="text-right">{{ formatRupiah(item.PundiAmal) }}</td>
            </tr>
          </template>

          <template #tfoot v-if="dataLaporan.length > 0">
            <tfoot>
              <tr class="bg-grey-lighten-3 font-weight-bold text-primary">
                <td :colspan="selectedGroupBy === 'tanggal' ? 2 : (selectedGroupBy === 'invoice' ? 5 : 4)"
                  class="text-right">GRAND TOTAL</td>
                <td class="text-right">{{ formatRupiah(totalNominal) }}</td>
                <td class="text-right">{{ formatRupiah(totalHpp) }}</td>
                <td class="text-right" :class="totalLaba < 0 ? 'text-error' : 'text-success'">{{ formatRupiah(totalLaba)
                }}</td>
                <td class="text-right">{{ formatRupiah(totalPundiAmal) }}</td>
              </tr>
            </tfoot>
          </template>
        </v-data-table>
      </div>
    </div>
    <CabangSearchModal v-model="showCabangModal" @cabang-selected="onCabangSelected" />
  </PageLayout>
</template>

<style scoped>
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

.small-input {
  max-width: 140px;
}

.micro-input {
  max-width: 60px;
}

.medium-input {
  max-width: 200px;
}

.search-input {
  max-width: 200px;
}

/* Mengatur ukuran Radio Button agar rapi sebaris */
.group-by-radio :deep(.v-radio) {
  margin-right: 12px;
}

.group-by-radio :deep(label) {
  font-size: 11px;
}

.summary-box {
  margin-left: 24px;
  min-width: 120px;
  text-align: right;
}
</style>
