<script setup lang="ts">
import { ref } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import CustomerFormDialog from "@/components/dialogs/CustomerFormDialog.vue";
import ConfirmDeleteDialog from "@/components/dialogs/ConfirmDeleteDialog.vue"; // 1. Import ini
import { useBrowse } from "@/composables/useBrowse";

const toast = useToast();

// 1. Panggil Composable Logic
const {
  items,
  isLoading,
  canInsert,
  canEdit,
  canDelete,
  canExport,
  selected,
  fetchData,
} = useBrowse({
  menuId: "11",
  fetchApi: async () => {
    const res = await api.get("/customers");
    return res.data;
  },
});

const headers = [
  { title: "Kode", key: "Kode", width: "120px" },
  { title: "Nama", key: "Nama", minWidth: "200px" },
  { title: "Alamat", key: "Alamat", minWidth: "250px" },
  { title: "Kota", key: "Kota", width: "150px" },
  { title: "Telp", key: "Telp", width: "120px" },
  { title: "Nama Kontak", key: "Nama_Kontak", width: "150px" },
  { title: "Aktif", key: "Aktif", width: "100px", align: "center" },
  { title: "Created By", key: "Created", width: "120px" },
  { title: "Modified By", key: "Modified", width: "120px" },
];

// 2. State untuk Dialog Form (Tambah & Ubah)
const showDialog = ref(false);
const isNewMode = ref(true);
const selectedCustomerData = ref(null);

// 3. State untuk Dialog Hapus
const showDelete = ref(false);
const itemToDelete = ref<any>(null);
const isDeleting = ref(false);

// 4. Handler Tombol
const handleAdd = () => {
  isNewMode.value = true;
  selectedCustomerData.value = null;
  showDialog.value = true;
};

const handleEdit = async (item: any) => {
  isNewMode.value = false;
  try {
    const res = await api.get(`/customers/${item.Kode}`);
    selectedCustomerData.value = res.data;
    showDialog.value = true;
  } catch (e) {
    toast.error("Gagal mengambil detail data");
  }
};

// Memicu Dialog Hapus Terbuka
const confirmDelete = (item: any) => {
  itemToDelete.value = item;
  showDelete.value = true;
};

// Mengeksekusi API Hapus
const executeDelete = async () => {
  isDeleting.value = true;
  try {
    await api.delete(`/customers/${itemToDelete.value.Kode}`);
    toast.success("Customer berhasil dihapus.");
    showDelete.value = false;
    fetchData(); // Refresh tabel
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal menghapus data.");
  } finally {
    isDeleting.value = false;
  }
};

const customRowProps = (data: any) => {
  const raw = data.item?.raw || data.item;
  return raw.Aktif === "N" ? { class: "text-error font-weight-bold" } : {};
};
</script>

<template>
  <BaseBrowse
    v-model:selected="selected"
    item-value="Kode"
    title="Master Customer"
    menu-id="11"
    icon="mdi-account-multiple"
    :headers="headers"
    :items="items || []"
    :is-loading="isLoading"
    :can-insert="canInsert"
    :can-edit="canEdit"
    :can-delete="canDelete"
    :can-export="canExport"
    :row-props-fn="customRowProps"
    search-placeholder="Cari Customer..."
    @refresh="fetchData"
    @add="handleAdd"
    @edit="handleEdit"
    @delete="confirmDelete"
  >
    <template #[`item.Aktif`]="{ value }">
      <v-chip
        :color="value === 'Y' ? 'success' : 'error'"
        size="x-small"
        variant="flat"
      >
        {{ value === "Y" ? "AKTIF" : "PASIF" }}
      </v-chip>
    </template>
  </BaseBrowse>

  <CustomerFormDialog
    v-model="showDialog"
    :is-new-mode="isNewMode"
    :customer-data="selectedCustomerData"
    @saved="fetchData"
  />

  <ConfirmDeleteDialog
    v-model="showDelete"
    :item-name="`Customer ${itemToDelete?.Nama}`"
    :is-loading="isDeleting"
    @confirm="executeDelete"
  />
</template>
