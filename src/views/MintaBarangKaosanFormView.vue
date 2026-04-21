<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { format } from "date-fns";

// Components & Composables
import BaseForm from "@/components/BaseForm.vue";
import ItemLookupModal from "@/components/lookup/ItemLookupModal.vue";
import MintaBarangPrintModal from "@/components/MintaBarangPrintModal.vue";
import { useForm } from "@/composables/useForm";

const toast = useToast();
const MENU_ID = "25";

// 1. Setup Composable Logic
const {
  isEditMode,
  isSaving,
  isLoading,
  showSaveDialog,
  showCancelDialog,
  showCloseDialog,
  executeClose,
  goBack,
  params,
} = useForm({
  menuId: MENU_ID,
  initialData: {},
  onSuccessRoute: "/transaksi/minta-barang-kaosan",
  submitApi: async () => {},
});

const pageTitle = computed(() =>
  isEditMode.value ? "Ubah Permintaan Barang" : "Buat Permintaan Barang",
);

// 2. State Form
const formHeader = ref({
  nomor: "",
  tanggal: format(new Date(), "yyyy-MM-dd"),
  keterangan: "",
  status: "Pending",
});

const items = ref<any[]>([]);
const nextItemId = ref(1);

const scanBarcode = ref("");
const isLookupLoading = ref(false);
const isLookupVisible = ref(false);
const editingRowIndex = ref<number | null>(null);

const showPrintModal = ref(false);
const savedNomorForPrint = ref("");

// Total Qty
const totalQty = computed(() => {
  return items.value.reduce((acc, item) => acc + (Number(item.jumlah) || 0), 0);
});

// TAMBAHAN: Kolom SIZE dimasukkan
const tableHeaders = [
  { title: "#", key: "no", sortable: false, width: "50px" },
  { title: "KODE BARANG", key: "kode", width: "150px" },
  { title: "BARCODE", key: "barcode", width: "120px" },
  { title: "NAMA BARANG", key: "nama", minWidth: "250px" },
  { title: "SIZE", key: "ukuran", align: "center" as const, width: "80px" },
  {
    title: "QTY DIMINTA",
    key: "jumlah",
    align: "center" as const,
    width: "130px",
  },
  {
    title: "AKSI",
    key: "actions",
    sortable: false,
    align: "center" as const,
    width: "70px",
  },
];

// --- 3. Methods Logic ---

const addEmptyRow = () => {
  items.value.push({
    id: nextItemId.value++,
    kode: "",
    barcode: "", // <--- TAMBAH INI
    nama: "",
    ukuran: "",
    jumlah: null,
  });
};

const removeItem = (itemToRemove: any) => {
  items.value = items.value.filter((i) => i.id !== itemToRemove.id);
  if (items.value.length === 0) addEmptyRow();
};

const loadDataForEdit = async (nomor: string) => {
  isLoading.value = true;
  try {
    const res = await api.get(`/minta-barang-kaosan/form/${nomor}`);
    formHeader.value = {
      nomor: res.data.header.nomor,
      tanggal: res.data.header.tanggal,
      keterangan: res.data.header.keterangan,
      status: res.data.header.status,
    };

    if (res.data.header.status !== "Pending") {
      toast.warning(
        "Permintaan ini sudah diproses Pusat dan tidak dapat diubah.",
      );
    }

    items.value = res.data.items.map((i: any) => ({
      ...i,
      id: nextItemId.value++,
      jumlah: Number(i.jumlah),
    }));
    addEmptyRow();
  } catch (error) {
    toast.error("Gagal memuat data permintaan.");
    goBack();
  } finally {
    isLoading.value = false;
  }
};

// --- Lookup & Scan Logic ---
const processLookupResult = (itemResult: any, targetIndex: number) => {
  // Cek barang kembar (kode + ukuran sama)
  const existingIdx = items.value.findIndex(
    (i) =>
      i.kode === itemResult.kode &&
      i.ukuran === itemResult.ukuran &&
      i !== items.value[targetIndex],
  );

  if (existingIdx > -1) {
    toast.info(
      `Barang ${itemResult.nama} (${itemResult.ukuran}) sudah ada. Qty ditambah.`,
    );
    if (targetIndex === -1) {
      items.value[existingIdx].jumlah =
        (items.value[existingIdx].jumlah || 0) + 1;
    }
    return false;
  }

  let row: any;
  if (targetIndex === -1) {
    // Dari scan barcode
    if (items.value.length > 0 && !items.value[items.value.length - 1].kode) {
      items.value.pop();
    }
    row = {
      id: nextItemId.value++,
      kode: itemResult.kode,
      barcode: itemResult.barcode,
      nama: itemResult.nama,
      ukuran: itemResult.ukuran,
      jumlah: 1,
    };
    items.value.push(row);
    addEmptyRow(); // Baris kosong baru
  } else {
    // Dari klik F1 di baris kosong
    row = items.value[targetIndex];
    row.kode = itemResult.kode;
    row.barcode = itemResult.barcode;
    row.nama = itemResult.nama;
    row.ukuran = itemResult.ukuran;
    row.jumlah = 1;

    // PERBAIKAN: Jika yang diisi adalah baris paling bawah, tambahkan baris kosong baru!
    if (targetIndex === items.value.length - 1) {
      addEmptyRow();
    }
  }
  return true;
};

