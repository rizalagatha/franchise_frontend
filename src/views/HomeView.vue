<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, reactive, watch } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import logoUrl from '@/assets/logo.png'; // Pastikan logo.png ada di src/assets/
import api from '@/services/api';
import { useToast } from 'vue-toastification';
import { format, subDays } from 'date-fns';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';
import type { TooltipItem } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ChartDataLabels);

interface PendingAction {
  key: string;
  title: string;
  icon: string;
  to: string;
  count: number;
}
interface SalesChartItem {
  tanggal: string; // format ISO
  total: number;
}
interface BarDataset {
  label: string;
  backgroundColor: string;
  data: number[];
  borderRadius?: number;
}

const authStore = useAuthStore()
const router = useRouter()
const toast = useToast();

const goToLogin = () => {
  router.push('/login')
}

// --- Data State ---
const stats = ref({
  todaySales: 0,
  todayTransactions: 0,
  lowStock: 0,
  totalProducts: 0,
});
const isLoadingStats = ref(true);

const chartGroupBy = ref<'day' | 'week' | 'month'>('day');
const chartFilters = reactive({
  startDate: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
  cabang: authStore.user?.cabang || '', // Disederhanakan
});
const cabangList = ref([{ nama: 'Semua Cabang', kode: 'ALL' }]); // Mock
const chartData = ref({
  labels: [] as string[],
  datasets: [] as BarDataset[]
});
const isLoadingChart = ref(true);

const recentTransactions = ref<any[]>([]);
const isLoadingTransactions = ref(true);

const lowStockProducts = ref<any[]>([]);
const lowStockCount = ref(0);
const isLoadingLowStock = ref(true);

const pendingActions = ref<PendingAction[]>([]);
const isLoadingActions = ref(true);

const topProducts = ref<any[]>([]);
const isLoadingTopProducts = ref(true);

const salesTargetSummary = ref({ nominal: 0, target: 0 });
const isLoadingSalesTarget = ref(true);

// --- Penyesuaian untuk FRANCHISE ---
const quickActions = ref([
  { title: 'Kasir', icon: 'mdi-cash-register', to: '/transaksi/kasir', color: 'primary' },
  { title: 'Customer', icon: 'mdi-account-outline', to: '/daftar/customers', color: 'success' },
  { title: 'Laporan Stok', icon: 'mdi-chart-line', to: '/laporan/stok', color: 'info' },
  { title: 'Master User', icon: 'mdi-account-group-outline', to: '/tools/users', color: 'purple' },
]);

const features = ref([
  {
    icon: 'mdi-cash-register',
    title: 'Transaksi',
    description: 'Kelola kasir, pembelian, dan setoran harian',
    color: 'primary'
  },
  {
    icon: 'mdi-chart-line',
    title: 'Laporan',
    description: 'Analisa penjualan dan monitoring stok real-time',
    color: 'info'
  },
  {
    icon: 'mdi-account-multiple',
    title: 'Daftar',
    description: 'Kelola data customer, price list, dan bank',
    color: 'success'
  },
  {
    icon: 'mdi-cog-outline',
    title: 'Tools',
    description: 'Utilitas, backup data, dan manajemen user',
    color: 'blue-grey'
  }
]);
// --- Akhir Penyesuaian ---

// Computed untuk format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

const targetPercentage = computed(() => {
  if (!salesTargetSummary.value.target || salesTargetSummary.value.target === 0) {
    return 0;
  }
  const percentage = (salesTargetSummary.value.nominal / salesTargetSummary.value.target) * 100;
  return percentage;
});

const isOverTarget = computed(() => {
  return targetPercentage.value > 100;
});

const getProgressColor = (percentage: number) => {
  if (percentage >= 100) return '#4CAF50';
  if (percentage >= 75) return '#2196F3';
  if (percentage >= 50) return '#FF9800';
  if (percentage >= 25) return '#FFC107';
  return '#F44336';
};

const targetChartData = computed(() => ({
  labels: ['Pencapaian'],
  datasets: [
    {
      label: 'Target',
      data: [salesTargetSummary.value.target],
      backgroundColor: '#E0E0E0',
      borderRadius: 4,
      barPercentage: 1.0,
    } as BarDataset,
    {
      label: 'Realisasi',
      data: [salesTargetSummary.value.nominal],
      backgroundColor: getProgressColor(targetPercentage.value),
      borderRadius: 4,
      barPercentage: 0.6,
    } as BarDataset
  ]
}));

const targetChartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value: any) => { // Tipe 'any' untuk callback kustom
          const numValue = Number(value);
          if (numValue >= 1000000) return `Rp ${numValue / 1000000} Jt`;
          if (numValue >= 1000) return `Rp ${numValue / 1000} Rb`;
          return formatCurrency(numValue);
        }
      }
    },
    x: {
      grouped: false,
      categoryPercentage: 0.5,
      grid: {
        display: false
      }
    }
  },
  plugins: {
    legend: {
      position: 'bottom' as const,
    },
    tooltip: {
      callbacks: {
        label: (context: TooltipItem<'bar'>) => {
          const label = context.dataset.label || '';
          const value = context.parsed.y as number;
          return `${label}: ${formatCurrency(value)}`;
        }
      }
    },
    datalabels: {
      anchor: 'end' as const,
      align: 'top' as const,
      formatter: (value: number, context: any) => {
        if (context.datasetIndex === 1) return formatCurrency(value);
        return null;
      },
      font: {
        weight: 'bold' as const,
        size: 10
      },
      color: '#424242'
    }
  }
});

const currentTime = ref(new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'medium' }));
let intervalId: number;

const fetchDashboardData = async () => {
  // Set semua loading ke true di awal
  isLoadingStats.value = true;
  isLoadingTransactions.value = true;
  isLoadingLowStock.value = true;
  isLoadingActions.value = true;
  isLoadingSalesTarget.value = true;

  try {
    const res = await api.get('/dashboard/summary');
    const data = res.data;

    // Isi masing-masing state
    stats.value = data.stats;
    pendingActions.value = data.actions;
    recentTransactions.value = data.recent;
    lowStockProducts.value = data.lowStock;
    lowStockCount.value = data.lowStock.length;
    salesTargetSummary.value = data.target;

    await fetchSalesChartData(); // Ambil data grafik
  } catch (error) {
    toast.error('Gagal memuat data dashboard.');
  } finally {
    // Matikan semua loading
    isLoadingStats.value = false;
    isLoadingTransactions.value = false;
    isLoadingLowStock.value = false;
    isLoadingActions.value = false;
    isLoadingSalesTarget.value = false;
  }
};

const fetchSalesChartData = async () => {
  isLoadingChart.value = true;
  try {
    const res = await api.get('/dashboard/chart', {
      params: {
        start: chartFilters.startDate,
        end: chartFilters.endDate
      }
    });

    const labels = res.data.map((i: any) => format(new Date(i.tanggal), 'dd/MM'));
    const values = res.data.map((i: any) => parseFloat(i.total));

    chartData.value = {
      labels: labels,
      datasets: [{
        label: 'Penjualan (Rp)',
        backgroundColor: '#42A5F5',
        data: values,
        borderRadius: 4
      }]
    };
  } catch (error) {
    console.error('Gagal load chart');
  } finally {
    isLoadingChart.value = false;
  }
};

watch([() => chartFilters.startDate, () => chartFilters.endDate], () => {
  fetchSalesChartData();
});

onMounted(() => {
  if (authStore.isAuthenticated) {
    // Panggil fungsi mock data
    fetchDashboardData();
  }

  intervalId = window.setInterval(() => {
    currentTime.value = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'medium' });
  }, 1000);
});

onUnmounted(() => {
  clearInterval(intervalId);
});

// Watcher tetap ada untuk filter, jika nanti API aslinya dihubungkan
// watch(chartFilters, fetchSalesChartData);
// watch(chartGroupBy, fetchSalesChartData);
</script>

