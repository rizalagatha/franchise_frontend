<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, nextTick } from "vue";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { format } from "date-fns";
import { formatRupiah } from "@/utils/formatRupiah";

// Components & Composables
import BaseForm from "@/components/BaseForm.vue";
import CustomerSearchModal from "@/components/lookup/CustomerSearchModal.vue";
import BankSearchModal from "@/components/lookup/BankSearchModal.vue";
import SetoranPembayaranPrintModal from "@/components/SetoranPembayaranPrintModal.vue";
import { useForm } from "@/composables/useForm";

const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = "33";

// 1. Setup Composable Logic (NEW)
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
  onSuccessRoute: "/transaksi/setoran-pembayaran", // GPS Pulang
  submitApi: async () => {}, // Dioverride di executeSave khusus
});

const pageTitle = computed(() =>
  isEditMode.value ? "Ubah Setoran Pembayaran" : "Input Setoran Pembayaran",
);

// 2. State Form
const formHeader = ref({
  sh_nomor: "",
  sh_tanggal: format(new Date(), "yyyy-MM-dd"),
  sh_cus_kode: "",
  cus_nama: "",
  cus_alamat: "",
  cus_kota: "",
  cus_telp: "",
  sh_jenis: 0, // 0: TUNAI, 1: TRANSFER
  sh_nominal: 0,
  sh_norek: "",
  rek_namabank: "",
  sh_tgltransfer: format(new Date(), "yyyy-MM-dd"),
  sh_ket: "",
  user_create: authStore.user?.kode || "",
});

const items = ref<any[]>([]);

// Modals State
const showCusModal = ref(false);
const showBankModal = ref(false);
const showPrintModal = ref(false);
const savedInvoiceNomor = ref("");

// 3. Logic Perhitungan Otomatis (Math.round diterapkan)
const totalTerbayar = computed(() =>
  Math.round(
    items.value.reduce((acc, item) => acc + (Number(item.bayar) || 0), 0),
  ),
);

const sisaSetoran = computed(() =>
  Math.round((Number(formHeader.value.sh_nominal) || 0) - totalTerbayar.value),
);

// 4. API Calls
const fetchCustomer = async () => {
  if (!formHeader.value.sh_cus_kode) return;
  try {
    const res = await api.get(`/customer/${formHeader.value.sh_cus_kode}`);
    formHeader.value.cus_nama = res.data.cus_nama;
    formHeader.value.cus_alamat = res.data.cus_alamat;
    formHeader.value.cus_kota = res.data.cus_kota;
    formHeader.value.cus_telp = res.data.cus_telp;
    fetchUnpaidInvoices();
  } catch (error) {
    toast.error("Customer tidak ditemukan.");
  }
};

const fetchUnpaidInvoices = async () => {
  if (!formHeader.value.sh_cus_kode || isEditMode.value) return;
  try {
    const res = await api.get(
      `/setoran-pembayaran/unpaid/${formHeader.value.sh_cus_kode}`,
    );
    items.value = res.data.map((inv: any) => ({
      invoice: inv.Invoice,
      tanggal: inv.TglInvoice,
      nominal: Math.round(Number(inv.Nominal)),
      terbayar: Math.round(Number(inv.Bayar)),
      sisa_piutang: Math.round(Number(inv.Sisa)),
      bayar: 0,
      lunasi: false,
      tglbayar: format(new Date(), "yyyy-MM-dd"),
      ket: "",
      angsur: format(new Date(), "yyyyMMddHHmmss"),
    }));
  } catch (error) {
    toast.error("Gagal mengambil data piutang.");
  }
};

const fetchEditData = async () => {
  isLoading.value = true;
  try {
    const res = await api.get(`/setoran-pembayaran/${params.nomor}/form-data`);
    formHeader.value = {
      ...res.data.header,
      sh_nominal: Math.round(Number(res.data.header.sh_nominal)),
      sh_tanggal: format(new Date(res.data.header.sh_tanggal), "yyyy-MM-dd"),
      sh_tgltransfer: res.data.header.sh_tgltransfer
        ? format(new Date(res.data.header.sh_tgltransfer), "yyyy-MM-dd")
        : "",
    };
    items.value = res.data.details.map((d: any) => ({
      ...d,
      nominal: Math.round(Number(d.nominal)),
      terbayar: Math.round(Number(d.terbayar)),
      sisa_piutang: Math.round(Number(d.sisa_piutang)),
      bayar: Math.round(Number(d.bayar)),
      lunasi: false,
    }));
  } catch (error) {
    toast.error("Gagal memuat data edit.");
    goBack();
  } finally {
    isLoading.value = false;
  }
};

