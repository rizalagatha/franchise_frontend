<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, reactive, watch } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "vue-router";
import logoUrl from "@/assets/logo.png";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { format, subDays } from "date-fns";
import { Line } from "vue-chartjs";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement, // <--- Tambah
  PointElement, // <--- Tambah
  CategoryScale,
  LinearScale,
  Filler, // <--- Tambah untuk efek fill Area
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement, // <--- Register ini
  PointElement, // <--- Register ini
  CategoryScale,
  LinearScale,
  Filler, // <--- Register ini
  ChartDataLabels,
);

const authStore = useAuthStore();
const router = useRouter();
const toast = useToast();

// --- Data State ---
const stats = ref({
  todaySales: 0,
  todayTransactions: 0,
  lowStock: 0,
  totalProducts: 0,
});
const isLoadingStats = ref(true);
const chartGroupBy = ref<"day" | "week" | "month">("day");
const chartFilters = reactive({
  startDate: format(subDays(new Date(), 6), "yyyy-MM-dd"),
  endDate: format(new Date(), "yyyy-MM-dd"),
});
const chartData = ref({ labels: [] as string[], datasets: [] as any[] });
const isLoadingChart = ref(true);
const recentTransactions = ref<any[]>([]);
const lowStockProducts = ref<any[]>([]);
const lowStockCount = ref(0);
const pendingActions = ref<any[]>([]);
const salesTargetSummary = ref({ nominal: 0, target: 0 });

const quickActions = ref([
  {
    title: "Kasir",
    icon: "mdi-cash-register",
    to: "/transaksi/kasir",
    color: "#1976D2",
  },
  {
    title: "Customer",
    icon: "mdi-account-outline",
    to: "/daftar/customers",
    color: "#43A047",
  },
  {
    title: "Stok",
    icon: "mdi-package-variant-closed",
    to: "/laporan/stok",
    color: "#FB8C00",
  },
  {
    title: "Users",
    icon: "mdi-account-group-outline",
    to: "/tools/users",
    color: "#8E24AA",
  },
]);

// Formatters
const formatCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(v);
const currentTime = ref(
  new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "medium",
  }),
);
let intervalId: number;

const targetPercentage = computed(() => {
  if (!salesTargetSummary.value.target) return 0;
  return (
    (salesTargetSummary.value.nominal / salesTargetSummary.value.target) * 100
  );
});

const fetchDashboardData = async () => {
  try {
    const res = await api.get("/dashboard/summary");
    stats.value = res.data.stats;
    pendingActions.value = res.data.actions;
    recentTransactions.value = res.data.recent;
    lowStockProducts.value = res.data.lowStock;
    lowStockCount.value = res.data.lowStock.length;
    salesTargetSummary.value = res.data.target;
    await fetchSalesChartData();
  } catch (error) {
    toast.error("Gagal memuat dashboard");
  } finally {
    isLoadingStats.value = false;
  }
};

const fetchSalesChartData = async () => {
  isLoadingChart.value = true;
  try {
    const res = await api.get("/dashboard/chart", {
      params: {
        start: chartFilters.startDate,
        end: chartFilters.endDate,
        groupBy: chartGroupBy.value,
      },
    });

    // PENGAMANAN: Cek apakah data array langsung atau dibungkus object { data: [...] }
    const dataArray = Array.isArray(res.data) ? res.data : res.data.data;

    chartData.value = {
      labels: dataArray.map((i: any) => {
        const d = new Date(i.tanggal);
        if (chartGroupBy.value === "day") return format(d, "dd/MM");
        if (chartGroupBy.value === "week") return `Mgg-${format(d, "ww")}`;
        return format(d, "MMM yy");
      }),
      datasets: [
        {
          label: "Sales",
          backgroundColor: "rgba(25, 118, 210, 0.2)",
          borderColor: "#1976D2",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          data: dataArray.map((i: any) => parseFloat(i.total)),
        },
      ],
    };
  } catch (error) {
    console.error("Gagal load chart:", error);
    toast.error("Gagal memuat grafik penjualan."); // SEKARANG ERRORNYA KELIHATAN
  } finally {
    isLoadingChart.value = false;
  }
};

// Pastikan refresh chart saat tombol Day/Week diklik
watch(chartGroupBy, () => fetchSalesChartData());

onMounted(() => {
  if (authStore.isAuthenticated) fetchDashboardData();
  intervalId = window.setInterval(() => {
    currentTime.value = new Date().toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "medium",
    });
  }, 1000);
});
onUnmounted(() => clearInterval(intervalId));
</script>