<template>
  <!-- LANDING PAGE untuk user yang belum login -->
  <v-container v-if="!authStore.isAuthenticated" class="landing-container fill-height" fluid>
    <v-row align="center" justify="center" class="fill-height">
      <v-col cols="12" lg="10" xl="9">
        <!-- Hero Section - Compact -->
        <div class="text-center mb-8">
          <v-avatar size="100" class="mb-4 elevation-8">
            <v-img :src="logoUrl" alt="Logo" />
          </v-avatar>

          <h1 class="text-h3 font-weight-bold mb-3 text-white">
            Franchise Management
          </h1>
          <p class="text-h6 mb-6 text-white" style="opacity: 0.95;">
            Solusi Terpadu untuk Manajemen Bisnis Franchise Anda
          </p>

          <v-btn color="white" size="x-large" @click="goToLogin" prepend-icon="mdi-login" elevation="4"
            class="px-8 text-primary mb-8">
            Login untuk Melanjutkan
          </v-btn>
        </div>

        <!-- Features Grid - Disesuaikan untuk Franchise -->
        <v-row justify="center">
          <v-col v-for="feature in features" :key="feature.title" cols="6" sm="4" md="3">
            <v-card class="feature-card-compact text-center pa-4" elevation="3" hover height="100%">
              <v-avatar :color="feature.color" size="56" class="mb-3">
                <v-icon :icon="feature.icon" size="32" color="white"></v-icon>
              </v-avatar>
              <h4 class="text-subtitle-1 font-weight-bold text-grey-darken-3 mb-2">
                {{ feature.title }}
              </h4>
              <p class="text-caption text-grey-darken-1" style="line-height: 1.3;">
                {{ feature.description }}
              </p>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>

  <!-- DASHBOARD untuk user yang sudah login -->
  <v-container v-else class="home-container" fluid>
    <!-- Header Section -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center mb-4">
          <v-avatar size="60" class="mr-4">
            <v-img :src="logoUrl" alt="Logo" />
          </v-avatar>
          <div>
            <h1 class="text-h4 font-weight-bold text-primary">
              Selamat Datang di Franchise
            </h1>
            <p class="text-subtitle-1 text-medium-emphasis mb-0">
              Franchise Management System - {{ currentTime }}
            </p>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Quick Stats Cards -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" color="success" variant="tonal">
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-cash-multiple</v-icon>
            <div class="text-h4 font-weight-bold">
              <span v-if="isLoadingStats">...</span>
              <span v-else>{{ formatCurrency(stats.todaySales) }}</span>
            </div>
            <div class="text-subtitle-2">Penjualan Hari Ini</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" color="info" variant="tonal">
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-receipt</v-icon>
            <div class="text-h4 font-weight-bold">
              <span v-if="isLoadingStats">...</span>
              <span v-else>{{ stats.todayTransactions }}</span>
            </div>
            <div class="text-subtitle-2">Transaksi Hari Ini</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" color="warning" variant="tonal">
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-alert-circle</v-icon>
            <div class="text-h4 font-weight-bold">{{ isLoadingLowStock ? '...' : lowStockCount }}</div>
            <div class="text-subtitle-2">Stok Menipis</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" color="primary" variant="tonal">
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-package-variant-closed</v-icon>
            <div class="text-h4 font-weight-bold">
              <span v-if="isLoadingStats">...</span>
              <span v-else>{{ stats.totalProducts.toLocaleString('id-ID') }}</span>
            </div>
            <div class="text-subtitle-2">Total Produk</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Chart and Pending Actions Row -->
    <v-row class="mb-4">
      <v-col cols="12" lg="8">
        <v-card elevation="2">
          <v-card-title>
            <div class="d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-finance</v-icon>
              Grafik Penjualan
            </div>
          </v-card-title>

          <v-card-text>
            <div class="d-flex align-center justify-space-between flex-wrap ga-4 mb-4">
              <v-btn-toggle v-model="chartGroupBy" variant="outlined" density="compact" color="primary" mandatory>
                <v-btn size="small" value="day">Harian</v-btn>
                <v-btn size="small" value="week">Mingguan</v-btn>
                <v-btn size="small" value="month">Bulanan</v-btn>
              </v-btn-toggle>

              <div class="d-flex align-center ga-2">
                <!-- Filter Cabang disembunyikan untuk franchise, bisa diaktifkan jika perlu -->
                <!--
                <v-select v-model="chartFilters.cabang" :items="cabangList" item-title="nama" item-value="kode"
                  label="Cabang" density="compact" hide-details variant="outlined" style="max-width: 180px;"
                  :readonly="authStore.user?.cabang !== 'KDC'" />
                -->
                <v-text-field v-model="chartFilters.startDate" type="date" density="compact" hide-details
                  variant="outlined" style="max-width: 160px" />
                <span class="mx-1">s/d</span>
                <v-text-field v-model="chartFilters.endDate" type="date" density="compact" hide-details
                  variant="outlined" style="max-width: 160px" />
              </div>
            </div>

            <div v-if="isLoadingChart" class="text-center pa-8">
              <v-progress-circular indeterminate color="primary" />
              <div class="mt-2">Memuat data grafik...</div>
            </div>
            <div v-else style="height: 300px; position: relative;">
              <Bar :data="chartData"
                :options="{ responsive: true, maintainAspectRatio: false, plugins: { datalabels: { display: false } } }" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card elevation="2" class="d-flex flex-column" style="height: 100%;">
          <v-card-title class="d-flex align-center flex-shrink-0">
            <v-icon class="mr-2" color="info">mdi-bell-ring-outline</v-icon>
            Perlu Tindakan
          </v-card-title>
          <v-card-text class="flex-grow-1 overflow-y-auto" style="max-height: calc(100% - 64px);">
            <div v-if="isLoadingActions" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
            </div>
            <div v-else-if="pendingActions.length === 0" class="text-center pa-4">
              <v-icon size="48" color="success">mdi-check-all</v-icon>
              <div class="mt-2">Tidak ada tindakan tertunda. Kerja bagus!</div>
            </div>
            <v-list v-else dense bg-color="transparent" lines="two">
              <template v-for="(item, index) in pendingActions" :key="item.key">
                <v-list-item :to="item.to" class="mb-1" rounded="lg" variant="tonal">
                  <template #prepend>
                    <v-avatar :icon="item.icon" color="info" variant="flat" class="text-white"></v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-bold">{{ item.title }}</v-list-item-title>
                  <v-list-item-subtitle>Tugas yang perlu ditindaklanjuti</v-list-item-subtitle>
                  <template #append>
                    <v-chip color="info" size="large" variant="flat" class="font-weight-bold">
                      {{ item.count }}
                    </v-chip>
                  </template>
                </v-list-item>
                <v-divider v-if="index < pendingActions.length - 1" class="my-1"></v-divider>
              </template>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Main Content Row (Disederhanakan) -->
    <v-row>
      <!-- Left Column -->
      <v-col cols="12" lg="6">
        <!-- Quick Actions -->
        <v-card class="mb-4" elevation="2">
          <v-card-title class="d-flex align-center bg-blue-grey-lighten-5">
            <v-icon class="mr-2" color="primary">mdi-lightning-bolt</v-icon>
            <span class="text-h6">Aksi Cepat</span>
          </v-card-title>
          <v-card-text class="pa-6">
            <v-row class="justify-center">
              <v-col v-for="action in quickActions" :key="action.title" cols="4" sm="3" class="text-center">
                <v-tooltip :text="action.title" location="bottom">
                  <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" :to="action.to" :color="action.color" icon size="large" variant="flat"
                      class="mb-2" elevation="2">
                      <v-icon size="28">{{ action.icon }}</v-icon>
                    </v-btn>
                  </template>
                </v-tooltip>
                <div class="text-caption text-medium-emphasis">{{ action.title }}</div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Sales Target -->
        <v-card elevation="2" class="mb-4" hover>
          <v-card-title class="d-flex align-center bg-blue-lighten-5">
            <v-icon class="mr-2" color="primary">mdi-target</v-icon>
            <span class="text-h6">Pencapaian Target (Bulan Ini)</span>
          </v-card-title>
          <v-card-text class="pa-6">
            <div v-if="isLoadingSalesTarget" class="text-center pa-8">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
            </div>

            <div v-else>
              <v-row align="center">
                <v-col cols="12" sm="5" class="text-center">
                  <div style="height: 250px; position: relative;">
                    <Bar :data="targetChartData" :options="targetChartOptions" />
                  </div>
                </v-col>
                <v-col cols="12" sm="7">
                  <v-card variant="outlined" class="mb-3">
                    <v-card-text>
                      <div class="text-caption text-medium-emphasis mb-1">Realisasi</div>
                      <div class="text-h5 font-weight-bold"
                        :class="isOverTarget ? 'text-success' : 'text-deep-orange-darken-1'">
                        {{ formatCurrency(salesTargetSummary.nominal) }}
                      </div>
                      <div class="text-caption mt-1" :style="{ color: getProgressColor(targetPercentage) }">
                        {{ targetPercentage.toFixed(2) }}% dari target
                        <v-icon v-if="isOverTarget" small color="success">mdi-arrow-up-bold</v-icon>
                      </div>
                    </v-card-text>
                  </v-card>
                  <v-card variant="outlined">
                    <v-card-text>
                      <div class="text-caption text-medium-emphasis mb-1">Target</div>
                      <div class="text-h6 font-weight-medium">
                        {{ formatCurrency(salesTargetSummary.target) }}
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Right Column -->
      <v-col cols="12" lg="6">
        <!-- Recent Transactions -->
        <v-card class="mb-4" elevation="2">
          <v-card-title class="d-flex align-center justify-space-between bg-green-lighten-5">
            <div class="d-flex align-center">
              <v-icon class="mr-2" color="success">mdi-point-of-sale</v-icon>
              <span class="text-h6">Penjualan Terbaru</span>
            </div>
            <v-btn size="small" variant="text" color="success" to="/transaksi/kasir" append-icon="mdi-chevron-right">
              Lihat Semua
            </v-btn>
          </v-card-title>
          <v-card-text class="pa-4">
            <div v-if="isLoadingTransactions" class="text-center pa-8">
              <v-progress-circular indeterminate color="success" size="48"></v-progress-circular>
            </div>
            <div v-else-if="recentTransactions.length === 0" class="text-center pa-8">
              <v-icon size="64" color="grey">mdi-receipt-text-outline</v-icon>
              <div class="mt-3 text-medium-emphasis">Belum ada transaksi hari ini</div>
            </div>
            <v-list v-else bg-color="transparent" style="max-height: 300px; overflow-y: auto;">
              <v-list-item v-for="transaction in recentTransactions" :key="transaction.id" class="px-2 mb-2"
                rounded="lg" border>
                <template #prepend>
                  <v-avatar color="success-lighten-1" size="40">
                    <v-icon color="white">mdi-cart-check</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-bold">
                  {{ transaction.customer }}
                </v-list-item-title>
                <v-list-item-subtitle class="mt-1">
                  {{ transaction.id }} • {{ transaction.time }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip color="success" size="small" variant="flat" class="font-weight-bold">
                    {{ formatCurrency(transaction.amount) }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Low Stock Alert -->
        <v-card elevation="2" class="mb-4">
          <v-card-title class="d-flex align-center bg-orange-lighten-5">
            <v-icon class="mr-2" color="warning">mdi-alert-circle</v-icon>
            <span class="text-h6">Peringatan Stok Menipis</span>
          </v-card-title>
          <v-card-text class="pa-4">
            <div v-if="isLoadingLowStock" class="text-center pa-8">
              <v-progress-circular indeterminate color="warning" size="48"></v-progress-circular>
            </div>
            <div v-else-if="lowStockProducts.length === 0" class="text-center pa-8">
              <v-icon size="64" color="success">mdi-check-circle-outline</v-icon>
              <div class="mt-3 text-h6">Stok Aman!</div>
            </div>
            <div v-else>
              <v-list bg-color="transparent" class="scrollable-list" style="max-height: 300px; overflow-y: auto;">
                <v-list-item v-for="product in lowStockProducts" :key="product.KODE" class="px-2 mb-2" rounded="lg"
                  border>
                  <template #prepend>
                    <v-avatar color="error" size="40">
                      <v-icon color="white">mdi-package-variant</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="font-weight-bold text-body-1">
                    {{ product.NAMA }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="mt-1">
                    Sisa: <strong>{{ product.TOTAL }}</strong> | Buffer: <strong>{{ product.Buffer }}</strong>
                  </v-list-item-subtitle>
                  <template #append>
                    <v-chip color="error" size="small" variant="flat" class="font-weight-bold">
                      {{ product.TOTAL }} pcs
                    </v-chip>
                  </template>
                </v-list-item>
              </v-list>
              <v-btn color="warning" variant="tonal" block class="mt-4" to="/laporan/stok"
                prepend-icon="mdi-file-chart-outline">
                Lihat Laporan Lengkap
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
/* Landing Page Styles */
.landing-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 2rem;
  overflow: hidden;
}

.feature-card-compact {
  transition: all 0.3s ease;
  background: white;
  border-radius: 12px;
}

.feature-card-compact:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}

/* Dashboard Styles */
.home-container {
  padding: 1.5rem;
  background-color: #fafafa;
}

.stat-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  height: 100%;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.v-btn {
  text-transform: none;
}

.scrollable-list {
  max-height: 180px;
  overflow-y: auto;
}

.scrollable-list::-webkit-scrollbar {
  width: 6px;
}

.scrollable-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.scrollable-list::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
}

.scrollable-list::-webkit-scrollbar-thumb:hover {
  background: #555;
}

@media (max-width: 960px) {
  .home-container {
    padding: 1rem;
  }

  .landing-container {
    padding: 1rem;
  }
}

@media (max-width: 600px) {
  .home-container {
    padding: 0.5rem;
  }

  .text-h4 {
    font-size: 1.5rem !important;
  }

  .landing-container .text-h3 {
    font-size: 2rem !important;
  }

  .landing-container .text-h6 {
    font-size: 1.25rem !important;
  }
}
</style>
