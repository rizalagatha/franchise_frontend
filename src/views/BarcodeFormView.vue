<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from "vue";
import { useForm } from "@/composables/useForm";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { format } from "date-fns";
import JsBarcode from "jsbarcode";

// Components
import BaseForm from "@/components/BaseForm.vue";
import ItemLookupModal from "@/components/lookup/ItemLookupModal.vue";

const toast = useToast();

// --- Setup Composable Logic (NEW) ---
const {
  isEditMode,
  isLoading,
  isSaving,
  showSaveDialog,
  showCancelDialog,
  showCloseDialog,
  executeClose,
  goBack,
  params,
} = useForm({
  menuId: "13",
  initialData: {},
  onSuccessRoute: "/daftar/cetak-barcode", // <--- GPS Pulang
  submitApi: async () => {}, // Dikosongkan karena kita override fungsi save-nya di bawah
});

// --- State Utama ---
const formHeader = ref({
  nomor: "",
  tanggal: format(new Date(), "yyyy-MM-dd"),
});
const items = ref<any[]>([]);
const nextItemId = ref(1);
const searchTerm = ref("");
const isLookupVisible = ref(false);

// --- State Printing ---
const selectedPrinter = ref("XP-360B");
const showPriceOnLabel = ref(false);
const isPrintPreviewVisible = ref(false);
const printPreviewData = ref<any[]>([]);
const isPreviewFromSave = ref(false);

const headers = [
  { title: "#", key: "no", width: "50px" },
  { title: "KODE BARANG", key: "kode", width: "120px" },
  { title: "BARCODE", key: "barcode", width: "130px" },
  { title: "NAMA BARANG", key: "nama", minWidth: "250px" },
  { title: "SIZE", key: "ukuran", align: "center" as const, width: "80px" },
  { title: "HARGA", key: "harga", align: "end" as const, width: "100px" },
  { title: "JUMLAH", key: "jumlah", align: "end" as const, width: "100px" },
  {
    title: "AKSI",
    key: "actions",
    sortable: false,
    width: "50px",
    align: "center" as const,
  },
];

// --- Logic Actions ---
const validateForm = () => {
  const validItems = items.value.filter((i) => i.kode && (i.jumlah || 0) > 0);
  if (validItems.length === 0)
    return toast.warning("Item tidak valid / jumlah kosong.");

  showSaveDialog.value = true;
};

// Override manual agar bisa buka preview cetak setelah sukses simpan
const executeSave = async () => {
  const validItems = items.value.filter((i) => i.kode && (i.jumlah || 0) > 0);
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      items: validItems,
      isNew: !isEditMode.value,
    };
    const res = await api.post("/barcodes/save", payload);
    toast.success("Berhasil disimpan!");

    showSaveDialog.value = false;

    // Set penanda TRUE karena ini dari proses simpan
    isPreviewFromSave.value = true;
    preparePrint(validItems, res.data.nomor);
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Gagal simpan data.");
  } finally {
    isSaving.value = false;
  }
};

const handleConfirmCancel = () => {
  showCancelDialog.value = false;
  if (isEditMode.value) {
    loadData(params.nomor as string);
  } else {
    formHeader.value = {
      nomor: "",
      tanggal: format(new Date(), "yyyy-MM-dd"),
    };
    items.value = [];
    searchTerm.value = "";
    addEmptyRow();
  }
  toast.info("Form di-reset.");
};

// --- Logic Detail & Print ---
const addEmptyRow = () =>
  items.value.push({
    id: nextItemId.value++,
    kode: "",
    barcode: "",
    nama: "",
    ukuran: "",
    harga: null,
    jumlah: null,
  });

const loadData = async (nomor: string) => {
  isLoading.value = true;
  try {
    const res = await api.get(`/barcodes/form/${nomor}`);
    formHeader.value = {
      nomor: res.data.header.bch_nomor,
      tanggal: res.data.header.bch_tanggal,
    };
    items.value = res.data.items.map((i: any) => ({
      ...i,
      id: nextItemId.value++,
    }));
    if (items.value.length === 0) addEmptyRow();
  } finally {
    isLoading.value = false;
  }
};

