<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { format } from "date-fns";
import { formatRupiah } from "@/utils/formatRupiah";

// Components & Composables
import BaseForm from "@/components/BaseForm.vue";
import CustomerSearchModal from "@/components/lookup/CustomerSearchModal.vue";
import BankSearchModal from "@/components/lookup/BankSearchModal.vue";
import ItemLookupModal from "@/components/lookup/ItemLookupModal.vue";
import PaymentModal from "@/components/PaymentModal.vue";
import KasirPrintPreviewModal from "@/components/KasirPrintPreviewModal.vue";
import { useForm } from "@/composables/useForm";

const router = useRouter();
const toast = useToast();
const MENU_ID = "31";

// 1. Setup Composable dengan Rute Pulang
const {
  isEditMode,
  isSaving,
  isLoading,
  showSaveDialog,
  showCancelDialog,
  showCloseDialog,
  executeClose,
  goBack,
} = useForm({
  menuId: MENU_ID,
  initialData: {},
  onSuccessRoute: "/transaksi/kasir",
  submitApi: async () => {}, // Dikosongkan karena kita pakai custom executeSave
});

const pageTitle = computed(() =>
  isEditMode.value ? "Ubah Invoice" : "Kasir Baru / Input Invoice",
);

// 2. State Form Header
const formHeader = ref({
  nomor: "",
  tanggal: format(new Date(), "yyyy-MM-dd"),
  kdCus: "",
  namaCus: "",
  diskonGlobal: 0,
  biayaKirim: 0,
  rpTunai: 0,
  rpCard: 0,
  noRek: "",
  namaBank: "",
  pundiAmal: 0,
  kembalian: 0,
  keterangan: "",
});

// 3. State Grid Detail & Pendukung
const items = ref<any[]>([]);
const nextItemId = ref(1);
const scanBarcode = ref("");
const isLookupLoading = ref(false);

// State Modal Lookup
const showCustomerModal = ref(false);
const showBankModal = ref(false);
const isItemLookupVisible = ref(false);

// State Modal Transaksi
const showPaymentModal = ref(false);
const showPrintModal = ref(false);
const savedInvoiceNomor = ref("");

// State Modal Konfirmasi Khusus Kasir
const isConfirmDialogVisible = ref(false);
const confirmTitle = ref("Konfirmasi");
const confirmText = ref("Yakin ingin memproses transaksi ini?");

// Header Tabel Grid
const tableHeaders = [
  { title: "#", key: "no", sortable: false, width: "40px" },
  { title: "BARCODE", key: "barcode", width: "130px" },
  { title: "NAMA BARANG", key: "nama", minWidth: "250px" },
  { title: "SIZE", key: "ukuran", align: "center" as const, width: "80px" },
  { title: "STOK", key: "stok", align: "end" as const, width: "80px" },
  { title: "QTY", key: "jumlah", align: "end" as const, width: "90px" },
  { title: "HARGA", key: "harga", align: "end" as const, width: "120px" },
  { title: "DISC", key: "diskon", align: "end" as const, width: "100px" },
  { title: "TOTAL", key: "total", align: "end" as const, width: "130px" },
  {
    title: "AKSI",
    key: "actions",
    sortable: false,
    width: "50px",
    align: "center" as const,
  },
];

// --- 4. Logic Perhitungan dengan Math.round() ---
const subTotal = computed(() =>
  items.value.reduce((acc, item) => acc + (item.total || 0), 0),
);

const grandTotal = computed(() =>
  Math.round(
    subTotal.value -
      (formHeader.value.diskonGlobal || 0) +
      (formHeader.value.biayaKirim || 0),
  ),
);

const calculateItemTotal = (item: any) => {
  item.total = Math.round(
    (item.jumlah || 0) * ((item.harga || 0) - (item.diskon || 0)),
  );
};

watch(items, () => items.value.forEach(calculateItemTotal), { deep: true });

// --- 5. Lookup & Scan Logic ---
const handleGlobalKeyDown = (event: KeyboardEvent) => {
  if (event.key === "F1") {
    event.preventDefault();
    if (!formHeader.value.kdCus)
      return toast.warning("Pilih customer dulu sebelum mencari barang.");
    isItemLookupVisible.value = true;
  }
};

