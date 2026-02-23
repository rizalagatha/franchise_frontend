<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { formatRupiah } from '@/utils/formatRupiah';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const MENU_ID = '33';

// --- State ---
const isEditMode = computed(() => !!route.params.nomor);
const isSaving = ref(false);
const isLoading = ref(false);
const showConfirmDialog = ref(false);

const formHeader = ref({
  sh_nomor: '',
  sh_tanggal: format(new Date(), 'yyyy-MM-dd'),
  sh_cus_kode: '',
  cus_nama: '',
  cus_alamat: '',
  cus_kota: '',
  cus_telp: '',
  sh_jenis: 0, // 0: TUNAI, 1: TRANSFER
  sh_nominal: 0,
  sh_norek: '',
  rek_namabank: '',
  sh_tgltransfer: format(new Date(), 'yyyy-MM-dd'),
  sh_ket: '',
  user_create: authStore.user?.user_kode || '',
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
    toast.error('Customer tidak ditemukan.');
  }
};

const fetchUnpaidInvoices = async () => {
  if (!formHeader.value.sh_cus_kode || isEditMode.value) return;
  try {
    const res = await api.get(`/setoran-pembayaran/unpaid/${formHeader.value.sh_cus_kode}`);
    // Otomatis isi grid jika ada piutang (mirip fitur bantuan invoice)
    items.value = res.data.map((inv: any) => ({
      invoice: inv.Invoice,
      tanggal: inv.TglInvoice,
      nominal: inv.Nominal,
      terbayar: inv.Bayar,
      sisa_piutang: inv.Sisa,
      bayar: 0,
      lunasi: false,
      tglbayar: format(new Date(), 'yyyy-MM-dd'),
      ket: '',
      angsur: format(new Date(), 'yyyyMMddHHmmss')
    }));
  } catch (error) {
    toast.error('Gagal mengambil data piutang.');
  }
};

const handleLunasiChange = (index: number) => {
  const item = items.value[index];
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
    return toast.error('Lengkapi data header dan nominal.');
  }
  if (sisaSetoran.value < 0) {
    return toast.error('Sisa pembayaran minus. Cek rincian pembayaran.');
  }
  showConfirmDialog.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      header: formHeader.value,
      details: items.value.filter(i => i.bayar > 0),
      isNew: !isEditMode.value
    };
    await api.post('/setoran-pembayaran/save', payload);
    toast.success('Data setoran berhasil disimpan.');
    router.push('/transaksi/setoran-pembayaran');
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Gagal menyimpan data.');
  } finally {
    isSaving.value = false;
    showConfirmDialog.value = false;
  }
};

onMounted(() => {
  if (isEditMode.value) {
    // Logic fetch data edit akan ditambahkan di sini
  }
});
</script>

