<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import api from "@/services/api";
import { useToast } from "vue-toastification";

interface MenuItem {
  men_id: string;
  men_nama: string;
  view: boolean;
  insert: boolean;
  edit: boolean;
  delete: boolean;
}

interface UserForm {
  Kode: string;
  Nama: string;
  Password: string;
  Aktif: boolean;
  listMenu: MenuItem[];
}

// Components & Composables
import BaseForm from "@/components/BaseForm.vue";
import { useForm } from "@/composables/useForm";

const route = useRoute();
const toast = useToast();
const MENU_ID = "1";

const checkAll = ref(false);

const headers = [
  { title: "No", key: "no", width: "50px" },
  { title: "Id", key: "men_id", width: "60px" },
  { title: "Nama", key: "men_nama" },
  { title: "View", key: "view", align: "center" as const, width: "80px" },
  { title: "Insert", key: "insert", align: "center" as const, width: "80px" },
  { title: "Update", key: "edit", align: "center" as const, width: "80px" },
  { title: "Delete", key: "delete", align: "center" as const, width: "80px" },
];

// --- Inisialisasi useForm (Sesuai dengan PembelianView) ---
const {
  isEditMode,
  isLoading,
  isSaving,
  showSaveDialog,
  showCancelDialog,
  showCloseDialog, // <-- TAMBAHKAN INI
  executeClose, // <-- TAMBAHKAN INI
  formData,
  fetchData,
  executeSave,
} = useForm<UserForm>({
  menuId: MENU_ID,
  onSuccessRoute: "/tools/users",
  initialData: {
    Kode: "",
    Nama: "",
    Password: "",
    Aktif: true,
    listMenu: [] as MenuItem[],
  },

  fetchApi: async (): Promise<any> => {
    const kodeParam = route.params.kode || route.params.nomor;
    const endpoint: string = isEditMode.value
      ? `/users/form-resources/${kodeParam}`
      : `/users/form-resources`;

    const res: any = await api.get(endpoint);

    let mappedMenu: any[] = res.data.menus.map((m: any) => ({
      ...m,
      view: false,
      insert: false,
      edit: false,
      delete: false,
    }));

    let defaultForm = { Kode: "", Nama: "", Password: "", Aktif: true };

    if (isEditMode.value && res.data.userData) {
      const u = res.data.userData.user;
      defaultForm = {
        Kode: u.user_kode,
        Nama: u.user_nama,
        Password: "",
        Aktif: u.user_aktif === "Y",
      };

      res.data.userData.hakAkses.forEach((hak: any) => {
        const target = mappedMenu.find((m: any) => m.men_id === hak.hak_men_id);
        if (target) {
          target.view = hak.hak_men_view === "Y";
          target.insert = hak.hak_men_insert === "Y";
          target.edit = hak.hak_men_edit === "Y";
          target.delete = hak.hak_men_delete === "Y";
        }
      });
    }
    return { ...defaultForm, listMenu: mappedMenu };
  },

  submitApi: async (data: any) => {
    const payloadHakAkses = data.listMenu.map((m: any) => ({
      men_id: m.men_id,
      view: m.view ? "Y" : "N",
      insert: m.insert ? "Y" : "N",
      edit: m.edit ? "Y" : "N",
      delete: m.delete ? "Y" : "N",
    }));

    const payload = {
      isNew: !isEditMode.value,
      data: {
        Kode: data.Kode,
        Nama: data.Nama,
        Password: data.Password,
        Aktif: data.Aktif ? "Y" : "N",
        hakAkses: payloadHakAkses,
      },
    };
    await api.post("/users/save", payload);
    toast.success("Data User berhasil disimpan.");
  },
});

// Validasi Form
const validateForm = () => {
  if (!formData.value.Kode || !formData.value.Nama)
    return toast.error("Kode dan Nama wajib diisi!");
  if (!isEditMode.value && !formData.value.Password)
    return toast.error("Password wajib diisi untuk User Baru!");
  showSaveDialog.value = true;
};

// Logika Tombol BATAL (Mereset Form ke awal)
const handleConfirmCancel = () => {
  showCancelDialog.value = false;
  fetchData();
  toast.info("Inputan di-reset.");
};

