<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import { useToast } from 'vue-toastification';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const MENU_ID = '1';

// --- State ---
const isEditMode = computed(() => !!route.params.kode);
const isSaving = ref(false);
const isLoading = ref(true);
const showConfirmSave = ref(false);
const showCancelDialog = ref(false);

const form = ref({
  Kode: '',
  Nama: '',
  Password: '',
  Aktif: true
});

// State untuk tabel Hak Akses
const listMenu = ref<any[]>([]);
const checkAll = ref(false);

const headers = [
  { title: 'No', key: 'no', width: '50px' },
  { title: 'Id', key: 'men_id', width: '60px' },
  { title: 'Nama', key: 'men_nama' },
  { title: 'View', key: 'view', align: 'center', width: '80px' },
  { title: 'Insert', key: 'insert', align: 'center', width: '80px' },
  { title: 'Update', key: 'edit', align: 'center', width: '80px' },
  { title: 'Delete', key: 'delete', align: 'center', width: '80px' },
];

// --- Methods ---
const fetchData = async () => {
  isLoading.value = true;
  try {
    const endpoint = isEditMode.value
      ? `/users/form-resources/${route.params.kode}`
      : `/users/form-resources`;

    const res = await api.get(endpoint);

    // Inisialisasi list menu dengan default hak akses = 'N' / false
    listMenu.value = res.data.menus.map((m: any) => ({
      ...m,
      view: false,
      insert: false,
      edit: false,
      delete: false
    }));

    if (isEditMode.value && res.data.userData) {
      const u = res.data.userData.user;
      form.value = {
        Kode: u.user_kode,
        Nama: u.user_nama,
        Password: '', // Kosongkan password saat edit, isi jika ingin ubah
        Aktif: u.user_aktif === 'Y'
      };

      // Terapkan hak akses dari database ke listMenu
      res.data.userData.hakAkses.forEach((hak: any) => {
        const menuTarget = listMenu.value.find(m => m.men_id === hak.hak_men_id);
        if (menuTarget) {
          menuTarget.view = hak.hak_men_view === 'Y';
          menuTarget.insert = hak.hak_men_insert === 'Y';
          menuTarget.edit = hak.hak_men_edit === 'Y';
          menuTarget.delete = hak.hak_men_delete === 'Y';
        }
      });
    }
  } catch (error) {
    toast.error('Gagal memuat form user.');
    router.back();
  } finally {
    isLoading.value = false;
  }
};

// Fitur Cek All
watch(checkAll, (val) => {
  listMenu.value.forEach(m => {
    m.view = val;
    m.insert = val;
    m.edit = val;
    m.delete = val;
  });
});

const handleSave = () => {
  if (!form.value.Kode || !form.value.Nama) {
    return toast.error('Kode dan Nama wajib diisi!');
  }
  if (!isEditMode.value && !form.value.Password) {
    return toast.error('Password wajib diisi untuk User Baru!');
  }

  // Tampilkan dialog konfirmasi
  showConfirmSave.value = true;
};

const executeSave = async () => {
  isSaving.value = true;
  try {
    const payloadHakAkses = listMenu.value.map(m => ({
      men_id: m.men_id,
      view: m.view ? 'Y' : 'N',
      insert: m.insert ? 'Y' : 'N',
      edit: m.edit ? 'Y' : 'N',
      delete: m.delete ? 'Y' : 'N'
    }));

    const payload = {
      isNew: !isEditMode.value,
      data: {
        ...form.value,
        hakAkses: payloadHakAkses
      }
    };

    await api.post('/users/save', payload);
    toast.success('Data User berhasil disimpan.');
    showConfirmSave.value = false;
    router.push('/tools/users');
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Gagal menyimpan data.');
  } finally {
    isSaving.value = false;
  }
};

const handleCancel = () => {
  showCancelDialog.value = true;
};

const executeCancel = () => {
  showCancelDialog.value = false;
  router.back();
};

onMounted(() => fetchData());
</script>

