<script setup lang="ts">
import { ref, computed } from "vue";
import PageLayout from "@/components/PageLayout.vue";

// 1. Definisikan Props
const props = withDefaults(
  defineProps<{
    title: string;
    menuId: string;
    icon?: string;
    headers: any[];
    items: any[];
    isLoading?: boolean;
    searchPlaceholder?: string;
    itemValue?: string;
    canInsert?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canExport?: boolean;
    selectStrategy?: "single" | "page" | "all";
    rowPropsFn?: (data: any) => any;
    showExpand?: boolean;
    expanded?: any[];
    selected?: any[];
    loadingDetails?: Set<string>;
  }>(),
  {
    icon: "mdi-table",
    isLoading: false,
    searchPlaceholder: "Cari data...",
    itemValue: "Kode",
    canInsert: false,
    canEdit: false,
    canDelete: false,
    canExport: false,
    selectStrategy: "single",
    selected: () => [],
    showExpand: false,
    expanded: () => [],
    loadingDetails: () => new Set<string>(),
  },
);

// 2. Definisikan Emits
const emit = defineEmits([
  "refresh",
  "add",
  "edit",
  "delete",
  "export",
  "row-click",
  "update:expanded",
  "update:selected",
]);

// 3. State Internal
const search = ref("");
const internalSelected = computed({
  get: () => props.selected || [],
  set: (val) => emit("update:selected", val),
});

const finalHeaders = computed(() => {
  if (!props.showExpand) return props.headers;

  return [
    {
      title: "",
      key: "data-table-expand",
      width: "48px",
      sortable: false,
    },
    ...props.headers,
  ];
});

const isSingleSelected = computed(() => internalSelected.value.length === 1);

// 4. Logika Klik Baris
const handleRowClick = (event: PointerEvent, { item }: { item: any }) => {
  const raw = item?.raw || item;

  if (props.selectStrategy === "single") {
    if (
      internalSelected.value.length > 0 &&
      internalSelected.value[0][props.itemValue] === raw[props.itemValue]
    ) {
      internalSelected.value = [];
    } else {
      internalSelected.value = [raw];
    }
  }

  emit("row-click", raw);
};

// 5. Highlight Warna Baris
const resolvedRowProps = (data: any) => {
  let customProps: any = {};
  if (props.rowPropsFn) customProps = props.rowPropsFn(data);

  const raw = data.item?.raw || data.item;
  const isSelected = internalSelected.value.some(
    (s) => s[props.itemValue] === raw[props.itemValue],
  );

  let classes = customProps.class || "";
  if (isSelected) classes += " v-data-table__selected";

  return {
    ...customProps,
    class: classes,
    style: "cursor: pointer; " + (customProps.style || ""),
  };
};

const clearSelection = () => {
  internalSelected.value = [];
};
defineExpose({ clearSelection, search });
</script>