const onItemSelected = async (selected: any) => {
  isLookupVisible.value = false;
  isLoading.value = true;
  try {
    const res = await api.get(
      `/barcodes/details/${encodeURIComponent(selected.kode)}`,
    );
    if (items.value.length > 0 && !items.value[items.value.length - 1].kode)
      items.value.pop();
    res.data.forEach((v: any) => {
      if (
        !items.value.some((ex) => ex.kode === v.kode && ex.ukuran === v.ukuran)
      ) {
        items.value.push({ id: nextItemId.value++, ...v, jumlah: 1 });
      }
    });
    addEmptyRow();
  } finally {
    isLoading.value = false;
  }
};

const preparePrint = (validItems: any[], nomor: string) => {
  const labels: any[] = [];
  validItems.forEach((item) => {
    for (let i = 0; i < (item.jumlah || 0); i++) {
      labels.push({
        ...item,
        nomor,
        tgl: format(new Date(formHeader.value.tanggal), "dd/MM/yy"),
        charga: showPriceOnLabel.value
          ? `Rp ${new Intl.NumberFormat("id-ID").format(item.harga || 0)}`
          : "",
      });
    }
  });
  printPreviewData.value = labels;
  isPrintPreviewVisible.value = true;
};

const generateBarcodesInPreview = async () => {
  await nextTick();
  const svgs = document.querySelectorAll<SVGElement>(".barcode-svg");
  svgs.forEach((svg) => {
    const val = svg.getAttribute("data-barcode-value");
    if (val)
      JsBarcode(svg, val, {
        format: "CODE128",
        width: 1,
        height: 25,
        displayValue: false,
        margin: 0,
      });
  });
};

// --- Fungsi Khusus Tes Printer ---
const handleTesPrinter = () => {
  const dummyItems = [
    {
      kode: "DUMMY-001",
      barcode: "123456789012",
      nama: "KAOS DUMMY TES KALIBRASI PRINTER",
      ukuran: "ALL SIZE",
      harga: 99000,
      jumlah: 2,
    },
  ];
  // Set penanda FALSE karena ini cuma tes printer
  isPreviewFromSave.value = false;
  preparePrint(dummyItems, "TES-PRINT");
};

const closePrintPreview = () => {
  isPrintPreviewVisible.value = false;
  // Kalau asalnya dari klik "Simpan", baru kita balik ke browse
  if (isPreviewFromSave.value) {
    goBack();
  }
};

const printStyles = `
  @page { size: 68mm 15mm landscape; margin: 0; }
  html, body { margin: 0; padding: 0; width: 68mm; height: 15mm; font-family: Arial; transform: rotate(180deg); transform-origin: center; }
  .label-pair-container-preview { display: flex; justify-content: space-between; width: 68mm; height: 15mm; page-break-after: always; }
  .preview-label-box { width: 33mm; height: 15mm; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 5px; text-align: center; }
  .barcode-svg { width: 28mm; height: 7mm; }
  .label-footer-preview { display: flex; justify-content: space-between; width: 90%; font-size: 4px; }
`;

