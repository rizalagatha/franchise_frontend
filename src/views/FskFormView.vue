<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/services/api";
import PageLayout from "@/components/PageLayout.vue";
import FskPrintModal from "@/components/FskPrintModal.vue";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";
import { format } from "date-fns";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = "32";

// --- State ---
const isEditMode = computed(() => !!route.params.nomor);
const isSaving = ref(false);
const isLoading = ref(true);
const userList = ref<string[]>([]);
const isConfirmDialogVisible = ref(false);
const confirmTitle = ref("Konfirmasi Simpan");
const confirmText = ref("Yakin ingin simpan data setoran ini?");
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

const totalSetoran = computed(() => {
  return detailRekap.value.reduce(
    (acc, item) => acc + (Number(item.nominal) || 0),
    0,
  );
});

// --- Methods ---

const fetchUsers = async () => {
  try {
    const res = await api.get("/users/list"); // API untuk ambil tuser aktif
    userList.value = ["ALL", ...res.data.map((u: any) => u.user_kode)];
  } catch (error) {
    toast.error("Gagal memuat daftar kasir");
  }
};

/**
 * Logika Refresh / LoadNew: Rekap otomatis dari DB
 */
const refreshRekap = async () => {
  isLoading.value = true;
  try {
    const res = await api.get("/fsk/generate-rekap", {
      params: {
        tanggal: formHeader.value.fsk_tanggal,
        kasir: formHeader.value.fsk_kasir,
      },
    });
    // Backend harus mengembalikan { detail1: [], detail2: [] }
    detailTransaksi.value = res.data.detail1;
    detailRekap.value = res.data.detail2;

    if (res.data.isExisting && !isEditMode.value) {
      toast.info("Data setoran untuk tanggal/kasir ini sudah ada (Mode Ubah)");
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
  try {
    const res = await api.get(`/fsk/${route.params.nomor}/form-data`);
    formHeader.value = res.data.header;
    detailTransaksi.value = res.data.detail1;
    detailRekap.value = res.data.detail2;
  } catch (error) {
    toast.error("Gagal memuat data edit");
  } finally {
    isLoading.value = false;
  }
};

const handleSave = () => {
  if (detailRekap.value.length === 0)
    return toast.error("Tidak ada data untuk disetor.");

  // Set pesan dialog dan tampilkan
  confirmTitle.value = "Konfirmasi Simpan";
  confirmText.value = "Yakin ingin simpan data setoran ini?";
  isConfirmDialogVisible.value = true;
};

// --- Fungsi Eksekusi Simpan yang Sebenarnya ---
const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      detail1: detailTransaksi.value, // Kirim detail 1
      detail2: detailRekap.value, // Kirim detail 2
      isNew: !isEditMode.value,
    };

    const response = await api.post("/fsk/save", payload);

    // 1. Simpan nomor untuk cetak
    savedFskNomor.value = response.data.nomor;
    toast.success("Data berhasil disimpan");

    // 2. Tutup dialog konfirmasi & Buka Modal Cetak
    isConfirmDialogVisible.value = false;
    await nextTick();
    showPrintModal.value = true;
  } catch (error: any) {
    toast.error(error.response?.data?.message || "Gagal Simpan");
  } finally {
    isSaving.value = false;
  }
};

// Fungsi saat modal cetak ditutup
const onPrintClosed = () => {
  showPrintModal.value = false;
  router.push("/transaksi/fsk"); // Kembali ke browse
};

onMounted(async () => {
  await fetchUsers();
  if (isEditMode.value) await fetchEditData();
  else await refreshRekap();
});
</script>

