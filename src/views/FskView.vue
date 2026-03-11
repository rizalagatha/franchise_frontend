<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { format, subDays } from 'date-fns';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import FskPrintModal from '@/components/FskPrintModal.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import { formatRupiah } from '@/utils/formatRupiah';

// Store & Konfigurasi
const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();
const MENU_ID = '32';

// Interface Data
interface FskHeader {
  Nomor: string;
  TglSetor: string;
  Kasir: string;
  Created: string;
  Modified: string;
}

interface FskDetail {
  Jenis: string;
  NominalSetor: number;
}

type TableHeader = {
  title: string
  key: string
  width?: string
  minWidth?: string
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
  fixed?: boolean
}

// --- State ---
const headersData = ref<FskHeader[]>([]);
const detailsData = ref<Record<string, FskDetail[]>>({});
const selected = ref<FskHeader[]>([]);
const expanded = ref<string[]>([]);
const isLoadingHeaders = ref(true);
const loadingDetails = ref<Set<string>>(new Set());
const search = ref('');
const showPrintModal = ref(false); //
const printNomor = ref<string | null>(null); //
const showDeleteDialog = ref(false);
const isDeleting = ref(false);

// Filter Tanggal (Default 30 hari terakhir)
const startDate = ref(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
const endDate = ref(format(new Date(), 'yyyy-MM-dd'));

// Hak Akses
const hasViewPermission = computed(() => authStore.can(MENU_ID, 'view'));
const canInsert = computed(() => authStore.can(MENU_ID, 'insert'));
const canEdit = computed(() => authStore.can(MENU_ID, 'edit'));
const canDelete = computed(() => authStore.can(MENU_ID, 'delete'));
const isSingleSelected = computed(() => selected.value.length === 1);

// Table Headers Master
const masterHeaders: TableHeader[] = [
  { title: 'Nomor', key: 'Nomor', width: '180px', fixed: true },
  { title: 'Tgl Setor', key: 'TglSetor', width: '120px' },
  { title: 'Kasir', key: 'Kasir', minWidth: '150px' },
  { title: 'Created By', key: 'Created', width: '120px' },
  { title: 'Modified By', key: 'Modified', width: '120px' },
  { title: '', key: 'data-table-expand', width: '50px', align: 'end' },
];

const detailHeaders: TableHeader[] = [
  { title: 'Jenis Setoran', key: 'Jenis', minWidth: '200px' },
  { title: 'Nominal Setor', key: 'NominalSetor', align: 'end', width: '150px' },
];

// --- Methods ---
const fetchHeadersData = async () => {
  isLoadingHeaders.value = true;
  try {
    const response = await api.get('/fsk', {
      params: { startDate: startDate.value, endDate: endDate.value }
    });
    headersData.value = response.data;
  } catch (error) {
    toast.error('Gagal memuat data setoran.');
  } finally {
    isLoadingHeaders.value = false;
  }
};

const loadDetails = async ({ item }: { item: any }) => {
  const nomor = item.Nomor;
  if (detailsData.value[nomor] || loadingDetails.value.has(nomor)) return;

  loadingDetails.value.add(nomor);
  try {
    const response = await api.get(`/fsk/${nomor}/details`);
    detailsData.value[nomor] = response.data;
  } catch (error) {
    toast.error(`Gagal memuat detail ${nomor}`);
  } finally {
    loadingDetails.value.delete(nomor);
  }
};

// --- Perubahan Method handleDelete ---
const handleDelete = () => {
  if (selected.value.length > 0) {
    showDeleteDialog.value = true;
  }
};

// --- Method Eksekusi Hapus yang Baru ---
const confirmDelete = async () => {
  const nomor = selected.value[0]?.Nomor;
  if (!nomor) return;

  isDeleting.value = true;
  try {
    await api.delete(`/fsk/${nomor}`);
    toast.success('Data berhasil dihapus.');
    showDeleteDialog.value = false;
    await fetchHeadersData();
    selected.value = [];
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Gagal menghapus data.');
  } finally {
    isDeleting.value = false;
  }
};

const handlePrint = () => {
  if (!selected.value.length) return

  const item = selected.value[0]
  if (!item) return

  printNomor.value = item.Nomor
  showPrintModal.value = true
}

onMounted(() => { if (hasViewPermission.value) fetchHeadersData(); });
</script>

<template>
  <PageLayout title="Setoran Kasir" :menu-id="MENU_ID" icon="mdi-bank-transfer">
    <template #header-actions>
      <v-btn v-if="canInsert" size="small" color="primary" prepend-icon="mdi-plus"
        @click="router.push('/transaksi/fsk/baru')">Baru</v-btn>
      <v-btn v-if="canEdit" size="small" :disabled="!isSingleSelected" prepend-icon="mdi-pencil"
        @click="router.push(`/transaksi/fsk/ubah/${selected[0]?.Nomor}`)">Ubah</v-btn>
      <v-btn size="small" color="secondary" :disabled="!isSingleSelected" prepend-icon="mdi-printer"
        @click="handlePrint">Cetak</v-btn>
      <v-btn v-if="canDelete" size="small" color="error" :disabled="!isSingleSelected" prepend-icon="mdi-delete"
        @click="handleDelete">Hapus</v-btn>
    </template>

    <div v-if="hasViewPermission" class="browse-content">
      <div class="filter-section d-flex align-center mb-4">
        <v-text-field v-model="startDate" type="date" label="Mulai" density="compact" variant="outlined" hide-details
          class="mr-2" style="max-width: 180px" />
        <v-text-field v-model="endDate" type="date" label="Sampai" density="compact" variant="outlined" hide-details
          class="mr-2" style="max-width: 180px" />
        <v-text-field v-model="search" label="Cari Nomor / Kasir..." density="compact" variant="outlined" hide-details
          prepend-inner-icon="mdi-magnify" />
        <v-btn @click="fetchHeadersData" icon="mdi-refresh" variant="text" class="ml-2" />
      </div>

      <div class="table-container">
        <v-data-table v-model="selected" v-model:expanded="expanded" :headers="masterHeaders" :items="headersData"
          :search="search" :loading="isLoadingHeaders" item-value="Nomor" show-select show-expand
          select-strategy="single" density="compact" fixed-header class="desktop-table fill-height-table"
          @click:row="(_: MouseEvent, { item }: { item: FskHeader }) => selected = [item]"
          @update:expanded="(val) => { if (val.length > 0) loadDetails({ item: { Nomor: val[val.length - 1] } }) }">
          <template #[`item.TglSetor`]="{ value }">
            {{ value ? format(new Date(value), 'dd/MM/yyyy') : '-' }}
          </template>

          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="expanded-detail-cell">
                <div class="detail-container">
                  <div class="detail-table-wrapper">
                    <v-data-table v-if="detailsData[item.Nomor]" :headers="detailHeaders"
                      :items="detailsData[item.Nomor]" density="compact" hide-default-footer>
                      <template #[`item.NominalSetor`]="{ value }">
                        {{ formatRupiah(value) }}
                      </template>
                    </v-data-table>
                    <v-progress-linear v-else indeterminate color="primary" height="2" />
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </div>

    <v-dialog v-model="showDeleteDialog" max-width="400px" persistent>
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 font-weight-bold pa-4 d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-alert-circle-outline</v-icon>
          Konfirmasi Hapus
        </v-card-title>

        <v-card-text class="pa-4 pt-0">
          Yakin ingin menghapus setoran <strong>{{ selected[0]?.Nomor }}</strong>? Tindakan ini tidak dapat dibatalkan.
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showDeleteDialog = false" :disabled="isDeleting">Batal</v-btn>
          <v-btn color="error" variant="elevated" @click="confirmDelete" :loading="isDeleting">Ya, Hapus</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <FskPrintModal v-model="showPrintModal" :nomor-fsk="printNomor" />
  </PageLayout>
</template>

<style scoped>
.desktop-table :deep(*) {
  font-size: 11px !important;
}

/* Sesuai preferensi user [cite: 2025-09-17] */
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