<template>
  <PageLayout :title="isEditMode ? 'Ubah Data User' : 'Data User Baru'" desktop-mode icon="mdi-account-key">
    <template #header-actions>
      <v-btn color="primary" @click="handleSave" :loading="isSaving" prepend-icon="mdi-content-save">Simpan</v-btn>
      <v-btn variant="outlined" @click="handleCancel">Batal</v-btn>
    </template>

    <v-card v-if="!isLoading" class="d-flex flex-column fill-height border-0 shadow-none">

      <v-card-text class="pt-4 pb-0 bg-grey-lighten-4 border-bottom">
        <v-row dense class="align-center mb-2">
          <v-col cols="12" md="4" lg="3">
            <v-text-field v-model="form.Kode" label="Kode" density="compact" variant="outlined" hide-details
              :readonly="isEditMode" :class="{ 'bg-grey-lighten-2': isEditMode }" class="bg-white" />
          </v-col>
          <v-col v-if="!isEditMode" cols="12" md="4" class="text-caption text-error">
            Baru = Kode di isi dulu
          </v-col>
        </v-row>

        <v-row dense class="align-center mb-2">
          <v-col cols="12" md="6" lg="4">
            <v-text-field v-model="form.Nama" label="Nama" density="compact" variant="outlined" hide-details
              class="bg-white" />
          </v-col>
        </v-row>

        <v-row dense class="align-center mb-4">
          <v-col cols="12" md="4" lg="3">
            <v-text-field v-model="form.Password" label="Password" type="password" density="compact" variant="outlined"
              hide-details class="bg-white" :placeholder="isEditMode ? 'Kosongkan jika tak diubah' : ''" />
          </v-col>
          <v-col cols="auto">
            <v-checkbox-btn v-model="form.Aktif" label="Aktif" color="primary" inline class="mr-4"></v-checkbox-btn>
          </v-col>
          <v-col cols="auto">
            <v-checkbox-btn v-model="checkAll" label="Cek All" color="primary" inline></v-checkbox-btn>
          </v-col>
        </v-row>
      </v-card-text>

      <div class="flex-grow-1 overflow-hidden pa-4">
        <div class="border rounded h-100 table-container">
          <v-data-table :headers="headers" :items="listMenu" density="compact" fixed-header
            class="desktop-table fill-height-table" :items-per-page="-1" hide-default-footer>

            <template #[`item.no`]="{ index }">
              {{ index + 1 }}
            </template>

            <template #[`item.view`]="{ item }">
              <v-checkbox-btn v-model="item.view" density="compact" color="primary"
                class="d-flex justify-center"></v-checkbox-btn>
            </template>
            <template #[`item.insert`]="{ item }">
              <v-checkbox-btn v-model="item.insert" density="compact" color="primary"
                class="d-flex justify-center"></v-checkbox-btn>
            </template>
            <template #[`item.edit`]="{ item }">
              <v-checkbox-btn v-model="item.edit" density="compact" color="primary"
                class="d-flex justify-center"></v-checkbox-btn>
            </template>
            <template #[`item.delete`]="{ item }">
              <v-checkbox-btn v-model="item.delete" density="compact" color="primary"
                class="d-flex justify-center"></v-checkbox-btn>
            </template>

          </v-data-table>
        </div>
      </div>

    </v-card>

    <div v-else class="d-flex justify-center align-center fill-height">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <v-dialog v-model="showConfirmSave" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pa-4">Konfirmasi Simpan</v-card-title>
        <v-card-text class="pa-4 pt-0">
          Yakin ingin menyimpan pengaturan hak akses untuk user <strong>{{ form.Kode || 'Baru' }}</strong>?
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showConfirmSave = false">Batal</v-btn>
          <v-btn color="primary" variant="elevated" @click="executeSave" :loading="isSaving">Ya, Simpan</v-btn>
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
          Yakin ingin membatalkan? Perubahan pada data user dan hak akses tidak akan disimpan.
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showCancelDialog = false">Tidak</v-btn>
          <v-btn color="error" variant="elevated" @click="executeCancel">Ya, Batal</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </PageLayout>
</template>

<style scoped>
.table-container {
  overflow: hidden;
}

/* Terapkan font 11px ke seluruh isi tabel (header dan data) */
.desktop-table :deep(*) {
  font-size: 11px !important;
}

.desktop-table :deep(th) {
  background-color: #f5f5f5 !important;
  font-weight: bold !important;
  color: #424242 !important;
  border-right: 1px solid #e0e0e0;
  text-transform: uppercase;
  /* Opsional: agar header lebih tegas */
}

.desktop-table :deep(td) {
  border-right: 1px solid #e0e0e0;
  padding: 0 8px !important;
}

.desktop-table :deep(tr:hover) {
  background-color: #f8f9fa !important;
}

/* Menyesuaikan ukuran checkbox di dalam tabel agar tidak kebesaran */
.desktop-table :deep(.v-selection-control) {
  --v-selection-control-size: 24px;
}
</style>
