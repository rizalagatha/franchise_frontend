<script setup lang="ts">
import { ref, onMounted } from "vue";
import { format } from "date-fns";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/authStore";

// Component & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import MintaBarangPrintModal from "@/components/MintaBarangPrintModal.vue";

const MENU_ID = "25";
const toast = useToast();
const router = useRouter();
const authStore = useAuthStore();

// State Browse
const filterDateStart = ref(format(new Date(), "yyyy-MM-dd"));
const filterDateEnd = ref(format(new Date(), "yyyy-MM-dd"));
const items = ref<any[]>([]);
const search = ref("");
const isLoading = ref(false);
const selectedRows = ref<any[]>([]);

// State Cetak
const showPrintModal = ref(false);
const printNomor = ref("");

// State Detail (Expandable Rows)
const expandedRows = ref<any[]>([]);
const detailMap = ref<Record<string, { loading: boolean; data: any[] }>>({});

const headers = [
  { title: "NOMOR", key: "Nomor", width: "150px" },
  { title: "TANGGAL", key: "Tanggal", width: "120px" },
  {
    title: "TOTAL QTY",
    key: "TotalQty",
    align: "end" as const,
    width: "100px",
  },
  { title: "KETERANGAN", key: "Keterangan", minWidth: "200px" },
  { title: "STATUS", key: "Status", align: "center" as const, width: "120px" },
  { title: "DIBUAT", key: "Created", width: "120px" },
];

// Methods
const fetchData = async () => {
  isLoading.value = true;
  expandedRows.value = [];
  try {
    const res = await api.get("/minta-barang-kaosan", {
      params: {
        startDate: filterDateStart.value,
        endDate: filterDateEnd.value,
      },
    });
    items.value = res.data;
  } catch (error: any) {
    toast.error(
      error.response?.data?.message || "Gagal memuat data permintaan.",
    );
  } finally {
    isLoading.value = false;
  }
};

const handleAdd = () => router.push("/transaksi/minta-barang-kaosan/baru");

const handleEditGlobal = (item: any) => {
  if (!item) return;
  if (item.Status !== "Pending") {
    return toast.warning("Hanya transaksi Pending yang bisa diubah.");
  }
  router.push(`/transaksi/minta-barang-kaosan/ubah/${item.Nomor}`);
};

const handleDeleteGlobal = async (item: any) => {
  if (!item) return;
  if (item.Status !== "Pending") {
    return toast.warning("Hanya transaksi Pending yang bisa dihapus.");
  }
  if (!window.confirm(`Yakin ingin menghapus permintaan ${item.Nomor}?`))
    return;

  try {
    await api.delete(`/minta-barang-kaosan/${item.Nomor}`);
    toast.success("Permintaan berhasil dihapus.");
    fetchData();
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menghapus permintaan.");
  }
};

const handlePrintGlobal = (selected: any[]) => {
  if (!selected || selected.length === 0) return;
  printNomor.value = selected[0].Nomor;
  showPrintModal.value = true;
};

const handleExport = () => {
  toast.info("Fitur Export Excel akan segera hadir!");
};

const handleUpdateExpanded = async (newVal: any[]) => {
  expandedRows.value = newVal;

  for (const row of newVal) {
    const nomor = row.Nomor;
    if (!detailMap.value[nomor]) {
      detailMap.value[nomor] = { loading: true, data: [] };
      try {
        const res = await api.get(`/minta-barang-kaosan/${nomor}/details`);
        detailMap.value[nomor].data = res.data;
      } catch (error) {
        toast.error(`Gagal memuat rincian ${nomor}`);
      } finally {
        detailMap.value[nomor].loading = false;
      }
    }
  }
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <BaseBrowse
    title="Permintaan Barang ke Pusat"
    :menu-id="MENU_ID"
    icon="mdi-truck-delivery"
    item-value="Nomor"
    :headers="headers"
    :items="items"
    :is-loading="isLoading"
    :can-insert="authStore.can(MENU_ID, 'insert')"
    :can-edit="authStore.can(MENU_ID, 'edit')"
    :can-delete="authStore.can(MENU_ID, 'delete')"
    :can-export="true"
    :show-expand="true"
    :expanded="expandedRows"
    @update:expanded="handleUpdateExpanded"
    v-model:selected="selectedRows"
    v-model:search="search"
    v-model:date-start="filterDateStart"
    v-model:date-end="filterDateEnd"
    @refresh="fetchData"
    @add="handleAdd"
    @edit="handleEditGlobal"
    @delete="handleDeleteGlobal"
    @export="handleExport"
  >
    <template #filter-left>
      <v-text-field
        v-model="filterDateStart"
        type="date"
        label="Mulai"
        density="compact"
        hide-details
        variant="outlined"
        class="bg-white filter-date"
        @change="fetchData"
      ></v-text-field>
      <v-text-field
        v-model="filterDateEnd"
        type="date"
        label="Sampai"
        density="compact"
        hide-details
        variant="outlined"
        class="bg-white filter-date"
        @change="fetchData"
      ></v-text-field>
    </template>

    <template #extra-actions="{ selected }">
      <v-btn
        size="small"
        color="info"
        prepend-icon="mdi-printer"
        :disabled="!selected || selected.length === 0"
        @click="handlePrintGlobal(selected)"
      >
        Cetak
      </v-btn>
    </template>

    <template #[`item.Status`]="{ item }">
      <v-chip
        size="small"
        :color="
          item.Status === 'Pending'
            ? 'warning'
            : item.Status === 'Proses'
              ? 'info'
              : item.Status === 'Dikirim'
                ? 'primary'
                : 'success'
        "
        class="font-weight-bold"
      >
        {{ item.Status }}
      </v-chip>
    </template>

    <template #detail="{ item }">
      <div class="pa-4 bg-grey-lighten-4">
        <div class="d-flex align-center mb-3">
          <v-icon color="primary" class="mr-2"
            >mdi-text-box-search-outline</v-icon
          >
          <h4 class="text-primary font-weight-bold mb-0">Rincian Barang</h4>
        </div>

        <v-progress-linear
          v-if="detailMap[item.Nomor]?.loading"
          indeterminate
          color="primary"
          class="mb-2"
        />

        <v-table
          v-else
          density="compact"
          class="elevation-1 bg-white rounded detail-table"
        >
          <thead class="bg-grey-lighten-3">
            <tr>
              <th class="font-weight-bold" style="width: 150px">Kode Barang</th>
              <th class="font-weight-bold">Nama Barang</th>
              <th class="font-weight-bold text-center" style="width: 100px">
                Ukuran
              </th>
              <th class="text-right font-weight-bold" style="width: 100px">
                Qty Diminta
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(detail, idx) in detailMap[item.Nomor]?.data" :key="idx">
              <td class="font-weight-medium">{{ detail.Kode }}</td>
              <td>{{ detail.Nama }}</td>
              <td class="text-center font-weight-bold">
                {{ detail.Ukuran || "-" }}
              </td>
              <td class="text-right font-weight-bold text-primary">
                {{ detail.Jumlah }}
              </td>
            </tr>
            <tr v-if="detailMap[item.Nomor]?.data?.length === 0">
              <td colspan="4" class="text-center py-4 text-grey">
                Tidak ada rincian barang.
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </template>
  </BaseBrowse>

  <MintaBarangPrintModal v-model="showPrintModal" :nomor="printNomor" />
</template>

<style scoped>
.filter-date {
  width: 140px;
  flex: none;
}
.detail-table th {
  text-transform: uppercase;
  font-size: 11px !important;
}
.detail-table td {
  font-size: 11px !important;
}
</style>
