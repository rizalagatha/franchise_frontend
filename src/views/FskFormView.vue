<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue";
import { useRouter } from "vue-router";
import api from "@/services/api";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { format } from "date-fns";
import { formatRupiah } from "@/utils/formatRupiah";

// Components & Composables
import BaseForm from "@/components/BaseForm.vue";
import FskPrintModal from "@/components/FskPrintModal.vue";
import { useForm } from "@/composables/useForm";

const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = "32";

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
  onSuccessRoute: "/transaksi/fsk", // <--- GPS Pulang
  submitApi: async () => {}, // Dioverride di executeSave
});

const pageTitle = computed(() =>
  isEditMode.value ? "Ubah Setoran Kasir" : "Input Setoran Kasir",
);

// 2. State & Variables
const userList = ref<string[]>([]);
const savedFskNomor = ref("");
const showPrintModal = ref(false);

const formHeader = ref({
  fsk_nomor: "",
  fsk_tanggal: format(new Date(), "yyyy-MM-dd"),
  fsk_kasir: "ALL", // Default cbKasir
  user_create: authStore.user?.kode || "",
});

// Detail 1: Transaksi (CDS) & Detail 2: Rekap (CDS2)
const detailTransaksi = ref<any[]>([]);
const detailRekap = ref<any[]>([]);

// 3. Logic & Computeds
const totalSetoran = computed(() => {
  return Math.round(
    detailRekap.value.reduce(
      (acc, item) => acc + (Number(item.nominal) || 0),
      0,
    ),
  );
});

const fetchUsers = async () => {
  try {
    const res = await api.get("/users/list");
    userList.value = ["ALL", ...res.data.map((u: any) => u.user_kode)];
  } catch (error) {
    toast.error("Gagal memuat daftar kasir");
  }
};

const refreshRekap = async () => {
  isLoading.value = true;
  try {
    const res = await api.get("/fsk/generate-rekap", {
      params: {
        tanggal: formHeader.value.fsk_tanggal,
        kasir: formHeader.value.fsk_kasir,
      },
    });

    detailTransaksi.value = res.data.detail1;
    detailRekap.value = res.data.detail2;

    if (res.data.isExisting && !isEditMode.value) {
      toast.info(
        "Data setoran untuk tanggal/kasir ini sudah ada (Otomatis masuk Mode Ubah)",
      );
      router.push(`/transaksi/fsk/ubah/${res.data.nomorExisting}`);
    }
  } catch (error) {
    toast.error("Gagal melakukan rekap otomatis");
  } finally {
    isLoading.value = false;
  }
};

const fetchEditData = async () => {
  if (!isEditMode.value) return;
  isLoading.value = true;
  try {
    const res = await api.get(`/fsk/${params.nomor}/form-data`);
    formHeader.value = res.data.header;
    detailTransaksi.value = res.data.detail1;
    detailRekap.value = res.data.detail2;
  } catch (error) {
    toast.error("Gagal memuat data edit");
  } finally {
    isLoading.value = false;
  }
};

// 4. Save, Cancel & Print Logic
const validateForm = () => {
  if (detailRekap.value.length === 0)
    return toast.error("Tidak ada data untuk disetor.");

  showSaveDialog.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      detail1: detailTransaksi.value,
      detail2: detailRekap.value,
      isNew: !isEditMode.value,
    };

    const response = await api.post("/fsk/save", payload);

    savedFskNomor.value = response.data.nomor;
    toast.success("Data berhasil disimpan");

    showSaveDialog.value = false; // Tutup dialog konfirmasi BaseForm
    await nextTick();
    showPrintModal.value = true; // Buka modal cetak
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal Simpan");
  } finally {
    isSaving.value = false;
  }
};

const handleConfirmCancel = () => {
  showCancelDialog.value = false;
  if (isEditMode.value) {
    fetchEditData();
  } else {
    formHeader.value.fsk_kasir = "ALL";
    formHeader.value.fsk_tanggal = format(new Date(), "yyyy-MM-dd");
    refreshRekap();
  }
  toast.info("Inputan di-reset.");
};

const onPrintClosed = () => {
  showPrintModal.value = false;
  goBack(); // Menggunakan fungsi goBack dari composable untuk kembali ke browse
};

// Lifecycle
onMounted(async () => {
  await fetchUsers();
  if (isEditMode.value) await fetchEditData();
  else await refreshRekap();
});
</script>