const onScanBarcode = async () => {
  if (!scanBarcode.value.trim() || isLookupLoading.value) return;
  if (!formHeader.value.kdCus) {
    toast.warning("Pilih customer dulu!");
    scanBarcode.value = "";
    return;
  }

  const barcode = scanBarcode.value.trim();
  isLookupLoading.value = true;

  try {
    const existingItem = items.value.find((i) => i.barcode === barcode);
    if (existingItem) {
      existingItem.jumlah = (existingItem.jumlah || 0) + 1;
      scanBarcode.value = "";
      return;
    }

    const response = await api.get(`/pembelian/lookup/barcode/${barcode}`);
    const res = response.data;

    items.value.unshift({
      id: nextItemId.value++,
      kode: res.kode,
      barcode: res.barcode,
      nama: res.nama,
      ukuran: res.ukuran,
      stok: res.stok || 0,
      jumlah: 1,
      harga: res.jual,
      hpp: res.hpp || 0,
      diskon: 0,
      total: res.jual,
    });
    scanBarcode.value = "";
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Barcode tidak ditemukan.");
  } finally {
    isLookupLoading.value = false;
  }
};

const onItemSelected = (selectedItem: any) => {
  const existing = items.value.find(
    (i) => i.barcode === selectedItem.barcode || i.kode === selectedItem.kode,
  );
  if (existing) {
    existing.jumlah = (existing.jumlah ?? 0) + 1;
    toast.info(`Jumlah ${selectedItem.nama} ditambah.`);
  } else {
    items.value.unshift({
      id: nextItemId.value++,
      kode: selectedItem.kode,
      barcode: selectedItem.barcode || "",
      nama: selectedItem.nama,
      ukuran: selectedItem.ukuran || "",
      stok: selectedItem.stok || 0,
      jumlah: 1,
      harga: selectedItem.harga || selectedItem.hpp || 0,
      hpp: selectedItem.hpp || 0,
      diskon: 0,
      total: selectedItem.harga || selectedItem.hpp || 0,
    });
    toast.success(`${selectedItem.nama} ditambahkan.`);
  }
};

// --- 6. Save & Payment Logic ---
const openPayment = () => {
  if (items.value.length === 0) return toast.error("Barang masih kosong!");
  if (!formHeader.value.kdCus) return toast.error("Pilih customer dulu!");

  const overStockItem = items.value.find(
    (item) => (item.jumlah || 0) > item.stok,
  );
  if (overStockItem)
    return toast.error(
      `Stok tidak cukup untuk: ${overStockItem.nama} (${overStockItem.ukuran}). Sisa stok: ${overStockItem.stok}`,
    );

  showPaymentModal.value = true;
};

const handleFinalSave = async (paymentData: any) => {
  const gtot = grandTotal.value;
  const bayar = (paymentData.rpTunai || 0) + (paymentData.rpCard || 0);

  formHeader.value.rpTunai = paymentData.rpTunai;
  formHeader.value.rpCard = paymentData.rpCard;
  formHeader.value.noRek = paymentData.noRek;
  formHeader.value.pundiAmal = paymentData.pundiAmal;
  formHeader.value.kembalian = paymentData.kembalian;

  if (
    paymentData.rpCard !== 0 &&
    (!paymentData.noRek || paymentData.noRek.trim() === "")
  ) {
    return toast.warning("No. Rekening harus diisi untuk pembayaran kartu.");
  }

  if (bayar !== 0 && bayar < gtot) {
    confirmTitle.value = "Konfirmasi Pembayaran";
    confirmText.value = `Total bayar kurang ${formatRupiah(gtot - bayar)}. Akan tetap disimpan?`;
  } else {
    confirmTitle.value = "Konfirmasi Simpan";
    confirmText.value = "Yakin ingin memproses transaksi ini?";
  }

  isConfirmDialogVisible.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      items: items.value.filter((item) => (item.jumlah || 0) > 0),
      isNew: !isEditMode.value,
    };
    const response = await api.post("/kasir/save", payload);

    savedInvoiceNomor.value = response.data.nomor;
    toast.success(response.data.message || "Invoice berhasil disimpan.");

    isConfirmDialogVisible.value = false;
    showPaymentModal.value = false;

    await nextTick();
    showPrintModal.value = true;
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menyimpan invoice.");
  } finally {
    isSaving.value = false;
  }
};

