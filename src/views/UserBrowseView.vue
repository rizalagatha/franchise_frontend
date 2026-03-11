<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import api from "@/services/api";
import PageLayout from "@/components/PageLayout.vue";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "vue-router";
import * as XLSX from "xlsx";

const toast = useToast();
const authStore = useAuthStore();
const router = useRouter();
const MENU_ID = "1"; // Menu ID untuk Master User

// --- State ---
const masterData = ref<any[]>([]);
const selected = ref<any[]>([]);
const isLoading = ref(false);
const search = ref("");
const isDeleting = ref(false);

// State Konfirmasi Hapus
const showConfirmDelete = ref(false);
const itemToDelete = ref<string>("");

// Hak Akses
const canView = computed(() => authStore.can(MENU_ID, "view"));
const canInsert = computed(() => authStore.can(MENU_ID, "insert"));
const canEdit = computed(() => authStore.can(MENU_ID, "edit"));
const canDelete = computed(() => authStore.can(MENU_ID, "delete"));

const isSingleSelected = computed(() => selected.value.length === 1);

// --- Header Tabel ---
const headers: any[] = [
  { title: "Kode", key: "Kode", width: "150px" },
  { title: "Nama", key: "Nama" },
  { title: "Aktif", key: "Aktif", width: "100px", align: "center" },
];

// --- Methods ---
const fetchData = async () => {
  isLoading.value = true;
  selected.value = []; // Reset selected state saat load ulang
  try {
    const response = await api.get("/users");
    masterData.value = response.data;
  } catch (error) {
    toast.error("Gagal memuat data user.");
  } finally {
    isLoading.value = false;
  }
};

// Logika pewarnaan baris (Merah jika Pasif)
const getRowTextColor = (item: any) => {
  if (!item) return "";
  return item.Aktif === "N" ? "text-red-darken-2" : "";
};

const handleRowClick = (event: PointerEvent, { item }: { item: any }) => {
  // Toggle selection: jika klik baris yang sama, kosongkan. Jika beda, pilih yang baru.
  if (selected.value.length > 0 && selected.value[0].Kode === item.Kode) {
    selected.value = [];
  } else {
    selected.value = [item];
  }
};

// Row Props untuk tabel
const myRowProps = (data: any) => {
  const rawItem = data.item?.raw || data.item;
  return {
    class: getRowTextColor(rawItem),
    style: "cursor: pointer",
  };
};

const handleEdit = () => {
  const target = selected.value?.[0];
  const kode = typeof target === "object" ? target?.Kode : target;
  if (kode) {
    router.push(`/tools/users/ubah/${kode}`);
  } else {
    toast.warning("Pilih satu data untuk diubah.");
  }
};

const confirmDelete = () => {
  const target = selected.value?.[0];
  const kode = typeof target === "object" ? target?.Kode : target;

  if (!kode) return toast.warning("Pilih satu data untuk dihapus.");

  // Proteksi khusus ADMIN
  if (kode === "ADMIN") {
    return toast.error("User Admin tidak boleh dihapus.");
  }

  itemToDelete.value = kode;
  showConfirmDelete.value = true;
};

const executeDelete = async () => {
  if (!itemToDelete.value) return;
  isDeleting.value = true;
  try {
    await api.delete(`/users/${itemToDelete.value}`);
    toast.success("Data berhasil dihapus.");
    showConfirmDelete.value = false;
    fetchData(); // Reload data
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menghapus data.");
  } finally {
    isDeleting.value = false;
  }
};

const handleExport = () => {
  if (masterData.value.length === 0) return toast.warning("Data kosong.");
  const worksheet = XLSX.utils.json_to_sheet(masterData.value);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data User");
  XLSX.writeFile(workbook, "Master_User.xlsx");
};

onMounted(() => {
  if (canView.value) fetchData();
});
</script>

