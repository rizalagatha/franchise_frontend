<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useForm } from "@/composables/useForm";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { format } from "date-fns";
import { formatRupiah } from "@/utils/formatRupiah";

// Components
import BaseForm from "@/components/BaseForm.vue";

const MENU_ID = "22"; // Menu Pembelian
const toast = useToast();

// --- State Header Form ---
const formHeader = ref({
  nomor: "",
  tanggal: format(new Date(), "yyyy-MM-dd"),
  noInvoice: "",
  tglInvoice: format(new Date(), "yyyy-MM-dd"),
  keterangan: "",
});

// --- State Grid Detail ---
const items = ref<any[]>([]);
const nextItemId = ref(1);
const grandTotal = ref(0);
const scanBarcode = ref("");
const isLookupLoading = ref(false);

// --- Setup Composable ---
const {
  isEditMode,
  isSaving,
  isLoading,
  showSaveDialog,
  showCancelDialog,
  goBack,
  params,
  executeSave,
  showCloseDialog,
  executeClose,
} = useForm({
  menuId: MENU_ID,
  initialData: {},
  onSuccessRoute: "/transaksi/pembelian", // <--- TAMBAHKAN INI SEBAGAI "GPS" PULANG
  submitApi: async () => {
    const validItems = items.value.filter((i) => i.kode && (i.jumlah || 0) > 0);
    const payload = {
      header: formHeader.value,
      items: validItems,
      isNew: !isEditMode.value,
    };
    await api.post("/pembelian/save", payload);
    toast.success("Data pembelian berhasil disimpan.");
  },
});

const pageTitle = computed(() =>
  isEditMode.value ? "Ubah Data Pembelian" : "Input Pembelian Baru",
);

const tableHeaders = [
  { title: "#", key: "no", sortable: false, width: "40px" },
  { title: "KODE BARANG", key: "kode", width: "120px" },
  { title: "BARCODE", key: "barcode", width: "130px" },
  { title: "NAMA BARANG", key: "nama", minWidth: "250px" },
  { title: "SIZE", key: "ukuran", align: "center" as const, width: "80px" },
  { title: "QTY INV", key: "qtyinv", align: "end" as const, width: "100px" },
  { title: "QTY TERIMA", key: "jumlah", align: "end" as const, width: "120px" },
  { title: "HPP", key: "hpp", align: "end" as const, width: "100px" },
  { title: "HARGA JUAL", key: "jual", align: "end" as const, width: "100px" },
  { title: "TOTAL", key: "total", align: "end" as const, width: "130px" },
  {
    title: "AKSI",
    key: "actions",
    sortable: false,
    width: "50px",
    align: "center" as const,
  },
];

// --- Methods Logic ---
const calculateTotals = () => {
  let total = 0;
  items.value.forEach((item) => {
    const jumlah = item.jumlah || 0;
    const hpp = item.hpp || 0;
    // Bulatkan hasil perkalian (Qty * HPP)
    item.total = Math.round(jumlah * hpp);
    total += item.total;
  });
  grandTotal.value = Math.round(total);
};

watch(items, calculateTotals, { deep: true });

const addEmptyRow = () => {
  items.value.push({
    id: nextItemId.value++,
    kode: "",
    barcode: "",
    nama: "",
    ukuran: "",
    qtyinv: null,
    jumlah: null,
    hpp: null,
    jual: null,
    total: 0,
  });
};

const loadData = async (nomor: string) => {
  isLoading.value = true;
  try {
    const res = await api.get(`/pembelian/form/${nomor}`);
    const { header, items: loadedItems } = res.data;
    formHeader.value = {
      nomor: header.bpb_nomor,
      tanggal: header.bpb_tanggal,
      noInvoice: header.bpb_inv_nomor,
      tglInvoice: header.bpb_inv_tanggal,
      keterangan: header.bpb_ket,
    };
    items.value = loadedItems.map((item: any) => ({
      ...item,
      id: nextItemId.value++,
    }));
    addEmptyRow();
  } finally {
    isLoading.value = false;
  }
};

// Logika Tarik Invoice Eksternal
const onNoInvoiceBlur = async () => {
  const invNomor = formHeader.value.noInvoice;
  if (isEditMode.value || !invNomor.trim() || isLookupLoading.value) return;

  isLookupLoading.value = true;
  try {
    const res = await api.get(`/pembelian/lookup/invoice/${invNomor.trim()}`);
    formHeader.value.tglInvoice = res.data.header.tglInvoice;
    items.value = res.data.items.map((item: any) => ({
      ...item,
      id: nextItemId.value++,
    }));
    addEmptyRow();
    toast.success(`Data Invoice ${invNomor} ditarik.`);
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Invoice tidak ditemukan.");
  } finally {
    isLookupLoading.value = false;
  }
};

