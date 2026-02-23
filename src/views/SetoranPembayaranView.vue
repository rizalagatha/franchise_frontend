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

const startDate = ref(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));

// Hak Akses
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete'));
const isSingleSelected = computed(() => selected.value.length === 1);

// Logika Bisnis: Data otomatis tidak boleh diubah/hapus
const isSelectedOtomatis = computed(() => selected.value[0]?.Otomatis === 'YA');

const masterHeaders: VDataTableHeaders = [
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

const fetchDetails = async ({ item }: { item: any }) => {
  if (detailsData.value[item.Nomor]) return;
  try {
    const res = await api.get(`/setoran-pembayaran/${item.Nomor}/details`);
    detailsData.value[item.Nomor] = res.data;
  } catch (error) {
    toast.error('Gagal memuat rincian.');
  }
};

// Logika Pewarnaan Baris
const getRowTextColor = (item: any) => {
  if (item.Otomatis === 'YA') return 'text-blue-darken-2 font-weight-bold'; // Biru jika otomatis
  if (Number(item.Sisa) !== 0) return 'text-red-darken-2'; // Merah jika belum lunas
  return '';
};

const handleDelete = async () => {
  const item = selected.value[0];
  if (isSelectedOtomatis.value) {
    return toast.warning('Setoran Otomatis tidak bisa dihapus.'); //
  }

  if (confirm(`Yakin hapus setoran ${item.Nomor}?`)) {
    try {
      await api.delete(`/setoran-pembayaran/${item.Nomor}`);
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
        @click="router.push(`/transaksi/setoran-pembayaran/ubah/${selected[0].Nomor}`)">Ubah</v-btn>

      <v-btn v-if="canDelete" size="small" color="error" :disabled="!isSingleSelected || isSelectedOtomatis"
        prepend-icon="mdi-delete" @click="handleDelete">Hapus</v-btn>

      <v-btn size="small" color="secondary" :disabled="!isSingleSelected" prepend-icon="mdi-printer">Cetak</v-btn>

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
          :search="search" :loading="isLoading" item-value="Nomor" show-select show-expand select-strategy="single"
          density="compact" fixed-header class="desktop-table fill-height-table"
          @click:row="(e, { item }) => selected = [item]"
          @update:expanded="(val) => { if (val.length > 0) fetchDetails({ item: { Nomor: val[val.length - 1] } }) }">
          <template #item="{ item, isSelected, toggleSelect, isExpanded, toggleExpand }">
            <tr :class="[isSelected ? 'v-data-table__selected' : '', getRowTextColor(item)]"
              @click="toggleSelect(!isSelected)">
              <td>
                <v-checkbox-btn :model-value="isSelected" color="primary"></v-checkbox-btn>
              </td>
              <td>{{ item.Nomor }}</td>
              <td>{{ format(new Date(item.Tanggal), 'dd/MM/yyyy') }}</td>
              <td>{{ item.JenisBayar }}</td>
              <td class="text-right">{{ formatRupiah(item.Nominal) }}</td>
              <td class="text-right">{{ formatRupiah(item.diBayarkan) }}</td>
              <td class="text-right">{{ formatRupiah(item.Sisa) }}</td>
              <td>{{ item.Customer }}</td>
              <td>{{ item.NamaBank || '-' }}</td>
              <td class="text-center">
                <v-chip v-if="item.Otomatis === 'YA'" size="x-small" color="blue" variant="flat">OTOMATIS</v-chip>
              </td>
              <td class="text-right">
                <v-btn :icon="isExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="x-small" variant="text"
                  @click.stop="toggleExpand(!isExpanded)"></v-btn>
              </td>
            </tr>
          </template>

          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="bg-grey-lighten-4 pa-2">
                <v-card variant="outlined" density="compact" class="mx-4 my-2">
                  <v-data-table v-if="detailsData[item.Nomor]" :items="detailsData[item.Nomor]" :headers="[
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
                  <v-skeleton-loader v-else type="table-row-divider@3"></v-skeleton-loader>
                </v-card>
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </div>
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
