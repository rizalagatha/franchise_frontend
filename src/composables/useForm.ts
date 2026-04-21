// src/composables/useForm.ts
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useAuthStore } from "@/stores/authStore";

interface UseFormOptions<T> {
  menuId: string;
  initialData: T;
  fetchApi?: () => Promise<T>;
  submitApi: (data: T) => Promise<void>;
  onSuccessRoute?: string;
}

export function useForm<T>(options: UseFormOptions<T>) {
  const route = useRoute();
  const router = useRouter();
  const toast = useToast();
  const authStore = useAuthStore();

  const isEditMode = computed(
    () => !!(route.params.kode || route.params.nomor),
  );

  const isLoading = ref(false);
  const isSaving = ref(false);
  const showSaveDialog = ref(false);
  const showCancelDialog = ref(false);
  const showCloseDialog = ref(false);

  // Form Data reaktif
  const formData = ref<T>(JSON.parse(JSON.stringify(options.initialData)));

  const canSave = computed(() => {
    const permission = isEditMode.value ? "edit" : "insert";
    return authStore.can(options.menuId, permission);
  });

  const goBack = () => {
    if (options.onSuccessRoute) {
      router.push(options.onSuccessRoute);
    } else if (route.meta.browseRoute) {
      router.push({ name: route.meta.browseRoute as string });
    } else {
      window.history.length > 1 ? router.back() : router.push("/");
    }
  };

  const fetchData = async () => {
    if (!options.fetchApi) return;
    isLoading.value = true;
    try {
      const data = await options.fetchApi();
      formData.value = data;
    } catch (e) {
      toast.error("Gagal memuat data.");
      goBack();
    } finally {
      isLoading.value = false;
    }
  };

  const executeSave = async () => {
    isSaving.value = true;
    try {
      await options.submitApi(formData.value as T);
      showSaveDialog.value = false;
      goBack();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan data.");
    } finally {
      isSaving.value = false;
    }
  };

  const executeCancel = () => {
    showCancelDialog.value = false;
    goBack();
  };

  const executeClose = () => {
    // <--- TAMBAH INI
    showCloseDialog.value = false;
    goBack();
  };

  return {
    isEditMode,
    isLoading,
    isSaving,
    showSaveDialog,
    showCancelDialog,
    showCloseDialog,
    formData,
    canSave,
    goBack,
    fetchData,
    executeSave,
    executeCancel,
    executeClose,
    params: route.params,
  };
}
