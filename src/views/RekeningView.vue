<script setup lang="ts">
import { ref } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import * as XLSX from "xlsx";

// Components & Composables
import BaseBrowse from "@/components/BaseBrowse.vue";
import RekeningFormDialog from "@/components/dialogs/RekeningFormDialog.vue";
import ConfirmDeleteDialog from "@/components/dialogs/ConfirmDeleteDialog.vue";
import { useBrowse } from "@/composables/useBrowse";

const toast = useToast();

// 1. Setup Logic
const browse = useBrowse({
  menuId: "14",
  fetchApi: async () => {
    const res = await api.get("/rekening");
    return res.data;
  },
});

const headers = [
  { title: "NO REKENING", key: "NoRekening", width: "200px" },
  { title: "NAMA BANK", key: "NamaBank", width: "250px" },
  { title: "ATAS NAMA", key: "AtasNama" },
  {
    title: "AKSI",
    key: "actions",
    sortable: false,
    width: "100px",
    align: "center",
  },
];

// 2. State Dialogs
const showForm = ref(false);
const isNewMode = ref(true);
const selectedData = ref(null);

const showDelete = ref(false);
const itemToDelete = ref<any>(null);
const isDeleting = ref(false);

// 3. Handlers
const handleAdd = () => {
  isNewMode.value = true;
  selectedData.value = null;
  showForm.value = true;
};

const handleEdit = async (item: any) => {
  try {
    const res = await api.get(`/rekening/form/${item.NoRekening}`);
    selectedData.value = res.data;
    isNewMode.value = false;
    showForm.value = true;
  } catch (e) {
    toast.error("Gagal mengambil detail data");
  }
};

const confirmDelete = (item: any) => {
  itemToDelete.value = item;
  showDelete.value = true;
};

const executeDelete = async () => {
  isDeleting.value = true;
  try {
    await api.delete(`/rekening/${itemToDelete.value.NoRekening}`);
    toast.success("Data berhasil dihapus");
    showDelete.value = false;
    browse.fetchData();
  } finally {
    isDeleting.value = false;
  }
};

const exportData = () => {
  const currentItems = browse.items.value || []; // <--- Tambahkan fallback di sini

  if (currentItems.length === 0) return toast.warning("Tidak ada data.");

  const ws = XLSX.utils.json_to_sheet(currentItems); // <--- Gunakan currentItems
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekening");
  XLSX.writeFile(wb, "Daftar_Rekening_Bank.xlsx");
};
</script>

<template>
  <BaseBrowse
    title="Browse Rekening Bank"
    menu-id="14"
    icon="mdi-bank"
    v-model:selected="browse.selected.value"
    item-value="NoRekening"
    :headers="headers"
    :items="browse.items.value || []"
    :is-loading="browse.isLoading.value"
    :can-insert="browse.canInsert.value"
    :can-edit="browse.canEdit.value"
    :can-delete="browse.canDelete.value"
    :can-export="browse.canExport.value"
    @refresh="browse.fetchData"
    @add="handleAdd"
    @edit="handleEdit"
    @delete="confirmDelete"
    @export="exportData"
  >
    <template #[`item.actions`]="{ item }">
      <v-icon
        v-if="browse.canEdit.value"
        size="small"
        color="primary"
        class="mr-2"
        @click.stop="handleEdit(item)"
        >mdi-pencil</v-icon
      >
      <v-icon
        v-if="browse.canDelete.value"
        size="small"
        color="error"
        @click.stop="confirmDelete(item)"
        >mdi-delete</v-icon
      >
    </template>
  </BaseBrowse>

  <RekeningFormDialog
    v-model="showForm"
    v-model:is-new-mode="isNewMode"
    :item-data="selectedData"
    @saved="browse.fetchData"
  />

  <ConfirmDeleteDialog
    v-model="showDelete"
    :item-name="`Rekening ${itemToDelete?.NoRekening}`"
    :is-loading="isDeleting"
    @confirm="executeDelete"
  />
</template>
