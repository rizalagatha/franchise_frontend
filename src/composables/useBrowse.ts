import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "vue-toastification";

// Interface untuk opsi yang dikirim saat memanggil composable
interface UseBrowseOptions<T> {
  menuId: string;
  fetchApi: () => Promise<T[]>; // Fungsi API (misal: api.get('/customers'))
  immediate?: boolean; // Apakah langsung fetch saat onMounted? (Default: true)
}

export function useBrowse<T = any>(options: UseBrowseOptions<T>) {
  const authStore = useAuthStore();
  const toast = useToast();

  // --- STATE ---
  const items = ref<T[]>([]) as ReturnType<typeof ref<T[]>>;
  const isLoading = ref(false);
  const selected = ref<T[]>([]);
  const search = ref("");

  // --- HAK AKSES (PERMISSIONS) ---
  const canView = computed(() => authStore.can(options.menuId, "view"));
  const canInsert = computed(() => authStore.can(options.menuId, "insert"));
  const canEdit = computed(() => authStore.can(options.menuId, "edit"));
  const canDelete = computed(() => authStore.can(options.menuId, "delete"));
  const canExport = computed(() => authStore.can(options.menuId, "view")); // Export disamakan dengan view

  // --- HELPERS ---
  const isSingleSelected = computed(() => selected.value.length === 1);
  const selectedItem = computed(() => selected.value[0] || null);

  const detailsData = ref<Record<string, any[]>>({});
  const loadingDetails = ref<Set<string>>(new Set());

  // --- ACTIONS ---
  const clearSelection = () => {
    selected.value = [];
  };

  const fetchData = async () => {
    if (!canView.value) {
      toast.error(
        "Akses ditolak: Anda tidak memiliki izin untuk melihat menu ini.",
      );
      isLoading.value = false;
      return;
    }

    isLoading.value = true;
    clearSelection(); // Reset pilihan setiap kali data disegarkan

    try {
      const data = await options.fetchApi();
      items.value = data;
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Gagal memuat data dari server.",
      );
      console.error(error);
    } finally {
      isLoading.value = false;
    }
  };

  const handleLoadDetails = async (
    newlyExpanded: any[],
    fetchDetailApi: (id: string) => Promise<any[]>,
    itemValue: string = "Nomor",
  ) => {
    if (newlyExpanded.length === 0) return;

    const lastItem = newlyExpanded[newlyExpanded.length - 1];
    const id = typeof lastItem === "object" ? lastItem[itemValue] : lastItem;

    if (!id || detailsData.value[id] || loadingDetails.value.has(id)) return;

    loadingDetails.value.add(id);
    try {
      detailsData.value[id] = await fetchDetailApi(id);
    } catch (error) {
      detailsData.value[id] = [];
    } finally {
      loadingDetails.value.delete(id);
    }
  };

  // --- LIFECYCLE ---
  onMounted(() => {
    if (options.immediate !== false) {
      fetchData();
    }
  });

  return {
    // State
    items,
    isLoading,
    selected,
    search,

    // Permissions
    canView,
    canInsert,
    canEdit,
    canDelete,
    canExport,

    // Computed
    isSingleSelected,
    selectedItem,

    // Methods
    fetchData,
    clearSelection,
  };
}
