<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/services/api";
import PageLayout from "@/components/PageLayout.vue";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { format } from "date-fns";
import { formatRupiah } from "@/utils/formatRupiah";
import CustomerSearchModal from "@/components/lookup/CustomerSearchModal.vue";
import BankSearchModal from "@/components/lookup/BankSearchModal.vue";
import SetoranPembayaranPrintModal from "@/components/SetoranPembayaranPrintModal.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = "33";

// --- State ---
const isEditMode = computed(() => !!route.params.nomor);
const isSaving = ref(false);
const isLoading = ref(false);
const showConfirmDialog = ref(false);
const showCusModal = ref(false);
const showBankModal = ref(false);
const showPrintModal = ref(false);
const savedInvoiceNomor = ref("");
const showCancelDialog = ref(false);

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

// Detail items (Equivalent to CDS in Delphi)
interface DetailItem {
  invoice: string;
  tanggal: string;
  nominal: number;
  terbayar: number;
  sisa_piutang: number;
  bayar: number;
  lunasi: boolean;
  tglbayar: string;
  ket: string;
  angsur: string;
}

const items = ref<DetailItem[]>([]);

// --- Perhitungan Otomatis ---
const totalTerbayar = computed(() => {
  return items.value.reduce((acc, item) => acc + (Number(item.bayar) || 0), 0);
});

const sisaSetoran = computed(() => {
  return (Number(formHeader.value.sh_nominal) || 0) - totalTerbayar.value;
});