<template>
  <PageLayout :title="title" :menu-id="menuId" :icon="icon">
    <template #header-actions>
      <v-btn
        v-if="canInsert"
        size="small"
        color="primary"
        prepend-icon="mdi-plus"
        @click="emit('add')"
        >Baru</v-btn
      >
      <v-btn
        v-if="canEdit"
        size="small"
        prepend-icon="mdi-pencil"
        :disabled="!isSingleSelected"
        @click="emit('edit', internalSelected[0])"
        >Ubah</v-btn
      >
      <v-btn
        v-if="canDelete"
        size="small"
        color="error"
        prepend-icon="mdi-delete"
        :disabled="!isSingleSelected"
        @click="emit('delete', internalSelected[0])"
        >Hapus</v-btn
      >
      <v-btn
        v-if="canExport"
        size="small"
        color="green"
        prepend-icon="mdi-file-excel"
        @click="emit('export')"
        >Export</v-btn
      >
      <slot name="extra-actions" :selected="internalSelected"></slot>
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-close"
        @click="$router.back()"
        >Tutup</v-btn
      >
    </template>

    <div class="browse-content">
      <div
        class="filter-section d-flex align-center bg-grey-lighten-4 pa-2 rounded mb-3 border ga-3"
      >
        <slot name="filter-left"></slot>
        <slot name="filter-right-prepend"></slot>
        <v-text-field
          v-model="search"
          :placeholder="searchPlaceholder"
          density="compact"
          variant="outlined"
          hide-details
          prepend-inner-icon="mdi-magnify"
          style="width: 300px; flex: none"
          class="bg-white"
        />
        <v-btn
          @click="emit('refresh')"
          color="primary"
          icon="mdi-refresh"
          variant="text"
          :loading="isLoading"
          size="small"
        ></v-btn>

        <v-spacer></v-spacer>

        <slot name="filter-right"></slot>
      </div>

      <div class="table-container">
        <v-data-table
          v-model="internalSelected"
          :headers="finalHeaders"
          :items="items"
          :search="search"
          :loading="isLoading"
          :item-value="itemValue"
          :select-strategy="selectStrategy"
          :expanded="expanded"
          @update:expanded="emit('update:expanded', $event)"
          return-object
          density="compact"
          fixed-header
          class="desktop-table fill-height-table colored-header zebra-table"
          :row-props="resolvedRowProps"
          @click:row="handleRowClick"
          :items-per-page="50"
        >
          <template
            v-for="slotName in Object.keys($slots).filter(
              (k) =>
                ![
                  'extra-actions',
                  'filter-left',
                  'filter-right-prepend',
                  'detail',
                ].includes(k),
            )"
            v-slot:[slotName]="slotProps"
          >
            <slot :name="slotName" v-bind="slotProps"></slot>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@10"></v-skeleton-loader>
          </template>

          <template v-slot:no-data>
            <div class="text-center pa-6 text-grey font-weight-medium">
              <v-icon size="48" class="mb-2 opacity-50"
                >mdi-database-remove</v-icon
              >
              <div>Tidak ada data tersedia.</div>
            </div>
          </template>

          <template #expanded-row="{ columns, item }">
            <tr>
              <td :colspan="columns.length" class="expanded-detail-cell">
                <div class="detail-container w-100">
                  <div class="detail-table-wrapper elevation-1 w-100">
                    <slot name="detail" :item="item.raw || item"></slot>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </v-data-table>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.browse-content :deep(*) {
  font-size: 11px !important;
}
.browse-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 180px);
}
.table-container {
  flex-grow: 1;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
.colored-header :deep(thead th) {
  background-color: #1976d2 !important;
  color: white !important;
  font-weight: bold !important;
  text-transform: uppercase;
  height: 36px !important;
}
.desktop-table :deep(tr.v-data-table__selected) {
  background-color: #e3f2fd !important;
}
.desktop-table :deep(tbody tr:hover) {
  background-color: #f5f5f5 !important;
}
.zebra-table :deep(tbody tr:nth-of-type(odd)) {
  background-color: #fcfcfc !important;
}
.desktop-table {
  height: 100%;
}
.desktop-table :deep(.v-table__wrapper) {
  height: 100%;
  overflow-y: auto;
}
.filter-section {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  white-space: nowrap;
}
.filter-section :deep(.v-text-field) {
  flex: none !important;
}

/* KUNCI RATA KIRI: Hilangkan padding yang bikin miring dan paksa w-100 */
.expanded-detail-cell {
  padding: 0 !important;
  background-color: #f8f9fa;
  /* Pastikan cell-nya tidak membatasi elemen sticky di dalamnya */
  position: relative;
}
.detail-container {
  /* Trik "Retailku": Bikin container sticky ke kiri */
  position: sticky !important;
  left: 0;
  z-index: 2;

  display: flex;
  justify-content: flex-start;
  align-items: flex-start;

  padding: 12px;
  /* Sesuaikan lebar table-nya agar tidak bablas,
     gunakan fit-content atau max-width sesuai kebutuhan */
  width: fit-content;
  min-width: 100%;
  box-sizing: border-box;
}
.detail-table-wrapper {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background-color: white;

  /* Supaya tidak terlalu lebar di layar besar */
  width: 100%;
  max-width: 1000px;
}
</style>