// Logika Scan Barcode
const onScanBarcode = async () => {
  if (!scanBarcode.value.trim() || isLookupLoading.value) return;
  const barcode = scanBarcode.value.trim();
  isLookupLoading.value = true;

  try {
    const existingItem = items.value.find((i) => i.barcode === barcode);
    if (existingItem) {
      existingItem.jumlah = (existingItem.jumlah || 0) + 1;
      scanBarcode.value = "";
      return;
    }

    const res = await api.get(`/pembelian/lookup/barcode/${barcode}`);
    if (items.value.length > 0 && !items.value[items.value.length - 1].kode)
      items.value.pop();

    items.value.push({
      id: nextItemId.value++,
      ...res.data,
      qtyinv: 0,
      jumlah: 1,
      total: 0,
    });

    addEmptyRow();
    scanBarcode.value = "";

    await nextTick();
    const inputs = document.querySelectorAll(".qty-terima-input input");
    const lastInput = inputs[inputs.length - 2] as HTMLInputElement;
    if (lastInput) {
      lastInput.focus();
      lastInput.select();
    }
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Barcode tidak terdaftar.");
  } finally {
    isLookupLoading.value = false;
  }
};

// --- Handlers Actions ---
const validateForm = () => {
  const validItems = items.value.filter((i) => i.kode && (i.jumlah || 0) > 0);
  if (validItems.length === 0)
    return toast.warning("Isi detail barang terlebih dahulu.");

  showSaveDialog.value = true;
};

// --- Handler Cancel (Custom Reset) ---
const handleConfirmCancel = () => {
  showCancelDialog.value = false;
  if (isEditMode.value) {
    loadData(params.nomor as string);
  } else {
    formHeader.value = {
      nomor: "",
      tanggal: format(new Date(), "yyyy-MM-dd"),
      noInvoice: "",
      tglInvoice: format(new Date(), "yyyy-MM-dd"),
      keterangan: "",
    };
    items.value = [];
    addEmptyRow();
  }
  toast.info("Inputan di-reset.");
};

// --- Formatting ---
const formatNumber = (v: any) => new Intl.NumberFormat("id-ID").format(v || 0);

onMounted(() => {
  if (isEditMode.value) loadData(params.nomor as string);
  else {
    addEmptyRow();
  }
});
</script>

<template>
  <BaseForm
    :title="pageTitle"
    menu-id="22"
    icon="mdi-cart-arrow-down"
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
      <div class="desktop-form-section header-section">
        <v-text-field
          label="Nomor Dokumen"
          v-model="formHeader.nomor"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="mb-2"
          placeholder="Otomatis"
        />
        <v-text-field
          label="Tanggal Masuk"
          v-model="formHeader.tanggal"
          type="date"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2"
        />
        <v-divider class="my-3"></v-divider>
        <v-text-field
          label="Nomor Invoice Supplier"
          v-model="formHeader.noInvoice"
          variant="outlined"
          density="compact"
          hide-details
          :loading="isLookupLoading"
          :readonly="isEditMode"
          color="primary"
          @blur="onNoInvoiceBlur"
          @keyup.enter="onNoInvoiceBlur"
          class="mb-2"
        />
        <v-text-field
          label="Tanggal Invoice"
          v-model="formHeader.tglInvoice"
          type="date"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2"
        />
        <v-textarea
          label="Keterangan / Catatan"
          v-model="formHeader.keterangan"
          variant="outlined"
          rows="2"
          density="compact"
          hide-details
        />
      </div>

      <div class="desktop-form-section border-l-primary">
        <v-text-field
          label="Scan Barcode / Kode"
          v-model="scanBarcode"
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-barcode-scan"
          @keyup.enter="onScanBarcode"
          :loading="isLookupLoading"
          placeholder="Scan lalu Enter"
          hide-details
          class="mb-3"
          color="primary"
        />
        <div class="text-caption text-grey-darken-1 font-weight-bold mb-1">
          TOTAL PEMBELIAN (HPP)
        </div>
        <v-text-field
          :model-value="formatRupiah(grandTotal)"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="total-field-highlight"
        />
      </div>
    </template>

    <template #right-column>
      <div
        class="desktop-form-section pa-0 overflow-hidden fill-height elevation-1"
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
          <template #[`item.qtyinv`]="{ value }">{{
            formatNumber(value)
          }}</template>
          <template #[`item.hpp`]="{ value }">{{
            formatRupiah(value)
          }}</template>
          <template #[`item.jual`]="{ value }">{{
            formatRupiah(value)
          }}</template>
          <template #[`item.total`]="{ value }">
            <span class="text-primary font-weight-bold">{{
              formatRupiah(value)
            }}</span>
          </template>

          <template #[`item.jumlah`]="{ item }">
            <v-text-field
              v-model.number="item.jumlah"
              type="number"
              variant="underlined"
              density="compact"
              hide-details
              class="text-right-input qty-terima-input"
              color="primary"
              @focus="$event.target.select()"
            />
          </template>

          <template #[`item.actions`]="{ item }">
            <v-btn
              v-if="item.kode"
              icon="mdi-delete-outline"
              size="x-small"
              color="error"
              variant="text"
              @click="items = items.filter((i) => i.id !== item.id)"
            ></v-btn>
          </template>
          <template #bottom></template>
        </v-data-table>
      </div>
    </template>
  </BaseForm>
</template>

<style scoped>
.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}
.text-right-input :deep(input) {
  text-align: right;
  font-weight: bold;
  color: #1976d2;
}
.total-field-highlight :deep(input) {
  color: #1976d2 !important;
  font-weight: 900 !important;
  font-size: 16px !important;
  text-align: right;
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