// --- Methods ---

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
    // Otomatis isi grid jika ada piutang (mirip fitur bantuan invoice)
    items.value = res.data.map((inv: any) => ({
      invoice: inv.Invoice,
      tanggal: inv.TglInvoice,
      nominal: inv.Nominal,
      terbayar: inv.Bayar,
      sisa_piutang: inv.Sisa,
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

// --- Handler Customer (Data dari Kode, Nama, Alamat, Kota) ---
const onCustomerSelected = (cus: any) => {
  formHeader.value.sh_cus_kode = cus.Kode;
  formHeader.value.cus_nama = cus.Nama;
  formHeader.value.cus_alamat = cus.Alamat;
  formHeader.value.cus_kota = cus.Kota;
  // Langsung tarik piutang setelah pilih customer
  fetchUnpaidInvoices();
};

// --- Handler Bank (Data dari NoRekening, NamaBank) ---
const onBankSelected = (bank: any) => {
  formHeader.value.sh_norek = bank.NoRekening;
  formHeader.value.rek_namabank = bank.NamaBank;
};

const handleLunasiChange = (index: number) => {
  const item = items.value[index];

  // Tambahkan guard clause untuk memastikan item ada [cite: 2026-03-09]
  if (!item) return;

  if (item.lunasi) {
    // Logika lunasi: Ambil nilai terkecil antara sisa piutang atau sisa setoran yang tersedia
    const available = sisaSetoran.value + Number(item.bayar);
    item.bayar = Math.min(item.sisa_piutang, available);
  } else {
    item.bayar = 0;
  }
};

const handleSave = async () => {
  if (!formHeader.value.sh_cus_kode || formHeader.value.sh_nominal <= 0) {
    return toast.error("Lengkapi data header dan nominal.");
  }
  if (sisaSetoran.value < 0) {
    return toast.error("Sisa pembayaran minus. Cek rincian pembayaran.");
  }
  showConfirmDialog.value = true;
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

    // Ambil nomor dari respons backend (saat insert otomatis) atau state (saat edit)
    savedInvoiceNomor.value = response.data.nomor || formHeader.value.sh_nomor;

    toast.success("Data setoran berhasil disimpan.");
    showConfirmDialog.value = false; // Tutup dialog konfirmasi simpan

    // LOGIKA DELPHI: Cetak otomatis hanya untuk setoran TUNAI (jenis === 0)
    if (formHeader.value.sh_jenis === 0) {
      await nextTick();
      showPrintModal.value = true; // Buka modal print
    } else {
      // Jika TRANSFER, langsung kembali ke halaman browse
      router.push("/transaksi/setoran-pembayaran");
    }
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal menyimpan data.");
  } finally {
    isSaving.value = false;
  }
};

const onPrintModalClosed = () => {
  showPrintModal.value = false;
  router.push("/transaksi/setoran-pembayaran"); // Kembali ke browse setelah selesai cetak
};

const fetchEditData = async () => {
  isLoading.value = true;
  try {
    const nomor = route.params.nomor;
    const res = await api.get(`/setoran-pembayaran/${nomor}/form-data`);

    // 1. Map Header
    formHeader.value = {
      ...res.data.header,
      sh_nominal: Number(res.data.header.sh_nominal),
      // Pastikan format tanggal sesuai input type="date"
      sh_tanggal: format(new Date(res.data.header.sh_tanggal), "yyyy-MM-dd"),
      sh_tgltransfer: res.data.header.sh_tgltransfer
        ? format(new Date(res.data.header.sh_tgltransfer), "yyyy-MM-dd")
        : "",
    };

    // 2. Map Details
    items.value = res.data.details.map((d: any) => ({
      invoice: d.invoice,
      tanggal: d.tanggal,
      nominal: Number(d.nominal),
      terbayar: Number(d.terbayar),
      sisa_piutang: Number(d.sisa_piutang),
      bayar: Number(d.bayar),
      lunasi: false, // Default false saat load
      tglbayar: d.tglbayar,
      ket: d.ket,
      angsur: d.angsur,
    }));

    await nextTick();
    toast.info(`Memuat data ${nomor}`);
  } catch (error: any) {
    toast.error(
      "Gagal memuat data: " + (error.response?.data?.message || error.message),
    );
    router.push("/transaksi/setoran-pembayaran");
  } finally {
    isLoading.value = false;
  }
};

// --- Fungsi Tambah PLL ---
const handleF2 = (event: KeyboardEvent) => {
  if (event.key === "F2") {
    event.preventDefault();
    tambahPLL();
  }
};

const tambahPLL = () => {
  if (!formHeader.value.sh_cus_kode) {
    return toast.warning("Pilih customer terlebih dahulu.");
  }
  if (sisaSetoran.value <= 0) {
    return toast.warning("Tidak ada sisa setoran untuk dijadikan PLL.");
  }

  if (
    confirm(
      `Jadikan sisa setoran (${formatRupiah(sisaSetoran.value)}) sebagai PLL?`,
    )
  ) {
    items.value.push({
      invoice: "PLL",
      tanggal: formHeader.value.sh_tanggal,
      nominal: 0,
      terbayar: 0,
      sisa_piutang: 0,
      bayar: sisaSetoran.value, // Otomatis ambil sisa setoran
      lunasi: true,
      tglbayar: formHeader.value.sh_tanggal,
      ket: "Penerimaan Lain-Lain",
      angsur: format(new Date(), "yyyyMMddHHmmss"),
    });
    toast.success("Baris PLL berhasil ditambahkan.");
  }
};

const removeItem = (index: number) => {
  items.value.splice(index, 1);
  toast.success("Baris tagihan dihapus.");
};

// Fitur 2: Fungsi untuk menampilkan konfirmasi batal
const handleCancel = () => {
  showCancelDialog.value = true;
};

// Fungsi eksekusi batal
const executeCancel = () => {
  showCancelDialog.value = false;
  router.back();
};

// Tambahkan Event Listener Keyboard
onMounted(() => {
  window.addEventListener("keydown", handleF2);
  if (isEditMode.value) {
    fetchEditData();
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleF2);
});

onMounted(() => {
  if (isEditMode.value) {
    fetchEditData();
  }
});
</script>

<template>
  <PageLayout
    :title="isEditMode ? 'Ubah Setoran Pembayaran' : 'Input Setoran Pembayaran'"
    desktop-mode
    icon="mdi-cash-register"
  >
    <template #header-actions>
      <div class="text-caption text-grey mr-4 d-flex align-center">
        <v-kbd>F2</v-kbd> <span class="ml-1">Jadikan PLL</span>
      </div>
      <v-btn
        color="primary"
        @click="handleSave"
        :loading="isSaving"
        prepend-icon="mdi-content-save"
        >Simpan</v-btn
      >
      <v-btn variant="outlined" @click="handleCancel">Batal</v-btn>
    </template>

    <div class="setor-wrapper bg-grey-lighten-3">
      <aside class="left-panel">
        <div class="desktop-form-section elevation-1 mb-3">
          <v-text-field
            v-model="formHeader.sh_nomor"
            label="Nomor"
            readonly
            density="compact"
            hide-details
            variant="filled"
            class="mb-2"
            placeholder="Otomatis"
          />
          <v-text-field
            v-model="formHeader.sh_tanggal"
            label="Tanggal"
            type="date"
            density="compact"
            hide-details
            variant="outlined"
            class="mb-2"
          />

          <div class="d-flex align-center mb-2">
            <v-text-field
              v-model="formHeader.sh_cus_kode"
              label="Customer (F1)"
              density="compact"
              hide-details
              variant="outlined"
              color="primary"
              @keyup.f1="showCusModal = true"
              @blur="fetchCustomer"
            />
            <v-btn
              icon="mdi-magnify"
              size="x-small"
              variant="tonal"
              color="primary"
              class="ml-1"
              @click="showCusModal = true"
            ></v-btn>
          </div>

          <v-text-field
            v-model="formHeader.cus_nama"
            label="Nama"
            readonly
            density="compact"
            hide-details
            variant="filled"
            class="mb-2 font-weight-bold"
          />
          <v-textarea
            v-model="formHeader.cus_alamat"
            label="Alamat"
            readonly
            density="compact"
            hide-details
            variant="filled"
            rows="2"
            class="mb-2"
          />
        </div>

        <div class="desktop-form-section elevation-1 mb-3">
          <v-select
            v-model="formHeader.sh_jenis"
            :items="[
              { title: 'TUNAI', value: 0 },
              { title: 'TRANSFER', value: 1 },
            ]"
            label="Jenis Setoran"
            density="compact"
            hide-details
            variant="outlined"
            class="mb-2"
            color="primary"
          />

          <div
            v-if="formHeader.sh_jenis === 1"
            class="bg-blue-lighten-5 pa-3 rounded border mb-2"
          >
            <div class="d-flex align-center mb-2">
              <v-text-field
                v-model="formHeader.sh_norek"
                label="No. Rekening"
                density="compact"
                hide-details
                variant="outlined"
                color="primary"
                @keyup.f1="showBankModal = true"
              />
              <v-btn
                icon="mdi-magnify"
                size="x-small"
                variant="tonal"
                color="primary"
                class="ml-1"
                @click="showBankModal = true"
              ></v-btn>
            </div>
            <v-text-field
              v-model="formHeader.rek_namabank"
              label="Bank"
              readonly
              density="compact"
              hide-details
              variant="plain"
              class="mb-1 font-weight-bold"
            />
            <v-text-field
              v-model="formHeader.sh_tgltransfer"
              label="Tgl Transfer"
              type="date"
              density="compact"
              hide-details
              variant="outlined"
            />
          </div>

          <v-text-field
            v-model.number="formHeader.sh_nominal"
            label="NOMINAL SETOR *"
            type="number"
            density="compact"
            hide-details
            variant="outlined"
            class="mb-2 nominal-input"
            color="primary"
          />
          <v-text-field
            v-model="formHeader.sh_ket"
            label="Keterangan"
            density="compact"
            hide-details
            variant="outlined"
          />
        </div>

        <v-card
          variant="flat"
          class="elevation-1 pa-4 rounded-lg border-0 bg-white"
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
              class="text-caption text-grey-darken-1 font-weight-bold uppercase"
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
      </aside>

      <main class="main-panel">
        <v-card
          class="elevation-1 rounded-lg flex-grow-1 overflow-hidden d-flex flex-column"
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
                <td colspan="9" class="text-center pa-10 text-grey italic">
                  <v-icon size="large" class="mb-2"
                    >mdi-account-search-outline</v-icon
                  ><br />
                  Pilih customer untuk melihat daftar piutang.
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </main>
    </div>

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

    <v-dialog v-model="showConfirmDialog" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pa-4">Konfirmasi Simpan</v-card-title>
        <v-card-text class="pa-4 pt-0">
          Yakin ingin menyimpan setoran sebesar
          <strong>{{ formatRupiah(formHeader.sh_nominal) }}</strong
          >?
          <div v-if="sisaSetoran > 0" class="text-warning mt-2">
            Catatan: Masih ada sisa setoran Rp {{ formatRupiah(sisaSetoran) }}
          </div>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showConfirmDialog = false">Batal</v-btn>
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

    <v-dialog v-model="showCancelDialog" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pa-4 d-flex align-center">
          <v-icon color="warning" class="mr-2">mdi-alert</v-icon>
          Konfirmasi Batal
        </v-card-title>
        <v-card-text class="pa-4 pt-0">
          Yakin ingin membatalkan? Semua data yang sudah Anda ketik tidak akan
          disimpan.
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showCancelDialog = false">Tidak</v-btn>
          <v-btn color="error" variant="elevated" @click="executeCancel"
            >Ya, Batal</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </PageLayout>
</template>

<style scoped>
/* 1. Global Font Constraint */
.setor-wrapper :deep(*) {
  font-size: 11px !important;
}

/* 2. Layout Grid Dasar */
.setor-wrapper {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  padding: 16px;
  height: calc(100vh - 100px);
}

.left-panel,
.main-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 3. Overlay Section Styling (White over Gray) */
.desktop-form-section {
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: white !important;
}

/* 4. Konsistensi Header Biru */
.colored-header :deep(th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
  height: 36px !important;
}

/* 5. Custom Elements */
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

/* Zebra / Highlight Row */
.setor-table tbody tr:hover {
  background-color: #f5f5f5;
}

/* Hilangkan Spinner Angka */
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.fill-height {
  height: 100%;
}
</style>