// Cek All Watcher
watch(checkAll, (val) => {
  if (formData.value && formData.value.listMenu) {
    formData.value.listMenu.forEach((m: any) => {
      m.view = val;
      m.insert = val;
      m.edit = val;
      m.delete = val;
    });
  }
});

onMounted(() => fetchData());
</script>

<template>
  <BaseForm
    :title="isEditMode ? 'Ubah Data User' : 'Data User Baru'"
    :menu-id="MENU_ID"
    icon="mdi-account-key"
    :item-name="formData?.Kode || 'User Baru'"
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
      <div class="desktop-form-section header-section" v-if="formData">
        <h3 class="text-subtitle-2 font-weight-bold mb-3 text-primary">
          Informasi User
        </h3>

        <v-text-field
          v-model="formData.Kode"
          label="Kode User"
          density="compact"
          variant="outlined"
          hide-details
          :readonly="isEditMode"
          :class="{ 'bg-grey-lighten-2': isEditMode }"
          class="bg-white mb-3"
        />

        <v-text-field
          v-model="formData.Nama"
          label="Nama Lengkap"
          density="compact"
          variant="outlined"
          hide-details
          class="bg-white mb-3"
        />

        <v-text-field
          v-model="formData.Password"
          label="Password"
          type="password"
          density="compact"
          variant="outlined"
          hide-details
          class="bg-white mb-4"
          :placeholder="isEditMode ? '(Kosongkan jika tidak diubah)' : ''"
        />

        <div
          class="d-flex align-center justify-space-between px-2 bg-grey-lighten-4 rounded py-1 border"
        >
          <v-checkbox-btn
            v-model="formData.Aktif"
            label="User Aktif"
            color="primary"
            inline
            hide-details
          ></v-checkbox-btn>
          <v-checkbox-btn
            v-model="checkAll"
            label="Pilih Semua"
            color="primary"
            inline
            hide-details
          ></v-checkbox-btn>
        </div>
      </div>
    </template>

    <template #right-column>
      <div
        class="desktop-form-section d-flex flex-column fill-height"
        style="padding: 0 !important; overflow: hidden"
        v-if="formData"
      >
        <v-data-table
          :headers="headers"
          :items="formData.listMenu"
          density="compact"
          fixed-header
          class="desktop-table fill-height-table colored-header-sub zebra-table"
          :items-per-page="-1"
          hide-default-footer
        >
          <template #[`item.no`]="{ index }">{{ index + 1 }}</template>

          <template #[`item.view`]="{ item }">
            <v-checkbox-btn
              v-model="item.view"
              density="compact"
              color="primary"
              class="d-flex justify-center"
              hide-details
            ></v-checkbox-btn>
          </template>

          <template #[`item.insert`]="{ item }">
            <v-checkbox-btn
              v-model="item.insert"
              density="compact"
              color="primary"
              class="d-flex justify-center"
              hide-details
            ></v-checkbox-btn>
          </template>

          <template #[`item.edit`]="{ item }">
            <v-checkbox-btn
              v-model="item.edit"
              density="compact"
              color="primary"
              class="d-flex justify-center"
              hide-details
            ></v-checkbox-btn>
          </template>

          <template #[`item.delete`]="{ item }">
            <v-checkbox-btn
              v-model="item.delete"
              density="compact"
              color="primary"
              class="d-flex justify-center"
              hide-details
            ></v-checkbox-btn>
          </template>
        </v-data-table>
      </div>
    </template>
  </BaseForm>
</template>

<style scoped>
.colored-header-sub :deep(thead th) {
  background-color: #f5f5f5 !important;
  font-weight: bold !important;
  color: #424242 !important;
  border-right: 1px solid #e0e0e0;
  text-transform: uppercase;
}

.desktop-table :deep(td) {
  border-right: 1px solid #e0e0e0;
  padding: 0 8px !important;
}

.desktop-table :deep(tr:hover) {
  background-color: #f8f9fa !important;
}

.desktop-table :deep(.v-selection-control) {
  --v-selection-control-size: 24px;
}
</style>