// 5. User Actions & Events
const onCustomerSelected = (cus: any) => {
  formHeader.value.sh_cus_kode = cus.Kode;
  formHeader.value.cus_nama = cus.Nama;
  formHeader.value.cus_alamat = cus.Alamat;
  formHeader.value.cus_kota = cus.Kota;
  fetchUnpaidInvoices();
};

const onBankSelected = (bank: any) => {
  formHeader.value.sh_norek = bank.NoRekening;
  formHeader.value.rek_namabank = bank.NamaBank;
};

const handleLunasiChange = (index: number) => {
  const item = items.value[index];
  if (!item) return;
  if (item.lunasi) {
    const available = sisaSetoran.value + Number(item.bayar);
    item.bayar = Math.min(item.sisa_piutang, available);
  } else {
    item.bayar = 0;
  }
};

const removeItem = (index: number) => {
  items.value.splice(index, 1);
  toast.success("Baris tagihan dihapus.");
};

// 6. Fitur F2 (PLL)
const handleF2 = (event: KeyboardEvent) => {
  if (event.key === "F2") {
    event.preventDefault();
    tambahPLL();
  }
};

const tambahPLL = () => {
  if (!formHeader.value.sh_cus_kode)
    return toast.warning("Pilih customer terlebih dahulu.");
  if (sisaSetoran.value <= 0)
    return toast.warning("Tidak ada sisa setoran untuk dijadikan PLL.");

  if (
    window.confirm(
      `Jadikan sisa setoran (${formatRupiah(sisaSetoran.value)}) sebagai PLL?`,
    )
  ) {
    items.value.push({
      invoice: "PLL",
      tanggal: formHeader.value.sh_tanggal,
      nominal: 0,
      terbayar: 0,
      sisa_piutang: 0,
      bayar: sisaSetoran.value,
      lunasi: true,
      tglbayar: formHeader.value.sh_tanggal,
      ket: "Penerimaan Lain-Lain",
      angsur: format(new Date(), "yyyyMMddHHmmss"),
    });
    toast.success("Baris PLL berhasil ditambahkan.");
  }
};

// 7. Save Logic (Disesuaikan untuk BaseForm)
const customWarningMsg = ref("");

const validateForm = () => {
  customWarningMsg.value = "";
  if (!formHeader.value.sh_cus_kode || formHeader.value.sh_nominal <= 0)
    return toast.error("Lengkapi data header dan nominal.");
  if (sisaSetoran.value < 0)
    return toast.error("Sisa pembayaran minus. Cek rincian pembayaran.");

  if (sisaSetoran.value > 0) {
    customWarningMsg.value = `Catatan: Masih ada sisa setoran ${formatRupiah(sisaSetoran.value)}`;
  }

  showSaveDialog.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      details: items.value.filter((i) => i.bayar > 0),
      isNew: !isEditMode.value,
    };
    const response = await api.post("/setoran-pembayaran/save", payload);

    savedInvoiceNomor.value = response.data.nomor || formHeader.value.sh_nomor;
    toast.success("Data setoran berhasil disimpan.");

    showSaveDialog.value = false;

    if (formHeader.value.sh_jenis === 0) {
      // Jika TUNAI, buka modal print
      await nextTick();
      showPrintModal.value = true;
    } else {
      // Jika TRANSFER, langsung kembali
      goBack();
    }
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

const handleConfirmCancel = () => {
  showCancelDialog.value = false;
  if (isEditMode.value) {
    fetchEditData();
  } else {
    formHeader.value = {
      sh_nomor: "",
      sh_tanggal: format(new Date(), "yyyy-MM-dd"),
      sh_cus_kode: "",
      cus_nama: "",
      cus_alamat: "",
      cus_kota: "",
      cus_telp: "",
      sh_jenis: 0,
      sh_nominal: 0,
      sh_norek: "",
      rek_namabank: "",
      sh_tgltransfer: format(new Date(), "yyyy-MM-dd"),
      sh_ket: "",
      user_create: authStore.user?.kode || "",
    };
    items.value = [];
  }
  toast.info("Inputan di-reset.");
};

