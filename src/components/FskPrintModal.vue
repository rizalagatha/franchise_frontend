<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import api from '@/services/api';
import { useToast } from 'vue-toastification';
import Logo from '@/assets/logo.png';

const props = defineProps<{
  modelValue: boolean;
  nomorFsk: string | null;
}>();

const emit = defineEmits(['update:modelValue']);
const toast = useToast();
const printData = ref<any>(null);
const isLoading = ref(false);

const formatRupiah = (v: any) => new Intl.NumberFormat('id-ID').format(Number(v) || 0);

/** * Menghitung Total Keseluruhan Setoran
 */
const totalDetail1 = computed(() => {
  return printData.value?.detail1?.reduce((sum: number, item: any) => sum + Number(item.nominal), 0) || 0;
});

const fetchData = async () => {
  if (!props.nomorFsk) return;
  isLoading.value = true;
  try {
    const res = await api.get(`/fsk/print/${props.nomorFsk}`);
    printData.value = res.data;
  } catch (err) {
    toast.error("Gagal memuat data cetak.");
  } finally { isLoading.value = false; }
};

const triggerPrint = () => {
  const content = document.getElementById("fsk-print-area");
  if (!content) return;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed"; iframe.style.width = "0"; iframe.style.height = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <html>
      <head>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: 'Arial', sans-serif; font-size: 11px; color: black; margin: 0; padding: 0; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .text-uppercase { text-transform: uppercase; }

          .logo-img { height: 35px; width: auto; margin-right: 12px; }
          .header-table { width: 100%; border: none !important; margin-bottom: 10px; }
          .header-table td { border: none !important; padding: 0; vertical-align: top; }
          .title-area { border-top: 1px solid black; border-bottom: 1px solid black; padding: 5px 0; margin: 10px 0; }

          /* Tabel Utama & Summary Box */
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid black; padding: 3px 5px; }
          .no-border, .no-border td { border: none !important; padding: 1px 0; }

          /* Footer Layout */
          .footer-layout-table { width: 100%; border: none !important; margin-top: 15px; }
          .footer-layout-table td { border: none !important; padding: 0; vertical-align: top; }

          .sig-item { text-align: center; width: 130px; display: inline-block; margin-left: 20px; }
          .sig-space { height: 45px; }
        </style>
      </head>
      <body>${content.innerHTML}</body>
    </html>
  `);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
};

watch(() => props.modelValue, (v) => { if (v) fetchData(); });
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="1100px" persistent>
    <v-card rounded="lg">
      <v-toolbar color="blue-grey-darken-4" density="compact">
        <v-toolbar-title class="text-body-2 font-weight-bold">Pratinjau Cetak FSK</v-toolbar-title>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" @click="$emit('update:modelValue', false)" variant="text" density="compact"></v-btn>
      </v-toolbar>

      <v-card-text class="pa-4 bg-grey-lighten-3 overflow-y-auto" style="max-height: 85vh;">
        <div v-if="printData" id="fsk-print-area" class="bg-white pa-8 mx-auto fsk-print-body" style="width: 1000px;">

          <table class="header-table no-border">
            <tr>
              <td width="50"><img :src="Logo" class="logo-img" /></td>
              <td>
                <div class="font-bold text-uppercase" style="font-size: 12px;">{{ printData.perusahaan.perush_nama }}
                </div>
                <div style="font-size: 10px;">{{ printData.perusahaan.perush_alamat }}</div>
                <div style="font-size: 10px;">WA: {{ printData.perusahaan.perush_telp }}</div>
              </td>
              <td class="text-right" style="font-size: 10px; vertical-align: bottom;">
                Created: {{ printData.header.created_at }}
              </td>
            </tr>
          </table>

          <div class="title-area">
            <div class="font-bold text-uppercase" style="font-size: 13px;">Form Setoran Kasir</div>
          </div>

          <table class="no-border mb-2" style="width: auto;">
            <tr>
              <td width="100">Nomor Setoran</td>
              <td width="10">:</td>
              <td class="font-bold">{{ printData.header.fsk_nomor }}</td>
            </tr>
            <tr>
              <td>Tanggal Setor</td>
              <td>:</td>
              <td>{{ printData.header.fsk_tanggal }}</td>
            </tr>
          </table>

          <table class="mb-4">
            <thead>
              <tr style="background-color: #f2f2f2;">
                <th width="30">No</th>
                <th class="text-left">JENIS</th>
                <th width="100">TGL TRANSFER</th>
                <th width="80">KDCUS</th>
                <th class="text-left">NAMA CUSTOMER</th>
                <th width="150">INVOICE</th>
                <th width="110" class="text-right">NOMINAL</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, i) in printData.detail1" :key="i">
                <td class="text-center">{{ Number(i) + 1 }}.</td>
                <td>{{ d.jenis }}</td>
                <td class="text-center">{{ d.tgl_trf || '' }}</td>
                <td class="text-center">{{ d.kdcus }}</td>
                <td>{{ d.nmcus }}</td>
                <td>{{ d.inv }}</td>
                <td class="text-right">{{ formatRupiah(d.nominal) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="font-bold">
                <td colspan="6" class="text-right">Total Setoran</td>
                <td class="text-right">{{ formatRupiah(totalDetail1) }}</td>
              </tr>
            </tfoot>
          </table>

          <table class="footer-layout-table no-border">
            <tr>
              <td width="320">
                <table style="width: 100%; border: 1px solid black;">
                  <tr class="font-bold">
                    <td style="border: 1px solid black; text-align: center;">Total Setoran</td>
                    <td style="border: 1px solid black; text-align: right;" width="110">{{ formatRupiah(totalDetail1) }}
                    </td>
                  </tr>
                  <tr v-for="r in printData.detail2" :key="r.jenis">
                    <td class="text-uppercase" style="border: 1px solid black;">{{ r.jenis }}</td>
                    <td class="text-right" width="110" style="border: 1px solid black;">{{ formatRupiah(r.nominal) }}
                    </td>
                  </tr>
                </table>
              </td>

              <td class="text-right">
                <div class="sig-item">
                  <div>Kasir,</div>
                  <div class="sig-space"></div>
                  <div>( <strong>{{ printData.header.fsk_kasir }}</strong> )</div>
                  <div style="font-size: 9px;">Sales Counter</div>
                </div>
                <div class="sig-item">
                  <div>Mengetahui,</div>
                  <div class="sig-space"></div>
                  <div>( .................... )</div>
                  <div style="font-size: 9px;">Ka. TOKO</div>
                </div>
                <div class="sig-item">
                  <div>Diterima,</div>
                  <div class="sig-space"></div>
                  <div>( .................... )</div>
                  <div style="font-size: 9px;">Finance</div>
                </div>
              </td>
            </tr>
          </table>

        </div>
      </v-card-text>

      <v-divider></v-divider>
      <v-card-actions class="pa-4 bg-white">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="elevated" prepend-icon="mdi-printer" @click="triggerPrint"
          :disabled="!printData">
          Cetak Laporan
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.fsk-print-body,
.fsk-print-body :deep(*) {
  font-family: 'Arial', sans-serif !important;
  font-size: 11px !important;
  color: black !important;
  line-height: 1.2 !important;
}

.logo-img {
  height: 35px;
  width: auto;
}

table {
  border: 1px solid #000;
}

th,
td {
  border: 1px solid black;
  padding: 4px 6px;
}

.no-border,
.no-border :deep(td) {
  border: none !important;
}

.sig-space {
  height: 45px;
}
</style>
