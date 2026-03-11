<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { format } from 'date-fns';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import * as XLSX from 'xlsx';
import CabangSearchModal from '@/components/lookup/CabangSearchModal.vue';

const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '51';

// --- State ---
const filterTanggal = ref(format(new Date(), 'yyyy-MM-dd'));
const filterCabang = ref(authStore.user?.cabang || 'F03');
const namaCabang = ref(authStore.user?.cabangNama || 'KAOSAN.OFFICIAL');
const tampilKosong = ref(false);
const showCabangModal = ref(false);

const dataStok = ref<any[]>([]);
const isLoading = ref(false);
const search = ref('');

// Hak Akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));

// Definisi Header sesuai urutan ukuran Delphi
const headers: any[] = [
  { title: 'Kode', key: 'Kode', width: '120px', fixed: true },
  { title: 'Nama Barang', key: 'NamaBarang', minWidth: '300px', fixed: true },
  { title: 'ALLSIZE', key: 'ALLSIZE', align: 'end', width: '80px' },
  { title: 'XS', key: 'XS', align: 'end', width: '60px' },
  { title: 'S', key: 'S', align: 'end', width: '60px' },
  { title: 'M', key: 'M', align: 'end', width: '60px' },
  { title: 'L', key: 'L', align: 'end', width: '60px' },
  { title: 'XL', key: 'XL', align: 'end', width: '60px' },
  { title: '2XL', key: '2XL', align: 'end', width: '60px' },
  { title: '3XL', key: '3XL', align: 'end', width: '60px' },
  { title: '4XL', key: '4XL', align: 'end', width: '60px' },
  { title: '5XL', key: '5XL', align: 'end', width: '60px' },
  { title: '6XL', key: '6XL', align: 'end', width: '60px' },
  { title: '7XL', key: '7XL', align: 'end', width: '60px' },
  { title: '8XL', key: '8XL', align: 'end', width: '60px' },
  { title: '9XL', key: '9XL', align: 'end', width: '60px' },
  { title: '10XL', key: '10XL', align: 'end', width: '60px' },
  { title: 'OVERSZ', key: 'OVERSIZE', align: 'end', width: '80px' },
  { title: 'JUMBO', key: 'JUMBO', align: 'end', width: '80px' },
  { title: 'S2', key: 'S2', align: 'end', width: '60px' },
  { title: 'S4', key: 'S4', align: 'end', width: '60px' },
  { title: 'S6', key: 'S6', align: 'end', width: '60px' },
  { title: 'S8', key: 'S8', align: 'end', width: '60px' },
  { title: 'S10', key: 'S10', align: 'end', width: '60px' },
  { title: 'S12', key: 'S12', align: 'end', width: '60px' },
  { title: 'TOTAL', key: 'Total', align: 'end', width: '100px' },
];

const fetchData = async () => {
  if (!filterCabang.value) {
    return toast.warning('Pilih cabang terlebih dahulu.');
  }

  isLoading.value = true;
  try {
    const response = await api.get('/laporan-stok', {
      params: {
        tanggal: filterTanggal.value,
        cabang: filterCabang.value,
        tampilKosong: tampilKosong.value
      }
    });
    dataStok.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat laporan stok.');
  } finally {
    isLoading.value = false;
  }
};

const onCabangSelected = (cabang: any) => {
  filterCabang.value = cabang.Kode;
  namaCabang.value = cabang.Nama;
};

const handleExport = () => {
  if (dataStok.value.length === 0) return toast.warning('Data kosong.');

  const worksheet = XLSX.utils.json_to_sheet(dataStok.value);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Stok");
  XLSX.writeFile(workbook, `Stok_${filterCabang.value}_${filterTanggal.value}.xlsx`);
};

// --- Format Angka agar tidak muncul 0 ---
const formatStok = (val: any) => {
  // Pastikan input dikonversi ke angka, jika gagal/null gunakan 0
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return '-'; // Tampilkan strip jika 0/NaN agar bersih seperti Delphi
  return new Intl.NumberFormat('id-ID').format(num);
};

// Pewarnaan baris / nilai (misal minus warna merah)
const getRowClass = (item: any) => {
  // item di sini adalah data baris yang dilempar dari slot
  return item?.Total < 0 ? 'text-red-darken-2' : '';
};

const getTotal = (key: string) => {
  const sum = dataStok.value.reduce((acc, item) => {
    return acc + (Number(item[key]) || 0);
  }, 0);
  return sum;
};

onMounted(() => {
  if (hasViewPermission.value) fetchData();
});
</script>