<template>
  <PageLayout
    title="Browse Data User"
    :menu-id="MENU_ID"
    icon="mdi-account-group-outline"
  >
    <template #header-actions>
      <v-btn
        v-if="canInsert"
        size="small"
        color="primary"
        prepend-icon="mdi-plus"
        @click="router.push('/tools/users/baru')"
        >Baru</v-btn
      >
      <v-btn
        v-if="canEdit"
        size="small"
        :disabled="!isSingleSelected"
        prepend-icon="mdi-pencil"
        @click="handleEdit"
        >Ubah</v-btn
      >
      <v-btn
        v-if="canDelete"
        size="small"
        color="error"
        :disabled="!isSingleSelected"
        prepend-icon="mdi-delete"
        @click="confirmDelete"
        >Hapus</v-btn
      >
      <v-btn
        size="small"
        color="green"
        prepend-icon="mdi-file-excel"
        @click="handleExport"
        >Export</v-btn
      >
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-close"
        @click="router.back()"
        >Tutup</v-btn
      >
    </template>

    <div v-if="canView" class="browse-content">
      <div
        class="filter-section d-flex align-center px-4 py-2 bg-white border-b mb-3"
      >
        <div class="d-flex align-center mr-4">
          <v-badge color="error" dot class="mr-2"></v-badge>
          <span class="text-caption font-weight-bold text-error"
            >User Pasif</span
          >
        </div>
        <v-spacer></v-spacer>
        <v-text-field
          v-model="search"
          label="Cari User..."
          density="compact"
          variant="outlined"
          hide-details
          prepend-inner-icon="mdi-magnify"
          style="max-width: 300px"
          class="mr-2"
        />
        <v-btn
          @click="fetchData"
          color="primary"
          icon="mdi-refresh"
          variant="text"
          :loading="isLoading"
          size="small"
        ></v-btn>
      </div>

      <div class="table-container">
        <v-data-table
          v-model="selected"
          :headers="headers"
          :items="masterData"
          :search="search"
          :loading="isLoading"
          item-value="Kode"
          select-strategy="single"
          return-object
          show-select
          density="compact"
          fixed-header
          class="desktop-table fill-height-table colored-header zebra-table"
          @click:row="handleRowClick"
          :items-per-page="50"
        >
          <template #[`item.Aktif`]="{ value }">
            <v-chip
              :color="value === 'Y' ? 'success' : 'error'"
              size="x-small"
              variant="flat"
              class="font-weight-bold"
            >
              {{ value === "Y" ? "AKTIF" : "NON-AKTIF" }}
            </v-chip>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
          </template>
        </v-data-table>
      </div>
    </div>

    <v-dialog v-model="showConfirmDelete" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pa-4 d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-delete-alert</v-icon>
          Konfirmasi Hapus
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          Yakin ingin menghapus user <strong>{{ itemToDelete }}</strong
          >?
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="showConfirmDelete = false"
            :disabled="isDeleting"
            >Batal</v-btn
          >
          <v-btn
            color="error"
            variant="elevated"
            @click="executeDelete"
            :loading="isDeleting"
            >Ya, Hapus</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </PageLayout>
</template>

<style scoped>
/* 1. Paksa Konsistensi Font 11px */
.browse-content :deep(*) {
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

/* --- 2. KONSISTENSI BIRU (PRIMARY) --- */

/* Header Tabel */
.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
  height: 36px !important;
}

/* Checkbox Header Putih */
.colored-header :deep(thead .v-checkbox-btn .v-selection-control__wrapper) {
  color: white !important;
}

/* Highlight Baris Dipilih */
.desktop-table :deep(tr.v-data-table__selected) {
  background-color: #e3f2fd !important;
}

/* Hover Effect */
.desktop-table :deep(tbody tr:hover) {
  cursor: pointer;
  background-color: #f5f5f5 !important;
}

/* Zebra Striping */
.zebra-table :deep(tbody tr:nth-of-type(odd)) {
  background-color: #fcfcfc !important;
}

/* Warna Error untuk User Pasif (Override Row Props) */
:deep(.text-red-darken-2),
:deep(.text-red-darken-2 td) {
  color: #d32f2f !important;
}
</style>