const handleConfirmCancel = () => {
  showCancelDialog.value = false;
  formHeader.value = {
    nomor: "",
    tanggal: format(new Date(), "yyyy-MM-dd"),
    kdCus: "",
    namaCus: "",
    diskonGlobal: 0,
    biayaKirim: 0,
    rpTunai: 0,
    rpCard: 0,
    noRek: "",
    namaBank: "",
    pundiAmal: 0,
    kembalian: 0,
    keterangan: "",
  };
  items.value = [];
  toast.info("Inputan di-reset.");
};

const onPrintModalClosed = () => {
  showPrintModal.value = false;
  goBack();
};

// --- 7. Lifecycle ---
onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeyDown);
  isLoading.value = false; // Karena kasir biasa form baru
});
onUnmounted(() => window.removeEventListener("keydown", handleGlobalKeyDown));
</script>

<template>
  <BaseForm
    :title="pageTitle"
    menu-id="31"
    icon="mdi-cash-register"
    :is-loading="isLoading"
    :is-saving="isSaving"
    v-model:show-save-dialog="showSaveDialog"
    v-model:show-cancel-dialog="showCancelDialog"
    v-model:show-close-dialog="showCloseDialog"
    @validate-save="openPayment"
    @confirm-cancel="handleConfirmCancel"
    @confirm-close="executeClose"
  >
    <template #left-column>
      <div class="desktop-form-section header-section border-l-primary mb-3">
        <v-text-field
          label="No. Invoice"
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
        />
        <v-text-field
          label="Customer *"
          v-model="formHeader.namaCus"
          readonly
          variant="outlined"
          density="compact"
          hide-details
          prepend-inner-icon="mdi-account"
          append-inner-icon="mdi-magnify"
          @click="showCustomerModal = true"
          class="cursor-pointer bg-white"
          placeholder="Pilih Customer"
        />
      </div>

      <div
        class="desktop-form-section bg-grey-lighten-4 pa-4 rounded-lg border"
      >
        <div
          class="d-flex justify-space-between align-center mb-2 font-weight-bold text-grey-darken-2"
        >
          <span>Subtotal</span> <span>{{ formatRupiah(subTotal) }}</span>
        </div>
        <div
          class="d-flex justify-space-between align-center mb-2 font-weight-bold text-grey-darken-2"
        >
          <span>Diskon Global</span>
          <v-text-field
            v-model.number="formHeader.diskonGlobal"
            type="number"
            density="compact"
            hide-details
            variant="underlined"
            class="small-input text-right-input text-primary"
            @focus="$event.target.select()"
          />
        </div>
        <div
          class="d-flex justify-space-between align-center mb-3 font-weight-bold text-grey-darken-2"
        >
          <span>Biaya Kirim</span>
          <v-text-field
            v-model.number="formHeader.biayaKirim"
            type="number"
            density="compact"
            hide-details
            variant="underlined"
            class="small-input text-right-input text-primary"
            @focus="$event.target.select()"
          />
        </div>
        <v-divider class="my-2 border-opacity-50"></v-divider>
        <div
          class="d-flex justify-space-between align-center text-h6 font-weight-black text-primary mt-2"
        >
          <span>TOTAL</span> <span>{{ formatRupiah(grandTotal) }}</span>
        </div>
      </div>
    </template>

    <template #right-column>
      <div class="d-flex flex-column fill-height">
        <div
          class="desktop-form-section mb-3 pa-2 bg-blue-lighten-5 border-primary border-opacity-50"
        >
          <div class="d-flex align-center">
            <div class="mr-3 ml-2 d-flex align-center">
              <v-kbd
                class="bg-white text-primary border px-2 py-1 rounded font-weight-bold shadow-sm"
                >F1</v-kbd
              >
            </div>
            <v-text-field
              v-model="scanBarcode"
              placeholder="Scan barcode di sini... (Atau tekan F1)"
              prepend-inner-icon="mdi-barcode-scan"
              variant="plain"
              hide-details
              class="px-4 py-1 barcode-scanner flex-grow-1"
              autofocus
              @keyup.enter="onScanBarcode"
            />
            <v-btn
              variant="text"
              color="primary"
              icon="mdi-text-search"
              @click="
                () =>
                  formHeader.kdCus
                    ? (isItemLookupVisible = true)
                    : toast.warning('Pilih customer dulu!')
              "
            ></v-btn>
          </div>
        </div>

        <div
          class="desktop-form-section pa-0 overflow-hidden flex-grow-1 elevation-1"
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

            <template #[`item.stok`]="{ item }">
              <span
                :class="
                  item.stok - (item.jumlah || 0) < 0
                    ? 'text-error font-weight-bold'
                    : ''
                "
              >
                {{ item.stok }}
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
                :color="(item.jumlah || 0) > item.stok ? 'error' : 'primary'"
                @focus="$event.target.select()"
              />
            </template>

            <template #[`item.harga`]="{ value }">{{
              formatRupiah(value)
            }}</template>

            <template #[`item.diskon`]="{ item }">
              <v-text-field
                v-model.number="item.diskon"
                type="number"
                variant="underlined"
                density="compact"
                hide-details
                class="text-right-input text-error"
                @focus="$event.target.select()"
              />
            </template>

            <template #[`item.total`]="{ value }">
              <span class="font-weight-bold text-primary">{{
                formatRupiah(value)
              }}</span>
            </template>

            <template #[`item.actions`]="{ item }">
              <v-icon
                size="small"
                color="error"
                class="cursor-pointer"
                @click="items = items.filter((i) => i.id !== item.id)"
                >mdi-delete</v-icon
              >
            </template>
            <template #bottom></template>
          </v-data-table>
        </div>
      </div>
    </template>
  </BaseForm>

  <CustomerSearchModal
    v-model="showCustomerModal"
    @customer-selected="
      (c) => {
        formHeader.kdCus = c.Kode;
        formHeader.namaCus = c.Nama;
      }
    "
  />
  <BankSearchModal
    v-model="showBankModal"
    @bank-selected="
      (b) => {
        formHeader.noRek = b.NoRekening;
        formHeader.namaBank = b.NamaBank;
      }
    "
  />
  <ItemLookupModal
    v-model="isItemLookupVisible"
    source="kasir"
    @item-selected="onItemSelected"
  />

  <PaymentModal
    v-model="showPaymentModal"
    :total-invoice="grandTotal"
    @confirm-payment="handleFinalSave"
  />

  <KasirPrintPreviewModal
    v-model="showPrintModal"
    :nomor-invoice="savedInvoiceNomor"
    @update:modelValue="(val) => !val && onPrintModalClosed()"
  />

  <v-dialog v-model="isConfirmDialogVisible" max-width="400px" persistent>
    <v-card class="rounded-lg">
      <v-card-title
        class="bg-primary text-white text-subtitle-1 pa-4 d-flex align-center"
      >
        <v-icon color="white" class="mr-2">mdi-help-circle</v-icon>
        {{ confirmTitle }}
      </v-card-title>
      <v-card-text class="pa-6 text-center font-weight-medium">{{
        confirmText
      }}</v-card-text>
      <v-card-actions class="pa-4 border-t">
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          @click="isConfirmDialogVisible = false"
          :disabled="isSaving"
          >Tidak</v-btn
        >
        <v-btn
          color="primary"
          variant="elevated"
          @click="executeSave"
          :loading="isSaving"
          >Ya, Simpan</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.text-right-input :deep(input) {
  text-align: right;
  font-weight: bold;
}
.small-input {
  max-width: 90px;
}
.small-input :deep(input) {
  text-align: right;
  padding: 0;
  font-weight: bold;
}
.border-l-primary {
  border-left: 4px solid #1976d2 !important;
}
.barcode-scanner :deep(input) {
  font-size: 13px !important;
  font-weight: bold;
  color: #1976d2;
}
.cursor-pointer :deep(input) {
  cursor: pointer;
}
.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