const triggerPrint = () => {
  const printContent = document.getElementById("print-area");
  if (!printContent) {
    toast.error("Area cetak tidak ditemukan");
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(`
      <html>
        <head><style>${printStyles}</style></head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    doc.close();

    const iframeSvgs = doc.querySelectorAll(".barcode-svg");
    iframeSvgs.forEach((s: any) => {
      const val = s.getAttribute("data-barcode-value");
      if (val) {
        JsBarcode(s, val, {
          format: "CODE128",
          width: 1,
          height: 25,
          displayValue: false,
          margin: 0,
        });
      }
    });

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);

      closePrintPreview();
    }, 500);
  }
};

onMounted(() => {
  if (isEditMode.value) loadData(params.nomor as string);
  else addEmptyRow();
});

watch(isPrintPreviewVisible, (val) => {
  if (val) setTimeout(generateBarcodesInPreview, 300);
});
</script>

<template>
  <BaseForm
    :title="isEditMode ? 'Ubah Cetak Barcode' : 'Buat Cetak Barcode'"
    menu-id="13"
    icon="mdi-barcode-scan"
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
          label="Nomor"
          v-model="formHeader.nomor"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="mb-3"
        />
        <v-text-field
          label="Tanggal"
          v-model="formHeader.tanggal"
          type="date"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-3 bg-white"
        />
        <v-text-field
          label="Cari Barang (F1)"
          v-model="searchTerm"
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-magnify"
          hide-details
          class="bg-white"
          @click:prepend-inner="isLookupVisible = true"
        />
      </div>

      <div class="desktop-form-section border-l-primary" v-if="!isLoading">
        <div class="d-flex align-center justify-space-between mb-3">
          <span class="text-caption font-weight-bold text-primary"
            >PENGATURAN LABEL</span
          >
          <v-btn
            size="x-small"
            color="grey-darken-3"
            @click="handleTesPrinter"
            prepend-icon="mdi-printer-check"
          >
            Tes Printer
          </v-btn>
        </div>
        <v-radio-group
          v-model="selectedPrinter"
          inline
          density="compact"
          hide-details
          color="primary"
          class="mb-1"
        >
          <v-radio label="XP-360B (A)" value="XP-360B"></v-radio>
          <v-radio label="360B (B)" value="360B"></v-radio>
        </v-radio-group>
        <v-checkbox
          v-model="showPriceOnLabel"
          label="Tampilkan Harga Jual"
          density="compact"
          hide-details
          color="primary"
          class="mt-n2"
        />
      </div>
    </template>

    <template #right-column>
      <div
        class="desktop-form-section pa-0 overflow-hidden fill-height elevation-1"
        v-if="!isLoading"
      >
        <v-data-table
          :headers="headers"
          :items="items"
          density="compact"
          class="desktop-table colored-header zebra-table"
          fixed-header
          :items-per-page="-1"
          hide-default-footer
        >
          <template #[`item.no`]="{ index }">{{ index + 1 }}</template>

          <template #[`item.kode`]="{ item }">
            <div
              @click="!item.kode && (isLookupVisible = true)"
              class="cursor-pointer font-weight-bold py-2"
            >
              {{ item.kode || "F1 = Cari Barang" }}
            </div>
          </template>

          <template #[`item.harga`]="{ value }">
            <span class="text-primary font-weight-bold">
              {{ value ? "Rp " + value.toLocaleString("id-ID") : "-" }}
            </span>
          </template>

          <template #[`item.jumlah`]="{ item }">
            <v-text-field
              v-model.number="item.jumlah"
              type="number"
              variant="underlined"
              density="compact"
              hide-details
              class="text-right-input"
              color="primary"
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

  <v-dialog
    v-model="isPrintPreviewVisible"
    max-width="700px"
    scrollable
    persistent
  >
    <v-card class="rounded-xl">
      <v-toolbar color="primary" density="compact">
        <v-icon class="ml-4 mr-2">mdi-printer-eye</v-icon>
        <span class="text-subtitle-2 font-weight-bold"
          >PRATINJAU CETAK BARCODE</span
        >
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" size="small" @click="closePrintPreview"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-6 bg-grey-lighten-4">
        <div id="print-area" class="d-flex flex-column align-center ga-3">
          <div
            v-for="i in Math.ceil(printPreviewData.length / 2)"
            :key="i"
            class="d-flex ga-2"
          >
            <div v-for="j in [0, 1]" :key="j" class="preview-label-box">
              <template v-if="printPreviewData[(i - 1) * 2 + j]">
                <div class="text-bold">
                  {{ printPreviewData[(i - 1) * 2 + j].nama }}
                </div>
                <div class="text-small">
                  {{ printPreviewData[(i - 1) * 2 + j].ukuran }}
                </div>
                <svg
                  class="barcode-svg"
                  :data-barcode-value="
                    printPreviewData[(i - 1) * 2 + j].barcode
                  "
                ></svg>
                <div class="label-footer-preview">
                  <span>{{ printPreviewData[(i - 1) * 2 + j].barcode }}</span>
                  <span class="font-weight-black">{{
                    printPreviewData[(i - 1) * 2 + j].charga
                  }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-card-actions class="pa-4 border-t bg-white">
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="closePrintPreview">Selesai</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-printer"
          @click="triggerPrint"
          >Cetak Sekarang</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>

  <ItemLookupModal
    v-model="isLookupVisible"
    source="barcode"
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

.desktop-table :deep(td) {
  border-right: 1px solid #e0e0e0;
}

.text-right-input :deep(input) {
  text-align: right;
  font-weight: bold;
  color: #1976d2;
}
.cursor-pointer {
  cursor: pointer;
}
.border-l-primary {
  border-left: 4px solid #1976d2 !important;
}

/* Preview Styles */
.preview-label-box {
  width: 180px;
  height: 95px;
  background: white;
  border: 1px dashed #ccc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px;
  font-size: 8px;
}
.label-footer-preview {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 7px;
  margin-top: 2px;
}
.text-bold {
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: center;
}
</style>