<template>
  <PageLayout :title="isEditMode ? 'Ubah Setoran Pembayaran' : 'Input Setoran Pembayaran'" desktop-mode
    icon="mdi-cash-register">
    <template #header-actions>
      <v-btn color="primary" @click="handleSave" :loading="isSaving" prepend-icon="mdi-content-save">Simpan</v-btn>
      <v-btn variant="outlined" @click="router.back()">Batal</v-btn>
    </template>

    <div class="setor-wrapper">
      <aside class="left-panel">
        <div class="desktop-form-section header-section">
          <v-text-field v-model="formHeader.sh_nomor" label="Nomor" readonly density="compact" hide-details
            variant="filled" class="mb-2" placeholder="Otomatis" />
          <v-text-field v-model="formHeader.sh_tanggal" label="Tanggal" type="date" density="compact" hide-details
            variant="outlined" class="mb-2" />

          <div class="d-flex align-center mb-2">
            <v-text-field v-model="formHeader.sh_cus_kode" label="Customer" density="compact" hide-details
              variant="outlined" @keyup.f1="() => { }" @blur="fetchCustomer" />
            <v-btn icon="mdi-magnify" size="x-small" variant="tonal" color="primary" class="ml-1"></v-btn>
          </div>

          <v-text-field v-model="formHeader.cus_nama" label="Nama" readonly density="compact" hide-details
            variant="filled" class="mb-2" />
          <v-textarea v-model="formHeader.cus_alamat" label="Alamat" readonly density="compact" hide-details
            variant="filled" rows="2" class="mb-2" />
          <v-text-field v-model="formHeader.cus_kota" label="Kota" readonly density="compact" hide-details
            variant="filled" class="mb-2" />

          <v-divider class="my-3"></v-divider>

          <v-select v-model="formHeader.sh_jenis"
            :items="[{ title: 'TUNAI', value: 0 }, { title: 'TRANSFER', value: 1 }]" label="Jenis Setoran"
            density="compact" hide-details variant="outlined" class="mb-2" />

          <div v-if="formHeader.sh_jenis === 1" class="bg-blue-lighten-5 pa-2 rounded mb-2 border">
            <v-text-field v-model="formHeader.sh_norek" label="No. Rekening" density="compact" hide-details
              variant="outlined" class="mb-2" />
            <v-text-field v-model="formHeader.rek_namabank" label="Bank" readonly density="compact" hide-details
              variant="filled" class="mb-2" />
            <v-text-field v-model="formHeader.sh_tgltransfer" label="Tgl Transfer" type="date" density="compact"
              hide-details variant="outlined" />
          </div>

          <v-text-field v-model.number="formHeader.sh_nominal" label="Nominal Setor" type="number" density="compact"
            hide-details variant="outlined" class="mb-2 font-weight-bold" color="primary" />
          <v-text-field v-model="formHeader.sh_ket" label="Keterangan" density="compact" hide-details
            variant="outlined" />
        </div>

        <v-card variant="outlined" class="mt-4 pa-3 bg-grey-lighten-4">
          <div class="d-flex justify-space-between text-caption mb-1">
            <span>Terbayar:</span>
            <span class="font-weight-bold">{{ formatRupiah(totalTerbayar) }}</span>
          </div>
          <div class="d-flex justify-space-between text-subtitle-2">
            <span>Sisa:</span>
            <span :class="sisaSetoran < 0 ? 'text-error' : 'text-primary'" class="font-weight-black">
              {{ formatRupiah(sisaSetoran) }}
            </span>
          </div>
        </v-card>
      </aside>

      <main class="main-panel">
        <v-card variant="outlined" class="rounded-lg flex-grow-1 overflow-hidden">
          <v-table density="compact" fixed-header class="setor-table">
            <thead>
              <tr>
                <th width="50">No</th>
                <th>No. Invoice</th>
                <th>Tgl Inv</th>
                <th class="text-right">Nominal</th>
                <th class="text-right">Sisa Piutang</th>
                <th width="140" class="text-right">Bayar</th>
                <th width="80" class="text-center">Lunasi</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in items" :key="index">
                <td class="text-center">{{ index + 1 }}</td>
                <td class="font-weight-bold">{{ item.invoice }}</td>
                <td>{{ item.tanggal ? format(new Date(item.tanggal), 'dd/MM/yy') : '-' }}</td>
                <td class="text-right">{{ formatRupiah(item.nominal) }}</td>
                <td class="text-right text-error">{{ formatRupiah(item.sisa_piutang) }}</td>
                <td>
                  <v-text-field v-model.number="item.bayar" type="number" density="compact" hide-details variant="plain"
                    class="text-right-input" @focus="$event.target.select()" />
                </td>
                <td class="text-center">
                  <v-checkbox-btn v-model="item.lunasi" density="compact" color="primary"
                    @update:model-value="handleLunasiChange(index)"></v-checkbox-btn>
                </td>
                <td>
                  <v-text-field v-model="item.ket" density="compact" hide-details variant="plain" placeholder="..." />
                </td>
              </tr>
              <tr v-if="items.length === 0">
                <td colspan="8" class="text-center pa-10 text-grey italic">Pilih customer untuk melihat daftar piutang.
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </main>
    </div>

    <v-dialog v-model="showConfirmDialog" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pa-4">Konfirmasi Simpan</v-card-title>
        <v-card-text class="pa-4 pt-0">
          Yakin ingin menyimpan setoran sebesar <strong>{{ formatRupiah(formHeader.sh_nominal) }}</strong>?
          <div v-if="sisaSetoran > 0" class="text-warning mt-2">Catatan: Masih ada sisa setoran Rp {{
            formatRupiah(sisaSetoran) }}</div>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showConfirmDialog = false">Batal</v-btn>
          <v-btn color="primary" variant="elevated" @click="executeSave" :loading="isSaving">Ya, Simpan</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </PageLayout>
</template>

<style scoped>
.setor-wrapper :deep(*) {
  font-size: 11px !important;
}

/* */
.setor-wrapper {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 12px;
  padding: 12px;
  height: calc(100vh - 100px);
}

.left-panel,
.main-panel {
  display: flex;
  flex-direction: column;
}

.header-section {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
}

.setor-table th {
  background-color: #f5f5f5 !important;
  font-weight: bold !important;
  color: #616161 !important;
}

.text-right-input :deep(input) {
  text-align: right;
  color: #1976D2;
  font-weight: bold;
}

.italic {
  font-style: italic;
}
</style>
