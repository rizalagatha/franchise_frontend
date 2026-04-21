<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import * as XLSX from "xlsx";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import ConfirmDeleteDialog from "@/components/dialogs/ConfirmDeleteDialog.vue";
import { useBrowse } from "@/composables/useBrowse";

const toast = useToast();
const router = useRouter();
const MENU_ID = "1"; // Menu ID untuk Master User

// 1. Setup Composable Logic
const { items, isLoading, canInsert, canEdit, canDelete, selected, fetchData } =
  useBrowse({
    menuId: MENU_ID,
    fetchApi: async () => {
      const response = await api.get("/users");
      return response.data;
    },
  });

// 2. Table Headers
const headers = [
  { title: "Kode", key: "Kode", width: "150px" },
  { title: "Nama", key: "Nama" },
  { title: "Aktif", key: "Aktif", width: "100px", align: "center" as const },
];

// 3. Logika Pewarnaan Baris (Merah jika Pasif)
const getRowProps = (data: any) => {
  const raw = data.item?.raw || data.item;
  if (raw.Aktif === "N") return { class: "text-error font-weight-bold" };
  return {};
};

// 4. Navigasi & Aksi
const handleAdd = () => router.push("/tools/users/baru");
const handleEdit = (item: any) => router.push(`/tools/users/ubah/${item.Kode}`);

const handleExport = () => {
  // Tambahkan fallback array kosong di sini
  const currentItems = items.value || [];

  if (currentItems.length === 0) return toast.warning("Data kosong.");

  // Gunakan currentItems yang sudah dijamin Array
  const worksheet = XLSX.utils.json_to_sheet(currentItems);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data User");
  XLSX.writeFile(workbook, "Master_User.xlsx");
};

// 5. State & Logika Delete
const showDeleteDialog = ref(false);
const itemToDelete = ref<any>(null);
const isDeleting = ref(false);

const handleDeleteClick = (item: any) => {
  if (item.Kode === "ADMIN") {
    return toast.error("User Admin tidak boleh dihapus.");
  }
  itemToDelete.value = item;
  showDeleteDialog.value = true;
};

const executeDelete = async () => {
  if (!itemToDelete.value) return;
  isDeleting.value = true;
  try {
    await api.delete(`/users/${itemToDelete.value.Kode}`);
    toast.success("Data berhasil dihapus.");
    showDeleteDialog.value = false;
    fetchData();
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menghapus data.");
  } finally {
    isDeleting.value = false;
  }
};
</script>

<template>
  <BaseBrowse
    v-model:selected="selected"
    item-value="Kode"
    title="Browse Data User"
    menu-id="1"
    icon="mdi-account-group-outline"
    search-placeholder="Cari User..."
    :headers="headers"
    :items="items || []"
    :is-loading="isLoading"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="true"
    :row-props-fn="getRowProps"
    @refresh="fetchData"
    @add="handleAdd"
    @edit="handleEdit"
    @delete="handleDeleteClick"
    @export="handleExport"
  >
    <template #filter-right>
      <div class="d-flex align-center">
        <v-icon color="error" size="small" class="mr-1">mdi-circle</v-icon>
        <span class="text-caption font-weight-bold text-error">User Pasif</span>
      </div>
    </template>

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
  </BaseBrowse>

  <ConfirmDeleteDialog
    v-model="showDeleteDialog"
    :item-name="`User ${itemToDelete?.Kode}`"
    :is-loading="isDeleting"
    @confirm="executeDelete"
  />
</template>

<style scoped>
:deep(.text-error),
:deep(.text-error td) {
  color: #d32f2f !important;
}
</style>