const onScanBarcode = async () => {
  if (!scanBarcode.value.trim() || isLookupLoading.value) return;
  const barcode = scanBarcode.value.trim();
  isLookupLoading.value = true;

  try {
    const res = await api.get(`/minta-barang-kaosan/lookup/barang`, {
      params: { keyword: barcode },
    });

    // Sesuaikan respons API yang tadi ada { items, total }
    const resultData = Array.isArray(res.data)
      ? res.data
      : res.data.items || [];

    if (resultData.length === 1) {
      if (processLookupResult(resultData[0], -1)) {
        await nextTick();
        const inputs =
          document.querySelectorAll<HTMLInputElement>(".qty-input input");
        inputs[inputs.length - 2]?.focus();
      }
    } else if (resultData.length > 1) {
      isLookupVisible.value = true;
    } else {
      toast.error("Barang tidak ditemukan di database Pusat.");
    }
  } catch (e: any) {
    toast.error("Gagal mencari barang.");
  } finally {
    scanBarcode.value = "";
    isLookupLoading.value = false;
  }
};

const openLookup = (index: number) => {
  if (formHeader.value.status !== "Pending" && isEditMode.value) return;
  editingRowIndex.value = index;
  isLookupVisible.value = true;
};

const onItemSelected = (selectedItem: any) => {
  if (editingRowIndex.value !== null) {
    processLookupResult(selectedItem, editingRowIndex.value);
  }
  isLookupVisible.value = false;
  editingRowIndex.value = null;
};

// --- Save & Cancel Logic ---
const validateForm = () => {
  if (isEditMode.value && formHeader.value.status !== "Pending") {
    return toast.error("Data tidak bisa diubah karena sudah diproses Pusat.");
  }

  const validItems = items.value.filter((i) => i.kode && (i.jumlah || 0) > 0);
  if (validItems.length === 0) {
    return toast.error("Minimal minta 1 barang dengan Qty lebih dari 0.");
  }

  showSaveDialog.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      items: items.value.filter((i) => i.kode && i.jumlah > 0),
      isNew: !isEditMode.value,
    };
    const res = await api.post("/minta-barang-kaosan/save", payload);

    toast.success(res.data.message);
    showSaveDialog.value = false;

    // Trik Otomatis Buka Print Modal
    savedNomorForPrint.value = res.data.nomor || formHeader.value.nomor;
    await nextTick();
    showPrintModal.value = true;
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

const onPrintModalClosed = () => {
  showPrintModal.value = false;
  goBack(); // Kembali ke halaman browse
};

const handleConfirmCancel = () => {
  showCancelDialog.value = false;
  if (isEditMode.value) {
    loadDataForEdit(params.nomor as string);
  } else {
    formHeader.value = {
      nomor: "",
      tanggal: format(new Date(), "yyyy-MM-dd"),
      keterangan: "",
      status: "Pending",
    };
    items.value = [];
    addEmptyRow();
  }
  toast.info("Inputan di-reset.");
};

onMounted(() => {
  if (isEditMode.value) loadDataForEdit(params.nomor as string);
  else {
    addEmptyRow();
    isLoading.value = false;
  }
});
</script>