<template>
  <v-container
    v-if="!authStore.isAuthenticated"
    class="landing-page pa-0"
    fluid
  >
    <div class="hero-overlay d-flex align-center justify-center">
      <div class="text-center">
        <v-avatar size="100" class="mb-4 elevation-10 border-white">
          <v-img :src="logoUrl" />
        </v-avatar>
        <h1 class="text-h3 font-weight-black text-white mb-2">Franchise Pro</h1>
        <p class="text-subtitle-1 text-white mb-8 opacity-80">
          Retail Management Solution
        </p>
        <v-btn
          color="orange-darken-3"
          size="large"
          rounded="pill"
          elevation="8"
          @click="router.push('/login')"
          prepend-icon="mdi-login"
        >
          Get Started
        </v-btn>
      </div>
    </div>
  </v-container>

  <v-container v-else class="dashboard-wrapper bg-grey-lighten-4" fluid>
    <v-row class="mb-4">
      <v-col cols="12">
        <v-card
          class="welcome-banner elevation-2 rounded-xl overflow-hidden border-0"
          height="110"
        >
          <div class="banner-texture-layer"></div>

          <div class="d-flex align-center pa-4 fill-height relative-content">
            <v-avatar size="56" class="elevation-3 mr-4 bg-white">
              <v-img :src="logoUrl" />
            </v-avatar>
            <div>
              <h2
                class="text-h6 font-weight-black text-white mb-0"
                style="text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.2)"
              >
                Halo, {{ authStore.user?.nama }}!
              </h2>
              <p
                class="text-caption text-white opacity-90 mb-0 font-weight-medium"
              >
                {{ currentTime }}
              </p>
            </div>
            <v-spacer></v-spacer>
            <div class="d-none d-md-block text-right">
              <v-chip
                color="rgba(255,255,255,0.2)"
                text-color="white"
                size="x-small"
                class="font-weight-black text-white"
              >
                CABANG: {{ authStore.user?.cabangNama || "PUSAT" }}
              </v-chip>
            </div>
            <v-btn
              icon="mdi-refresh"
              variant="text"
              color="white"
              class="ml-2"
              @click="fetchDashboardData"
            ></v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mb-4" dense>
      <v-col
        v-for="(val, key) in {
          todaySales: { label: 'Penjualan', icon: 'mdi-cash-multiple' },
          todayTransactions: { label: 'Transaksi', icon: 'mdi-receipt' },
          lowStock: { label: 'Stok Kritis', icon: 'mdi-alert-decagram' },
          totalProducts: { label: 'Produk', icon: 'mdi-package-variant' },
        }"
        :key="key"
        cols="6"
        md="3"
      >
        <v-card :class="['stat-card-v2', `card-${key}`]" elevation="2">
          <v-card-text class="d-flex justify-space-between align-center pa-4">
            <div>
              <div
                class="text-caption font-weight-bold text-uppercase opacity-70"
              >
                {{ val.label }}
              </div>
              <div class="text-h6 font-weight-black">
                {{
                  key === "todaySales" ? formatCurrency(stats[key]) : stats[key]
                }}
              </div>
            </div>
            <v-icon size="32" class="opacity-20">{{ val.icon }}</v-icon>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" lg="8">
        <v-card class="rounded-xl elevation-2 mb-4 border-0">
          <v-card-title class="pa-3 d-flex align-center border-b">
            <v-icon color="primary" size="18" class="mr-2"
              >mdi-chart-line</v-icon
            >
            <span class="text-subtitle-2 font-weight-bold"
              >Tren Penjualan Harian</span
            >
          </v-card-title>
          <v-card-text class="pa-4">
            <div style="height: 220px">
              <Line
                v-if="!isLoadingChart"
                :data="chartData"
                :options="{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } },
                }"
              />
            </div>
          </v-card-text>
        </v-card>

        <v-card class="rounded-xl elevation-2 overflow-hidden border-0">
          <v-card-title class="pa-3 d-flex align-center bg-green-lighten-5">
            <v-icon color="success" size="18" class="mr-2">mdi-history</v-icon>
            <span class="text-subtitle-2 font-weight-bold text-success-darken-3"
              >Transaksi Terakhir</span
            >
            <v-spacer></v-spacer>
            <v-btn
              size="x-small"
              variant="tonal"
              color="success"
              to="/transaksi/kasir"
              >DETAIL</v-btn
            >
          </v-card-title>
          <v-list class="pa-0" lines="two" density="compact">
            <v-list-item
              v-for="(tr, idx) in recentTransactions"
              :key="idx"
              border
              class="hover-list-item"
            >
              <template #prepend>
                <v-avatar color="success-lighten-4" size="32">
                  <v-icon color="success" size="16">mdi-cart-outline</v-icon>
                </v-avatar>
              </template>
              <v-list-item-title
                class="font-weight-bold"
                style="font-size: 11px !important"
                >{{ tr.customer || "Umum" }}</v-list-item-title
              >
              <v-list-item-subtitle style="font-size: 10px !important"
                >{{ tr.id }} • {{ tr.time }}</v-list-item-subtitle
              >
              <template #append>
                <div class="text-right">
                  <div class="text-caption font-weight-black text-success">
                    {{ formatCurrency(tr.amount) }}
                  </div>
                  <v-chip
                    size="x-small"
                    :color="tr.payment_type === 'Transfer' ? 'info' : 'success'"
                    variant="flat"
                    class="font-weight-bold"
                    style="font-size: 8px !important"
                  >
                    {{ tr.payment_type?.toUpperCase() || "TUNAI" }}
                  </v-chip>
                </div>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card
          class="rounded-xl elevation-3 mb-4 bg-red-darken-4 text-white border-0"
          v-if="pendingActions.length > 0"
        >
          <v-card-text class="pa-4 d-flex align-center">
            <v-avatar color="white" size="40" class="mr-3">
              <v-icon color="error" size="20">mdi-alert-circle</v-icon>
            </v-avatar>
            <div>
              <div class="text-subtitle-2 font-weight-black">
                {{ pendingActions[0].count }} Invoice
              </div>
              <div
                class="text-caption opacity-80"
                style="font-size: 10px !important"
              >
                Belum Lunas
              </div>
            </div>
            <v-spacer></v-spacer>
            <v-btn
              icon="mdi-chevron-right"
              variant="text"
              color="white"
              size="small"
              :to="pendingActions[0].to"
            ></v-btn>
          </v-card-text>
        </v-card>

        <v-card
          :class="[
            'rounded-xl elevation-2 mb-4 text-white border-0',
            targetPercentage >= 100 ? 'bg-success' : 'bg-primary',
          ]"
        >
          <v-card-text class="pa-4">
            <div class="text-caption font-weight-bold opacity-80 mb-1">
              TARGET OMSET
            </div>
            <div class="text-h5 font-weight-black mb-2">
              {{ targetPercentage.toFixed(1) }}%
            </div>
            <v-progress-linear
              :model-value="targetPercentage"
              color="white"
              height="6"
              rounded
              class="opacity-30 mb-3"
            ></v-progress-linear>
            <div
              class="d-flex justify-space-between text-caption"
              style="font-size: 10px !important"
            >
              <span>{{ formatCurrency(salesTargetSummary.nominal) }}</span>
              <span class="opacity-70"
                >Goal: {{ formatCurrency(salesTargetSummary.target) }}</span
              >
            </div>
          </v-card-text>
        </v-card>

        <v-card class="rounded-xl elevation-2 mb-4 border-0">
          <v-card-title
            class="pa-3 bg-orange-lighten-5 text-orange-darken-4 text-caption font-weight-bold"
          >
            <v-icon class="mr-2" size="14">mdi-alert-decagram</v-icon> LIMIT
            STOK
          </v-card-title>
          <v-list class="pa-0" density="compact">
            <v-list-item
              v-for="p in lowStockProducts.slice(0, 3)"
              :key="p.KODE"
              border
            >
              <v-list-item-title
                class="font-weight-bold"
                style="font-size: 10px !important"
                >{{ p.NAMA }}</v-list-item-title
              >
              <template #append>
                <v-chip
                  color="error"
                  size="x-small"
                  variant="flat"
                  class="font-weight-black"
                  >{{ p.TOTAL }} pcs</v-chip
                >
              </template>
            </v-list-item>
          </v-list>
          <v-btn
            block
            variant="text"
            color="orange-darken-4"
            size="small"
            class="font-weight-bold"
            to="/laporan/stok"
            >LIHAT SEMUA</v-btn
          >
        </v-card>

        <v-row dense>
          <v-col v-for="act in quickActions" :key="act.title" cols="3">
            <v-card
              :to="act.to"
              class="text-center pa-2 rounded-lg elevation-1"
              hover
            >
              <v-icon :color="act.color" size="20">{{ act.icon }}</v-icon>
              <div
                class="mt-1 font-weight-bold text-grey-darken-2"
                style="font-size: 9px !important"
              >
                {{ act.title }}
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.dashboard-wrapper :deep(*) {
  font-size: 11px !important;
}

