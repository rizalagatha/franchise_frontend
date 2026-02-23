<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BankSearchModal from './lookup/BankSearchModal.vue';
import { format } from 'date-fns';

const props = defineProps<{
  modelValue: boolean;
  totalInvoice: number;
}>();

const emit = defineEmits(['update:modelValue', 'confirm-payment']);

// --- State Pembayaran ---
const rpTunai = ref(0);
const rpCard = ref(0);
const noRek = ref('');
const namaBank = ref('');
const noSetoran = ref(''); // Header inv_nosetor
const tglTransfer = ref(format(new Date(), 'yyyy-MM-dd'));
const pundiAmal = ref(0); // Uang receh yang didonasikan
const showBankModal = ref(false);

// --- Kalkulasi ---
const totalBayar = computed(() => (rpTunai.value || 0) + (rpCard.value || 0));
const totalKembaliRaw = computed(() => Math.max(0, totalBayar.value - props.totalInvoice));

// Logika Pundi Amal otomatis (Mengambil 3 digit terakhir/receh)
watch(totalKembaliRaw, (newKembali) => {
  if (newKembali > 0) {
    // Sesuai logika Delphi: ambil sisa ratusan (misal 1.250 -> pundi 250)
    pundiAmal.value = newKembali % 1000;
  } else {
    pundiAmal.value = 0;
  }
});

const nettoKembali = computed(() => totalKembaliRaw.value - pundiAmal.value);
const sisaPiutang = computed(() => Math.max(0, props.totalInvoice - totalBayar.value));

const formatCurrency = (v: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);

const onBankSelected = (bank: any) => {
  noRek.value = bank.NoRekening;
  namaBank.value = bank.NamaBank;
};

const handleConfirm = () => {
  emit('confirm-payment', {
    rpTunai: rpTunai.value,
    rpCard: rpCard.value,
    noRek: noRek.value,
    noSetoran: noSetoran.value,
    tglTransfer: tglTransfer.value,
    pundiAmal: pundiAmal.value,
    kembalian: nettoKembali.value, // Ini yang dikirim sebagai nKembali ke backend [cite: 2026-02-02]
    totalBayar: totalBayar.value
  });
};

// Reset saat dibuka
watch(() => props.modelValue, (val) => {
  if (val) {
    rpTunai.value = 0;
    rpCard.value = 0;
    noRek.value = '';
    namaBank.value = '';
    pundiAmal.value = 0;
    tglTransfer.value = format(new Date(), 'yyyy-MM-dd');
  }
});
</script>

<template>
  <v-dialog :model-value="modelValue" @update:modelValue="$emit('update:modelValue', $event)" max-width="450px"
    persistent>
    <v-card class="modern-payment-modal rounded-xl">
      <v-toolbar color="white" density="compact" class="border-b">
        <v-toolbar-title class="text-subtitle-2 font-weight-bold text-grey-darken-3">Konfirmasi
          Pembayaran</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" variant="text" size="small"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-5">
        <div class="payment-section mb-4">
          <div class="section-label">BAYAR TUNAI</div>
          <v-text-field v-model.number="rpTunai" type="number" variant="outlined" density="compact" hide-details
            prefix="Rp" class="payment-input mt-1" autofocus @focus="$event.target.select()" />
        </div>

        <div class="payment-section mb-4 bg-blue-lighten-5 pa-3 rounded-lg border-blue-lighten-4 border">
          <div class="section-label text-blue-darken-3">BAYAR CARD / TRANSFER</div>
          <v-row dense class="mt-1">
            <v-col cols="12">
              <v-text-field v-model="namaBank" placeholder="Pilih Bank..." readonly variant="outlined" density="compact"
                hide-details prepend-inner-icon="mdi-bank" append-inner-icon="mdi-magnify" class="clickable-field mb-2"
                @click="showBankModal = true" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="tglTransfer" type="date" label="Tgl Transfer" variant="outlined" density="compact"
                hide-details />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model.number="rpCard" type="number" variant="outlined" density="compact" hide-details
                prefix="Rp" class="payment-input" @focus="$event.target.select()" />
            </v-col>
          </v-row>
        </div>

        <div class="summary-box pa-4 rounded-lg bg-grey-lighten-4 border">
          <div class="summary-line">
            <span>Total Tagihan</span>
            <span class="font-weight-bold">{{ formatCurrency(totalInvoice) }}</span>
          </div>
          <div class="summary-line">
            <span>Total Bayar</span>
            <span class="text-blue-darken-2 font-weight-bold">{{ formatCurrency(totalBayar) }}</span>
          </div>

          <v-divider class="my-2"></v-divider>

          <template v-if="totalKembaliRaw > 0">
            <div class="summary-line text-success">
              <span>Kembali (Gross)</span>
              <span>{{ formatCurrency(totalKembaliRaw) }}</span>
            </div>
            <div class="summary-line text-orange-darken-3 italic">
              <span>Pundi Amal (Receh)</span>
              <div class="d-flex align-center">
                <span class="mr-2">{{ formatCurrency(pundiAmal) }}</span>
                <v-icon size="x-small" @click="pundiAmal = 0">mdi-close-circle</v-icon>
              </div>
            </div>
            <div class="summary-line mt-2 pt-2 border-t font-weight-black text-success">
              <span>NETTO KEMBALI</span>
              <span class="text-h6">{{ formatCurrency(nettoKembali) }}</span>
            </div>
          </template>

          <div v-else-if="sisaPiutang > 0" class="summary-line text-error font-weight-black">
            <span>SISA PIUTANG</span>
            <span class="text-h6">{{ formatCurrency(sisaPiutang) }}</span>
          </div>

          <div v-else class="summary-line text-blue-darken-3 font-weight-black">
            <span>STATUS</span>
            <span class="text-h6">LUNAS</span>
          </div>
        </div>
      </v-card-text>

      <v-card-actions class="pa-5 pt-0">
        <v-btn block color="primary" variant="elevated" size="large" class="rounded-lg font-weight-bold"
          prepend-icon="mdi-content-save" @click="handleConfirm">
          Simpan Invoice
        </v-btn>
      </v-card-actions>
    </v-card>

    <BankSearchModal v-model="showBankModal" @bank-selected="onBankSelected" />
  </v-dialog>
</template>

<style scoped>
.modern-payment-modal :deep(*) {
  font-size: 11px !important;
}

.section-label {
  font-weight: 800;
  color: #616161;
  letter-spacing: 0.5px;
}

.payment-input :deep(.v-field__input) {
  background-color: #ffffff !important;
  font-weight: 700;
  text-align: right;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.text-h6 {
  font-size: 16px !important;
}

.italic {
  font-style: italic;
}

.clickable-field :deep(input) {
  cursor: pointer !important;
  color: #1976D2;
  font-weight: 600;
}
</style>