<template>
  <BaseForm
    :title="pageTitle"
    menu-id="25"
    icon="mdi-truck-delivery-outline"
    :is-loading="isLoading"
    :is-saving="isSaving"
    v-model:show-save-dialog="showSaveDialog"
    v-model:show-cancel-dialog="showCancelDialog"
    v-model:show-close-dialog="showCloseDialog"
    @validate-save="validateForm"
    @confirm-save="executeSave"
    @confirm-cancel="handleConfirmCancel"
    @confirm-close="executeClose"
  >
    <template #left-column>
      <div
        class="desktop-form-section header-section border-l-primary mb-3"
        v-if="!isLoading"
      >
        <v-text-field
          label="Nomor Permintaan"
          v-model="formHeader.nomor"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="mb-2"
          placeholder="<Otomatis>"
        />
        <v-text-field
          label="Tanggal"
          v-model="formHeader.tanggal"
          type="date"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2 bg-white"
          :readonly="formHeader.status !== 'Pending' && isEditMode"
        />
        <v-text-field
          label="Status"
          v-model="formHeader.status"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="mb-2 font-weight-bold"
          :class="
            formHeader.status === 'Pending' ? 'text-warning' : 'text-success'
          "
        />
        <v-textarea
          label="Keterangan / Pesan Tambahan"
          v-model="formHeader.keterangan"
          variant="outlined"
          rows="3"
          density="compact"
          hide-details
          class="bg-white"
          :readonly="formHeader.status !== 'Pending' && isEditMode"
        />
      </div>

      <div class="desktop-form-section border-l-primary" v-if="!isLoading">
        <v-text-field
          label="Cari Barang Pusat (F1/Scan)"
          v-model="scanBarcode"
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-barcode-scan"
          @keyup.enter="onScanBarcode"
          :loading="isLookupLoading"
          color="primary"
          placeholder="Ketik & Enter"
          hide-details
          class="mb-3 bg-white"
          :disabled="formHeader.status !== 'Pending' && isEditMode"
        />
        <div
          class="d-flex justify-space-between align-center bg-blue-lighten-5 pa-3 rounded border border-primary border-opacity-25"
        >
          <span
            class="text-caption font-weight-bold text-primary text-uppercase"
            >Total Qty Diminta</span
          >
          <span class="text-h5 font-weight-black text-primary"
            >{{ totalQty }} Pcs</span
          >
        </div>
      </div>
    </template>

    <template #right-column>
      <div
        class="desktop-form-section pa-0 overflow-hidden fill-height elevation-1"
        v-if="!isLoading"
      >
        <v-data-table
          :headers="tableHeaders"
          :items="items"
          density="compact"
          class="desktop-table colored-header zebra-table"
          fixed-header
          :items-per-page="-1"
          hide-default-footer
        >
          <template #[`item.no`]="{ index }">{{ index + 1 }}</template>

          <template #[`item.kode`]="{ item, index }">
            <div
              @click="
                (formHeader.status === 'Pending' || !isEditMode) &&
                !item.kode &&
                openLookup(index)
              "
              :class="[
                (formHeader.status === 'Pending' || !isEditMode) && !item.kode
                  ? 'cursor-pointer text-blue-darken-2'
                  : '',
                'font-weight-bold py-2',
              ]"
            >
              {{ item.kode || "Klik / F1 Cari" }}
            </div>
          </template>

          <template #[`item.barcode`]="{ item }">
            <div class="font-weight-medium">{{ item.barcode || "-" }}</div>
          </template>

          <template #[`item.ukuran`]="{ item }">
            <div class="text-center font-weight-bold">
              {{ item.ukuran || "-" }}
            </div>
          </template>

          <template #[`item.jumlah`]="{ item }">
            <v-text-field
              v-model.number="item.jumlah"
              type="number"
              variant="underlined"
              density="compact"
              hide-details
              class="text-center-input qty-input"
              color="primary"
              @focus="$event.target.select()"
              :disabled="
                !item.kode || (formHeader.status !== 'Pending' && isEditMode)
              "
            />
          </template>

          <template #[`item.actions`]="{ item }">
            <v-btn
              v-if="item.kode"
              icon="mdi-delete-outline"
              size="x-small"
              color="error"
              variant="text"
              @click="removeItem(item)"
              :disabled="formHeader.status !== 'Pending' && isEditMode"
            ></v-btn>
          </template>

          <template #bottom></template>
        </v-data-table>
      </div>
    </template>
  </BaseForm>

  <ItemLookupModal
    v-model="isLookupVisible"
    source="minta-barang"
    @item-selected="onItemSelected"
  />

  <MintaBarangPrintModal
    v-model="showPrintModal"
    :nomor="savedNomorForPrint"
    @update:modelValue="(val) => !val && onPrintModalClosed()"
  />
</template>

<style scoped>
.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}
.desktop-table :deep(td) {
  border-right: 1px solid #e0e0e0;
}
.text-center-input :deep(input) {
  text-align: center;
  font-weight: 900;
  font-size: 14px !important;
  color: #1976d2;
}
.cursor-pointer {
  cursor: pointer;
}
.border-l-primary {
  border-left: 4px solid #1976d2 !important;
}
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