<template>
  <PageLayout title="Laporan Stok" :menu-id="MENU_ID" icon="mdi-file-chart-outline">
    <template #header-actions>
      <v-btn size="small" color="success" prepend-icon="mdi-file-excel" @click="handleExport"
        :disabled="dataStok.length === 0">Export</v-btn>
      <v-btn size="small" variant="outlined" prepend-icon="mdi-close" @click="$router.back()">Tutup</v-btn>
    </template>

    <div v-if="hasViewPermission" class="browse-content">
      <div class="filter-section d-flex align-center bg-grey-lighten-4 pa-2 rounded mb-3 border">
        <span class="text-caption font-weight-bold mr-2">Stok Real Time</span>
        <v-text-field v-model="filterTanggal" type="date" density="compact" variant="outlined" hide-details
          class="mr-4 small-input" />

        <span class="text-caption font-weight-bold mr-2">Perusahaan</span>
        <v-text-field v-model="filterCabang" density="compact" variant="outlined" hide-details readonly
          class="micro-input bg-white" @keyup.f1="showCabangModal = true" />
        <v-btn icon="mdi-magnify" size="x-small" variant="tonal" color="primary" class="mx-1"
          @click="showCabangModal = true"></v-btn>
        <v-text-field v-model="namaCabang" density="compact" variant="outlined" hide-details readonly
          class="mr-4 medium-input bg-white" />

        <v-checkbox-btn v-model="tampilKosong" label="Tampilkan Stok Kosong" density="compact" hide-details
          color="primary" class="mr-4 text-caption"></v-checkbox-btn>

        <v-text-field v-model="search" label="Cari Barang..." density="compact" variant="outlined" hide-details
          prepend-inner-icon="mdi-magnify" style="max-width: 200px;" />

        <v-spacer></v-spacer>
        <v-btn @click="fetchData" color="primary" prepend-icon="mdi-refresh" :loading="isLoading"
          size="small">Refresh</v-btn>
      </div>

      <div class="table-container">
        <v-data-table :headers="headers" :items="dataStok" :search="search" :loading="isLoading" density="compact"
          fixed-header class="desktop-table fill-height-table stok-table" :items-per-page="50" hover>

          <template #item="{ item }">
            <tr :class="getRowClass(item)">
              <td>{{ item.Kode }}</td>
              <td class="font-weight-bold">{{ item.NamaBarang }}</td>

              <td class="text-right">{{ formatStok(item.ALLSIZE) }}</td>
              <td class="text-right">{{ formatStok(item.XS) }}</td>
              <td class="text-right">{{ formatStok(item.S) }}</td>
              <td class="text-right">{{ formatStok(item.M) }}</td>
              <td class="text-right">{{ formatStok(item.L) }}</td>
              <td class="text-right">{{ formatStok(item.XL) }}</td>
              <td class="text-right">{{ formatStok(item['2XL']) }}</td>
              <td class="text-right">{{ formatStok(item['3XL']) }}</td>
              <td class="text-right">{{ formatStok(item['4XL']) }}</td>
              <td class="text-right">{{ formatStok(item['5XL']) }}</td>
              <td class="text-right">{{ formatStok(item['6XL']) }}</td>
              <td class="text-right">{{ formatStok(item['7XL']) }}</td>
              <td class="text-right">{{ formatStok(item['8XL']) }}</td>
              <td class="text-right">{{ formatStok(item['9XL']) }}</td>
              <td class="text-right">{{ formatStok(item['10XL']) }}</td>
              <td class="text-right">{{ formatStok(item.OVERSIZE) }}</td>
              <td class="text-right">{{ formatStok(item.JUMBO) }}</td>
              <td class="text-right">{{ formatStok(item.S2) }}</td>
              <td class="text-right">{{ formatStok(item.S4) }}</td>
              <td class="text-right">{{ formatStok(item.S6) }}</td>
              <td class="text-right">{{ formatStok(item.S8) }}</td>
              <td class="text-right">{{ formatStok(item.S10) }}</td>
              <td class="text-right">{{ formatStok(item.S12) }}</td>

              <td class="text-right font-weight-black text-primary">{{ formatStok(item.Total) }}</td>
            </tr>
          </template>

          <template #tfoot v-if="dataStok.length > 0">
            <tfoot>
              <tr class="bg-grey-lighten-3 font-weight-bold">
                <td colspan="2" class="text-right text-primary">GRAND TOTAL</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('ALLSIZE')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('XS')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('S')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('M')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('L')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('2XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('3XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('4XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('5XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('6XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('7XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('8XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('9XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('10XL')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('OVERSIZE')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('JUMBO')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('S2')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('S4')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('S6')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('S8')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('S10')) }}</td>
                <td class="text-right text-primary">{{ formatStok(getTotal('S12')) }}</td>
                <td class="text-right font-weight-black text-primary">{{ formatStok(getTotal('Total')) }}</td>
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

/* Customisasi khusus tabel Pivot Stok agar rapat seperti Delphi */
.stok-table :deep(th),
.stok-table :deep(td) {
  padding: 0 4px !important;
  font-size: 10px !important;
  /* Font lebih kecil karena kolom banyak */
}
</style>