<template>
  <PageLayout
    :title="isEditMode ? 'Ubah Setoran Kasir' : 'Input Setoran Kasir'"
    desktop-mode
    icon="mdi-bank-transfer"
  >
    <template #header-actions>
      <v-btn
        color="primary"
        @click="handleSave"
        :loading="isSaving"
        prepend-icon="mdi-content-save"
        >Simpan</v-btn
      >
      <v-btn variant="outlined" @click="router.back()">Batal</v-btn>
    </template>

    <div class="fsk-wrapper bg-grey-lighten-3">
      <aside class="left-panel">
        <div class="desktop-form-section elevation-1 mb-3">
          <v-text-field
            v-model="formHeader.fsk_nomor"
            label="Nomor"
            readonly
            density="compact"
            hide-details
            variant="filled"
            class="mb-2"
          />
          <v-text-field
            v-model="formHeader.fsk_tanggal"
            label="Tanggal"
            type="date"
            density="compact"
            hide-details
            variant="outlined"
            class="mb-2"
            @change="refreshRekap"
          />
          <v-select
            v-model="formHeader.fsk_kasir"
            :items="userList"
            label="Pilih Kasir"
            density="compact"
            hide-details
            variant="outlined"
            class="mb-2"
            @update:model-value="refreshRekap"
            color="primary"
          />
          <v-text-field
            v-model="formHeader.user_create"
            label="User ID"
            readonly
            density="compact"
            hide-details
            variant="filled"
          />
        </div>

        <v-card class="elevation-1 rounded-lg pa-4 border-0">
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
              new Intl.NumberFormat("id-ID").format(rekap.nominal)
            }}</span>
          </div>
          <v-divider class="my-3"></v-divider>
          <div class="total-fsk-box">
            <div class="text-caption text-grey-darken-1 font-weight-bold">
              TOTAL SETORAN
            </div>
            <div class="text-h5 font-weight-black text-primary text-right">
              {{ new Intl.NumberFormat("id-ID").format(totalSetoran) }}
            </div>
          </div>
        </v-card>
      </aside>

      <main class="main-panel">
        <v-card
          class="elevation-1 mb-3 rounded-lg overflow-hidden d-flex flex-column"
          height="60%"
        >
          <v-data-table
            :items="detailTransaksi"
            density="compact"
            hide-default-footer
            class="fill-height colored-header"
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
                <td class="font-weight-medium">{{ item.inv }}</td>
                <td class="text-truncate" style="max-width: 200px">
                  {{ item.nmcus }}
                </td>
                <td class="text-right font-weight-bold">
                  {{ new Intl.NumberFormat("id-ID").format(item.nominal) }}
                </td>
              </tr>
            </template>
          </v-data-table>
        </v-card>

        <v-card
          class="elevation-1 rounded-lg overflow-hidden d-flex flex-column border-left-blue"
          height="38%"
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
                <td class="font-weight-bold">{{ item.jenis }}</td>
                <td class="text-right">
                  <v-text-field
                    v-model.number="item.nominal"
                    type="number"
                    density="compact"
                    hide-details
                    variant="plain"
                    class="text-right-input"
                    color="primary"
                  />
                </td>
              </tr>
            </template>
          </v-data-table>
        </v-card>
      </main>
    </div>

    <v-dialog v-model="isConfirmDialogVisible" max-width="400px" persistent>
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 font-weight-bold d-flex align-center pa-4">
          <v-icon color="primary" class="mr-2">mdi-help-circle-outline</v-icon>
          {{ confirmTitle }}
        </v-card-title>

        <v-card-text class="pa-4 pt-0">
          {{ confirmText }}
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="isConfirmDialogVisible = false"
            :disabled="isSaving"
            >Batal</v-btn
          >
          <v-btn
            color="primary"
            variant="elevated"
            @click="executeSave"
            :loading="isSaving"
          >
            Ya, Simpan
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <FskPrintModal
      v-model="showPrintModal"
      :nomor-fsk="savedFskNomor"
      @update:model-value="
        (val) => {
          if (!val) onPrintClosed();
        }
      "
    />
  </PageLayout>
</template>

<style scoped>
/* 1. Paksa Font 11px */
.fsk-wrapper :deep(*) {
  font-size: 11px !important;
}

/* 2. Layout Grid Dasar */
.fsk-wrapper {
  display: grid;
  grid-template-columns: 300px 1fr;
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

/* 3. Overlay Section Styling */
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

.colored-header-sub :deep(th) {
  background-color: #455a64 !important; /* Abu-abu gelap untuk area edit */
  color: white !important;
  font-weight: bold !important;
  height: 32px !important;
}

/* Aksen Garis Biru untuk area input utama */
.border-left-blue {
  border-left: 6px solid #1976d2 !important;
}

/* 5. Custom Input & Box */
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

.text-right-input :deep(input) {
  text-align: right;
  font-weight: 900;
  font-size: 13px !important;
  color: #1976d2;
}

/* Hilangkan Spinner Angka */
:deep(input::-webkit-outer-spin-button),
:deep(input::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}
</style>