const onPrintModalClosed = () => {
  showPrintModal.value = false;
  goBack();
};

// 8. Lifecycle
onMounted(() => {
  window.addEventListener("keydown", handleF2);
  if (isEditMode.value) fetchEditData();
  else isLoading.value = false;
});
onUnmounted(() => window.removeEventListener("keydown", handleF2));
</script>

<template>
  <BaseForm
    :title="pageTitle"
    menu-id="33"
    icon="mdi-cash-register"
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
    <template #header-actions>
      <div
        class="text-caption text-grey-darken-1 mr-4 d-flex align-center font-weight-bold"
      >
        <v-kbd class="bg-grey-lighten-2 text-primary border px-2 py-1 rounded"
          >F2</v-kbd
        >
        <span class="ml-2">Jadikan PLL</span>
      </div>
    </template>

    <template #left-column>
      <div
        class="desktop-form-section header-section border-l-primary mb-3"
        v-if="!isLoading"
      >
        <v-text-field
          label="Nomor Setoran"
          v-model="formHeader.sh_nomor"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="mb-2"
          placeholder="<Otomatis>"
        />
        <v-text-field
          label="Tanggal"
          v-model="formHeader.sh_tanggal"
          type="date"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2 bg-white"
        />

        <div class="d-flex align-center mb-2 mt-1">
          <v-text-field
            label="Customer (F1)"
            v-model="formHeader.sh_cus_kode"
            density="compact"
            hide-details
            variant="outlined"
            color="primary"
            @keyup.f1="showCusModal = true"
            @blur="fetchCustomer"
            class="bg-white"
          />
          <v-btn
            icon="mdi-magnify"
            size="small"
            variant="tonal"
            color="primary"
            class="ml-1"
            @click="showCusModal = true"
          ></v-btn>
        </div>
        <v-text-field
          label="Nama Customer"
          v-model="formHeader.cus_nama"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="mb-2 font-weight-bold"
        />
        <v-textarea
          label="Alamat"
          v-model="formHeader.cus_alamat"
          readonly
          variant="filled"
          density="compact"
          hide-details
          rows="2"
        />
      </div>

      <div
        class="desktop-form-section elevation-1 mb-3 bg-white"
        v-if="!isLoading"
      >
        <v-select
          label="Jenis Setoran"
          v-model="formHeader.sh_jenis"
          :items="[
            { title: 'TUNAI', value: 0 },
            { title: 'TRANSFER', value: 1 },
          ]"
          density="compact"
          hide-details
          variant="outlined"
          color="primary"
          class="mb-3"
        />

        <div
          v-if="formHeader.sh_jenis === 1"
          class="bg-blue-lighten-5 pa-3 rounded border border-primary border-opacity-25 mb-3"
        >
          <div class="d-flex align-center mb-2">
            <v-text-field
              label="No. Rekening (F1)"
              v-model="formHeader.sh_norek"
              density="compact"
              hide-details
              variant="outlined"
              color="primary"
              @keyup.f1="showBankModal = true"
              bg-color="white"
            />
            <v-btn
              icon="mdi-magnify"
              size="small"
              variant="tonal"
              color="primary"
              class="ml-1"
              @click="showBankModal = true"
            ></v-btn>
          </div>
          <v-text-field
            label="Bank"
            v-model="formHeader.rek_namabank"
            readonly
            variant="plain"
            density="compact"
            hide-details
            class="mb-1 font-weight-bold"
          />
          <v-text-field
            label="Tgl Transfer"
            v-model="formHeader.sh_tgltransfer"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            bg-color="white"
          />
        </div>

        <v-text-field
          label="NOMINAL SETOR *"
          v-model.number="formHeader.sh_nominal"
          type="number"
          density="compact"
          hide-details
          variant="outlined"
          color="primary"
          class="mb-2 nominal-input"
        />
        <v-text-field
          label="Keterangan"
          v-model="formHeader.sh_ket"
          density="compact"
          hide-details
          variant="outlined"
        />
      </div>

      <v-card
        class="elevation-1 pa-4 rounded-lg border-0 bg-white"
        v-if="!isLoading"
      >
        <div class="d-flex justify-space-between text-caption mb-1">
          <span class="text-grey-darken-1">Total Dibayarkan:</span>
          <span class="font-weight-bold">{{
            formatRupiah(totalTerbayar)
          }}</span>
        </div>
        <v-divider class="my-2"></v-divider>
        <div class="summary-box">
          <div
            class="text-caption text-grey-darken-1 font-weight-bold text-uppercase"
          >
            Sisa Setoran
          </div>
          <div
            :class="[
              'text-h5 font-weight-black text-right',
              sisaSetoran < 0 ? 'text-error' : 'text-primary',
            ]"
          >
            {{ formatRupiah(sisaSetoran) }}
          </div>
        </div>
      </v-card>
    </template>

    <template #right-column>
      <v-card
        class="elevation-1 rounded-lg flex-grow-1 overflow-hidden d-flex flex-column fill-height"
        v-if="!isLoading"
      >
        <v-table
          density="compact"
          fixed-header
          class="setor-table colored-header fill-height"
        >
          <thead>
            <tr>
              <th width="50">NO</th>
              <th>NO. INVOICE</th>
              <th>TGL INV</th>
              <th class="text-right">NOMINAL</th>
              <th class="text-right">SISA PIUTANG</th>
              <th width="140" class="text-right">BAYAR</th>
              <th width="70" class="text-center">LUNASI</th>
              <th>KETERANGAN</th>
              <th width="50" class="text-center">AKSI</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in items"
              :key="index"
              :class="item.bayar > 0 ? 'bg-blue-lighten-5' : ''"
            >
              <td class="text-center text-grey">{{ index + 1 }}</td>
              <td class="font-weight-bold">{{ item.invoice }}</td>
              <td class="text-grey">
                {{
                  item.tanggal
                    ? format(new Date(item.tanggal), "dd/MM/yy")
                    : "-"
                }}
              </td>
              <td class="text-right">{{ formatRupiah(item.nominal) }}</td>
              <td class="text-right text-error font-weight-medium">
                {{ formatRupiah(item.sisa_piutang) }}
              </td>
              <td>
                <v-text-field
                  v-model.number="item.bayar"
                  type="number"
                  density="compact"
                  hide-details
                  variant="plain"
                  class="text-right-input"
                  color="primary"
                  @focus="$event.target.select()"
                />
              </td>
              <td class="text-center">
                <v-checkbox-btn
                  v-model="item.lunasi"
                  density="compact"
                  color="primary"
                  @update:model-value="handleLunasiChange(index)"
                ></v-checkbox-btn>
              </td>
              <td>
                <v-text-field
                  v-model="item.ket"
                  density="compact"
                  hide-details
                  variant="plain"
                  placeholder="..."
                  class="text-caption"
                />
              </td>
              <td class="text-center">
                <v-btn
                  icon="mdi-delete-outline"
                  size="x-small"
                  color="error"
                  variant="text"
                  @click="removeItem(index)"
                ></v-btn>
              </td>
            </tr>
            <tr v-if="items.length === 0">
              <td colspan="9" class="text-center pa-10 text-grey font-italic">
                <v-icon size="large" class="mb-2 opacity-50"
                  >mdi-account-search-outline</v-icon
                ><br />
                Pilih customer untuk melihat daftar piutang.
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </template>

    <template #dialog-warning v-if="customWarningMsg">
      <div class="text-warning mt-2 font-weight-bold text-center">
        {{ customWarningMsg }}
      </div>
    </template>
  </BaseForm>

  <CustomerSearchModal
    v-model="showCusModal"
    @customer-selected="onCustomerSelected"
  />
  <BankSearchModal v-model="showBankModal" @bank-selected="onBankSelected" />

  <SetoranPembayaranPrintModal
    v-model="showPrintModal"
    :nomor="savedInvoiceNomor"
    @update:modelValue="(val) => !val && onPrintModalClosed()"
  />
</template>

<style scoped>
.border-l-primary {
  border-left: 4px solid #1976d2 !important;
}
.colored-header :deep(th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}

/* Custom Inputs & Box */
.summary-box {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  border: 1px dashed #1976d2;
}
.summary-box .text-h5 {
  font-size: 22px !important;
  font-weight: 900 !important;
  letter-spacing: -1px;
}
.nominal-input :deep(input) {
  font-weight: 900 !important;
  font-size: 14px !important;
  color: #1976d2 !important;
}
.text-right-input :deep(input) {
  text-align: right;
  font-weight: bold;
  color: #1976d2;
}

/* Table Hover & Styling */
.setor-table tbody tr:hover {
  background-color: #f5f5f5;
}
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