<template>
  <BaseForm
    :title="pageTitle"
    menu-id="32"
    icon="mdi-bank-transfer"
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
          label="Nomor Setoran"
          v-model="formHeader.fsk_nomor"
          readonly
          variant="filled"
          density="compact"
          hide-details
          class="mb-2"
          placeholder="<Otomatis>"
        />
        <v-text-field
          label="Tanggal"
          v-model="formHeader.fsk_tanggal"
          type="date"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2 bg-white"
          @change="refreshRekap"
        />
        <v-select
          label="Pilih Kasir"
          v-model="formHeader.fsk_kasir"
          :items="userList"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2 bg-white"
          @update:model-value="refreshRekap"
          color="primary"
        />
        <v-text-field
          label="User ID"
          v-model="formHeader.user_create"
          readonly
          variant="filled"
          density="compact"
          hide-details
        />
      </div>

      <v-card
        class="desktop-form-section elevation-1 border-0"
        v-if="!isLoading"
      >
        <div class="text-caption font-weight-black text-primary mb-2">
          REKAP SETORAN
        </div>
        <v-divider class="mb-3"></v-divider>
        <div
          v-for="rekap in detailRekap"
          :key="rekap.jenis"
          class="d-flex justify-space-between mb-1"
        >
          <span class="text-grey-darken-1">{{ rekap.jenis }}</span>
          <span class="font-weight-bold">{{
            formatRupiah(rekap.nominal)
          }}</span>
        </div>
        <v-divider class="my-3"></v-divider>
        <div class="total-fsk-box">
          <div class="text-caption text-grey-darken-1 font-weight-bold">
            TOTAL SETORAN
          </div>
          <div class="text-h5 font-weight-black text-primary text-right">
            {{ formatRupiah(totalSetoran) }}
          </div>
        </div>
      </v-card>
    </template>

    <template #right-column>
      <div class="d-flex flex-column fill-height" v-if="!isLoading">
        <div
          class="desktop-form-section pa-0 overflow-hidden elevation-1 mb-3 d-flex flex-column"
          style="height: 60%"
        >
          <v-data-table
            :items="detailTransaksi"
            density="compact"
            hide-default-footer
            class="fill-height colored-header zebra-table"
            fixed-header
            :items-per-page="-1"
          >
            <template #headers>
              <tr>
                <th>JENIS</th>
                <th>TANGGAL</th>
                <th>INV</th>
                <th>CUSTOMER</th>
                <th class="text-right">NOMINAL</th>
              </tr>
            </template>
            <template #item="{ item }">
              <tr>
                <td>{{ item.jenis }}</td>
                <td>
                  {{
                    item.tgltrf
                      ? format(new Date(item.tgltrf), "dd/MM/yy")
                      : "-"
                  }}
                </td>
                <td class="font-weight-bold">{{ item.inv }}</td>
                <td class="text-truncate" style="max-width: 200px">
                  {{ item.nmcus }}
                </td>
                <td class="text-right font-weight-bold">
                  {{ formatRupiah(item.nominal) }}
                </td>
              </tr>
            </template>
          </v-data-table>
        </div>

        <div
          class="desktop-form-section pa-0 overflow-hidden elevation-1 d-flex flex-column border-left-blue flex-grow-1"
        >
          <v-data-table
            :items="detailRekap"
            density="compact"
            hide-default-footer
            class="fill-height colored-header-sub"
            :items-per-page="-1"
          >
            <template #headers>
              <tr>
                <th>JENIS SETORAN (EDITABLE)</th>
                <th class="text-right">NOMINAL SETOR</th>
              </tr>
            </template>
            <template #item="{ item }">
              <tr class="bg-blue-lighten-5">
                <td class="font-weight-bold text-primary">{{ item.jenis }}</td>
                <td class="text-right py-1">
                  <v-text-field
                    v-model.number="item.nominal"
                    type="number"
                    density="compact"
                    hide-details
                    variant="plain"
                    class="text-right-input"
                    color="primary"
                    @focus="$event.target.select()"
                  />
                </td>
              </tr>
            </template>
          </v-data-table>
        </div>
      </div>
    </template>
  </BaseForm>

  <FskPrintModal
    v-model="showPrintModal"
    :nomor-fsk="savedFskNomor"
    @update:model-value="
      (val) => {
        if (!val) onPrintClosed();
      }
    "
  />
</template>

<style scoped>
.border-l-primary {
  border-left: 4px solid #1976d2 !important;
}
.border-left-blue {
  border-left: 6px solid #1976d2 !important;
}

/* Custom Kotak Total Rekap */
.total-fsk-box {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 6px;
  border: 1px dashed #1976d2;
}
.total-fsk-box .text-h5 {
  font-size: 20px !important;
  font-weight: 900 !important;
}

/* Tabel Headers */
.colored-header :deep(th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
}
.colored-header-sub :deep(th) {
  background-color: #455a64 !important;
  color: white !important;
  font-weight: bold !important;
}

/* Custom Input Align Right */
.text-right-input :deep(input) {
  text-align: right;
  font-weight: 900;
  font-size: 14px !important;
  color: #1976d2;
  padding-right: 12px;
}

/* Hilangkan Spinner Angka */
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
