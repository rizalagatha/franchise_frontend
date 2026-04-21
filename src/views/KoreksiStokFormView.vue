<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { format } from "date-fns";
import logoUrl from "@/assets/logo.png";
import { formatRupiah } from "@/utils/formatRupiah";

// Components & Composables
import BaseForm from "@/components/BaseForm.vue";
import ItemLookupModal from "@/components/lookup/ItemLookupModal.vue";
import { useForm } from "@/composables/useForm";

const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = "23";

// 1. Setup Composable
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
  onSuccessRoute: "/transaksi/koreksi-stok", // Rute kembali setelah selesai semua urusan
  submitApi: async () => {}, // Kita override logic simpannya di executeSave
});

const pageTitle = computed(() =>
  isEditMode.value ? "Ubah Koreksi Stok" : "Koreksi Stok Baru",
);
const canInsert = computed(() => authStore.can(MENU_ID, "insert"));
const canEdit = computed(() => authStore.can(MENU_ID, "edit"));

// 2. State Header & Detail Form
const formHeader = ref({
  nomor: "",
  tanggal: format(new Date(), "yyyy-MM-dd"),
  keterangan: "",
});

const items = ref<any[]>([]);
const nextItemId = ref(1);
const grandTotal = ref(0);

const scanBarcode = ref("");
const isLookupLoading = ref(false);
const isLookupVisible = ref(false);
const editingRowIndex = ref<number | null>(null);

// 3. State Print
const isPrintPreviewVisible = ref(false);
const printPreviewData = ref<any>(null);
const isPrintConfirmDialogVisible = ref(false);
const savedNomorForPrint = ref("");

// Headers Table
const tableHeaders = [
  { title: "#", key: "no", sortable: false, width: "40px" },
  { title: "KODE BARANG", key: "kode", width: "120px" },
  { title: "NAMA BARANG", key: "nama", minWidth: "300px" },
  { title: "SIZE", key: "ukuran", align: "center" as const, width: "80px" },
  { title: "STOK AWAL", key: "stok", align: "end" as const, width: "100px" },
  { title: "JML REAL", key: "jumlah", align: "end" as const, width: "100px" },
  { title: "SELISIH", key: "selisih", align: "end" as const, width: "90px" },
  { title: "HPP", key: "hpp", align: "end" as const, width: "110px" },
  { title: "TOTAL", key: "total", align: "end" as const, width: "130px" },
  { title: "CATATAN", key: "keterangan", minWidth: "150px" },
  { title: "BARCODE", key: "barcode", width: "130px" },
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
    item.selisih = (item.jumlah || 0) - (item.stok || 0);
    // Terapkan pembulatan saat kalkulasi
    item.total = Math.round(item.selisih * (item.hpp || 0));
    total += item.total;
  });
  grandTotal.value = Math.round(total);
};
watch(items, calculateTotals, { deep: true });

const addEmptyRow = () =>
  items.value.push({
    id: nextItemId.value++,
    kode: "",
    barcode: "",
    nama: "",
    ukuran: "",
    stok: null,
    jumlah: null,
    selisih: 0,
    hpp: null,
    total: 0,
    keterangan: null,
  });

const removeItem = (itemToRemove: any) => {
  items.value = items.value.filter((i) => i.id !== itemToRemove.id);
  if (items.value.length === 0) addEmptyRow();
};

const loadDataForEdit = async (nomor: string) => {
  isLoading.value = true;
  try {
    const res = await api.get(`/koreksi-stok/form/${nomor}`);
    formHeader.value = {
      nomor: res.data.header.kor_nomor,
      tanggal: res.data.header.kor_tanggal,
      keterangan: res.data.header.kor_ket,
    };
    items.value = res.data.items.map((i: any) => ({
      ...i,
      id: nextItemId.value++,
    }));
    addEmptyRow();
  } finally {
    isLoading.value = false;
  }
};

// --- Lookup & Scan Logic ---
const processLookupResult = (itemResult: any, targetIndex: number) => {
  const existingIdx = items.value.findIndex(
    (i) =>
      i.kode === itemResult.kode &&
      i.ukuran === itemResult.ukuran &&
      i !== items.value[targetIndex],
  );

  if (existingIdx > -1) {
    toast.warning(
      `Barang ${itemResult.nama} (${itemResult.ukuran}) sudah ada di baris ${existingIdx + 1}.`,
    );
    if (targetIndex === -1) {
      items.value[existingIdx].jumlah =
        (items.value[existingIdx].jumlah || 0) + 1;
      toast.info(`Jumlah ditambah 1.`);
    }
    return false;
  }

  let row: any;
  if (targetIndex === -1) {
    if (items.value.length > 0 && !items.value[items.value.length - 1].kode)
      items.value.pop();
    row = {
      id: nextItemId.value++,
      ...itemResult,
      jumlah: 1,
      selisih: 0,
      total: 0,
      keterangan: "",
    };
    items.value.push(row);
    addEmptyRow();
  } else {
    row = items.value[targetIndex];
    Object.assign(row, itemResult);
    row.jumlah = 0;
  }
  return true;
};