/* Membatasi Ukuran Banner */
.welcome-banner {
  background: linear-gradient(135deg, #0d47a1 0%, #1976d2 100%);
}

.banner-texture {
  opacity: 0.1;
  mix-blend-mode: overlay;
}

/* Stat Cards Mini Gradients */
.stat-card-v2 {
  border-radius: 12px !important;
  color: white !important;
}
.card-todaySales {
  background: linear-gradient(135deg, #1b5e20 0%, #43a047 100%);
}
.card-todayTransactions {
  background: linear-gradient(135deg, #01579b 0%, #039be5 100%);
}
.card-lowStock {
  background: linear-gradient(135deg, #e65100 0%, #fb8c00 100%);
}
.card-totalProducts {
  background: linear-gradient(135deg, #4527a0 0%, #7e57c2 100%);
}

.hover-list-item:hover {
  background-color: #f5f5f5;
  transition: 0.2s;
}

/* Tipografi untuk Dashboard */
.text-h5 {
  font-size: 1.5rem !important;
  line-height: 1.2;
}
.text-h6 {
  font-size: 1.1rem !important;
  line-height: 1.2;
}

/* Landing Page with Blur Background */
.landing-page {
  height: 100vh;
  background: url("https://img.freepik.com/free-photo/interior-clothing-store-with-stylish-merchandise-racks-fashionable-brand-design-casual-wear-modern-boutique-empty-fashion-showroom-shopping-centre-with-elegant-merchandise_53313850.jpg")
    center center / cover no-repeat;
}
.hero-overlay {
  height: 100%;
  width: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}
</style>