const onScanBarcode = async () => {
  if (!scanBarcode.value.trim() || isLookupLoading.value) return;
  const barcode = scanBarcode.value.trim();
  isLookupLoading.value = true;
  try {
    const res = await api.get(`/koreksi-stok/lookup/barcode`, {
      params: {
        barcode,
        tanggal: formHeader.value.tanggal,
        nomor: formHeader.value.nomor,
      },
    });
    if (processLookupResult(res.data, -1)) {
      scanBarcode.value = "";
      await nextTick();
      const inputs = document.querySelectorAll<HTMLInputElement>(
        ".qty-real-input input",
      );
      inputs[inputs.length - 2]?.focus();
    }
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal memproses barcode.");
    scanBarcode.value = "";
  } finally {
    isLookupLoading.value = false;
  }
};

const openLookup = (index: number) => {
  if (!canInsert.value && !canEdit.value) return;
  editingRowIndex.value = index;
  isLookupVisible.value = true;
};

const onItemSelected = (selectedItem: any) => {
  if (editingRowIndex.value !== null)
    processLookupResult(selectedItem, editingRowIndex.value);
  isLookupVisible.value = false;
  editingRowIndex.value = null;
};

// --- Save Logic (Disesuaikan dengan BaseForm) ---
const validateForm = () => {
  if (!formHeader.value.keterangan?.trim())
    return toast.error("Keterangan harus diisi.");
  const validItems = items.value.filter((i) => i.kode && i.selisih !== 0);
  if (validItems.length === 0)
    return toast.error(
      "Detail barang harus diisi dan minimal ada 1 selisih (Real != Sistem).",
    );

  // Jika valid, munculkan dialog simpan dari BaseForm
  showSaveDialog.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const res = await api.post("/koreksi-stok/save", {
      header: formHeader.value,
      items: items.value.filter((i) => i.kode),
      isNew: !isEditMode.value,
    });
    toast.success(res.data.message);

    // Tutup dialog konfirmasi simpan BaseForm
    showSaveDialog.value = false;

    // Simpan nomor dan munculkan dialog khusus "Ingin mencetak?"
    savedNomorForPrint.value = res.data.nomor;
    isPrintConfirmDialogVisible.value = true;
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

const handleConfirmCancel = () => {
  showCancelDialog.value = false;
  if (isEditMode.value) loadDataForEdit(params.nomor as string);
  else {
    formHeader.value = {
      nomor: "",
      tanggal: format(new Date(), "yyyy-MM-dd"),
      keterangan: "",
    };
    items.value = [];
    addEmptyRow();
  }
  toast.info("Inputan di-reset.");
};

// --- Cetak Flow ---
const onPrintConfirmYes = () => {
  isPrintConfirmDialogVisible.value = false;
  handlePrint(savedNomorForPrint.value);
};

const onPrintConfirmNo = () => {
  isPrintConfirmDialogVisible.value = false;
  goBack(); // Kembali ke daftar halaman browse
};

const closePreviewAndNavigate = () => {
  isPrintPreviewVisible.value = false;
  printPreviewData.value = null; // Bersihkan memori pratinjau
  goBack(); // Kembali ke daftar halaman browse
};

const handlePrint = async (nomor: string) => {
  try {
    const res = await api.get(`/koreksi-stok/print/${nomor}`);
    printPreviewData.value = res.data;
    isPrintPreviewVisible.value = true;
  } catch (error) {
    toast.error("Gagal mengambil data cetak.");
  }
};

const triggerBrowserPrint = async () => {
  await nextTick();
  const printContent = document.querySelector("#print-area .print-layout");
  if (!printContent) return toast.error("Area cetak tidak ditemukan.");

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  const css = `.print-layout { font-family: Arial, sans-serif; font-size: 9pt; width: 210mm; margin: auto; padding: 1cm; color: #000; } .print-header { display: flex; align-items: center; margin-bottom: 10px; } .print-logo { width: 35px; height: 35px; margin-right: 8px; } .print-title { text-align: center; font-size: 14pt; font-weight: bold; text-decoration: underline; margin-bottom: 10px; } .header-table { width: 60%; font-size: 9pt; margin-bottom: 15px; border-collapse: collapse; } .detail-table-print { width: 100%; font-size: 9pt; border-collapse: collapse; } .detail-table-print th, .detail-table-print td { border: 1px solid #000; padding: 3px 5px; } .text-end { text-align: right; } .print-footer { margin-top: 20px; display: flex; justify-content: space-around; text-align: center; } @page { size: A4 portrait; margin: 1cm; }`;
  doc.open();
  doc.write(
    `<html><head><style>${css}</style></head><body>${printContent.outerHTML}</body></html>`,
  );
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
};

const formatNumber = (v: any) => new Intl.NumberFormat("id-ID").format(v || 0);

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
    menu-id="23"
    icon="mdi-clipboard-edit-outline"
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
      <div class="desktop-form-section header-section" v-if="!isLoading">
        <v-text-field
          label="No. Koreksi"
          v-model="formHeader.nomor"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="mb-2"
          placeholder="Otomatis"
        />
        <v-text-field
          label="Tanggal"
          v-model="formHeader.tanggal"
          type="date"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2 bg-white"
        />
        <v-alert
          density="compact"
          type="info"
          variant="tonal"
          class="text-caption py-2 mb-2"
          style="line-height: 1.2"
          >Input 'JML Real' dengan stok fisik di rak saat ini.</v-alert
        >
        <v-textarea
          label="Keterangan *"
          v-model="formHeader.keterangan"
          variant="outlined"
          rows="2"
          density="compact"
          hide-details
          class="bg-white"
        />
      </div>

      <div class="desktop-form-section border-l-primary" v-if="!isLoading">
        <v-text-field
          label="Scan Barcode / F1"
          v-model="scanBarcode"
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-barcode-scan"
          @keyup.enter="onScanBarcode"
          :loading="isLookupLoading"
          color="primary"
          placeholder="Enter untuk menambah"
          hide-details
          class="mb-3 bg-white"
        />
        <div class="text-caption text-grey-darken-1 font-weight-bold mb-1">
          TOTAL NOMINAL KOREKSI
        </div>
        <v-text-field
          :model-value="formatRupiah(grandTotal)"
          readonly
          variant="filled"
          density="compact"
          hide-details
          :class="[
            'total-field-highlight',
            grandTotal > 0
              ? 'text-success'
              : grandTotal < 0
                ? 'text-error'
                : '',
          ]"
        />
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
              @click="!item.kode && openLookup(index)"
              class="cursor-pointer font-weight-bold py-2 text-blue-darken-2"
            >
              {{ item.kode || "F1 = Cari" }}
            </div>
          </template>

          <template #[`item.stok`]="{ value }">{{
            formatNumber(value)
          }}</template>
          <template #[`item.hpp`]="{ value }">{{
            formatRupiah(value)
          }}</template>

          <template #[`item.jumlah`]="{ item }">
            <v-text-field
              v-model.number="item.jumlah"
              type="number"
              variant="underlined"
              density="compact"
              hide-details
              class="text-right-input qty-real-input"
              color="primary"
              @focus="$event.target.select()"
              :disabled="!item.kode"
            />
          </template>

          <template #[`item.selisih`]="{ value }">
            <span
              :class="
                value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''
              "
              class="font-weight-bold"
              >{{ formatNumber(value) }}</span
            >
          </template>

          <template #[`item.total`]="{ value }">
            <span
              :class="
                value > 0 ? 'text-success' : value < 0 ? 'text-error' : ''
              "
              class="font-weight-bold"
              >{{ formatRupiah(value) }}</span
            >
          </template>

          <template #[`item.keterangan`]="{ item }">
            <v-text-field
              v-model="item.keterangan"
              variant="underlined"
              density="compact"
              hide-details
              placeholder="..."
              :disabled="!item.kode"
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
            ></v-btn>
          </template>

          <template #bottom></template>
        </v-data-table>
      </div>
    </template>
  </BaseForm>

  <v-dialog v-model="isPrintConfirmDialogVisible" persistent max-width="400px">
    <v-card class="rounded-lg">
      <v-card-title
        class="bg-success text-white text-subtitle-1 pa-4 d-flex align-center"
      >
        <v-icon color="white" class="mr-2">mdi-check-circle</v-icon> Berhasil
        Disimpan
      </v-card-title>
      <v-card-text class="pa-6 text-center">
        Koreksi Stok disimpan dengan Nomor:<br /><strong>{{
          savedNomorForPrint
        }}</strong
        ><br /><br />Apakah Anda ingin mencetak dokumen ini?
      </v-card-text>
      <v-card-actions class="pa-4 border-t">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="onPrintConfirmNo">Tidak (Tutup)</v-btn>
        <v-btn
          color="success"
          variant="elevated"
          prepend-icon="mdi-printer"
          @click="onPrintConfirmYes"
          >Ya, Cetak</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="isPrintPreviewVisible"
    persistent
    max-width="900px"
    scrollable
  >
    <v-card>
      <v-toolbar color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-2 font-weight-bold"
          >Pratinjau Cetak:
          {{ printPreviewData?.header?.nomor }}</v-toolbar-title
        >
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="closePreviewAndNavigate"></v-btn>
      </v-toolbar>
      <v-card-text id="print-area" class="pa-4 bg-grey-lighten-4">
        <div
          v-if="printPreviewData"
          class="print-layout mx-auto elevation-2 bg-white"
        >
          <header class="print-header">
            <img :src="logoUrl" class="print-logo" />
            <div class="company-info">
              <strong>{{ printPreviewData.header.perusahaanNama }}</strong
              ><br />
              <span>{{ printPreviewData.header.perusahaanAlamat }}</span
              ><br />
              <span>Telp: {{ printPreviewData.header.perusahaanTelp }}</span>
            </div>
          </header>
          <h1 class="print-title">Koreksi Stok</h1>
          <table class="header-table">
            <tr>
              <td>Nomor</td>
              <td>: {{ printPreviewData.header.nomor }}</td>
            </tr>
            <tr>
              <td>Tanggal</td>
              <td>: {{ printPreviewData.header.tanggal }}</td>
            </tr>
            <tr>
              <td>Keterangan</td>
              <td>: {{ printPreviewData.header.keterangan }}</td>
            </tr>
          </table>
          <table class="detail-table-print">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Barang</th>
                <th>Ukuran</th>
                <th>Stok</th>
                <th>Koreksi</th>
                <th>Selisih</th>
                <th>Nominal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in printPreviewData.details" :key="d.no">
                <td>{{ d.no }}</td>
                <td>{{ d.nama }}</td>
                <td class="text-center">{{ d.ukuran }}</td>
                <td class="text-end">{{ formatNumber(d.stok) }}</td>
                <td class="text-end">{{ formatNumber(d.koreksi) }}</td>
                <td class="text-end">{{ formatNumber(d.selisih) }}</td>
                <td class="text-end">{{ formatRupiah(d.nominal) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="6" class="text-end font-weight-bold">
                  Total Nominal:
                </td>
                <td class="text-end font-weight-bold">
                  {{ formatRupiah(printPreviewData.totalNominal) }}
                </td>
              </tr>
            </tfoot>
          </table>
          <footer class="print-footer">
            <div>
              Dibuat Oleh,<br /><br /><br />(
              {{ printPreviewData.header.userNama }} )
            </div>
            <div>Mengetahui,<br /><br /><br />( .................... )</div>
          </footer>
        </div>
      </v-card-text>
      <v-card-actions class="pa-4 border-t bg-white">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="closePreviewAndNavigate">Selesai</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-printer"
          @click="triggerBrowserPrint"
          >Cetak via Browser</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>

  <ItemLookupModal
    v-model="isLookupVisible"
    source="koreksi-stok"
    :tanggal="formHeader.tanggal"
    @item-selected="onItemSelected"
  />
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

/* --- STYLING UNTUK DIALOG PRINT PREVIEW --- */
.print-layout {
  font-family: Arial, sans-serif;
  font-size: 9pt;
  width: 210mm;
  min-height: 200mm;
  margin: auto;
  padding: 1cm;
  color: #000;
}
.print-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}
.print-logo {
  width: 45px;
  height: 45px;
  margin-right: 12px;
  object-fit: contain;
}
.company-info {
  font-size: 8pt;
  line-height: 1.3;
}
.company-info strong {
  font-size: 10pt;
}
.print-title {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  text-decoration: underline;
  margin-bottom: 15px;
  margin-top: 5px;
}
.header-table {
  width: 100%;
  font-size: 9pt;
  margin-bottom: 15px;
  border-collapse: collapse;
}
.header-table td {
  padding: 2px 5px;
  vertical-align: top;
}
.header-table td:first-child {
  width: 15%;
  white-space: nowrap;
}
.header-table td:nth-child(2) {
  width: 1%;
}
.detail-table-print {
  width: 100%;
  font-size: 9pt;
  border-collapse: collapse;
  margin-bottom: 15px;
}
.detail-table-print th,
.detail-table-print td {
  border: 1px solid #000;
  padding: 5px;
}
.detail-table-print th {
  background-color: #f0f0f0;
  text-align: center;
  font-weight: bold;
}
.detail-table-print .text-center {
  text-align: center;
}
.detail-table-print .text-end {
  text-align: right;
}
.print-footer {
  margin-top: 30px;
  display: flex;
  justify-content: space-around;
  text-align: center;
  font-size: 9pt;
}
</style>
