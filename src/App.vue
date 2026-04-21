<script setup lang="ts">
import { computed, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "./stores/authStore";

// Impor layout secara statis agar Vite tidak bingung saat proses build
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import EmptyLayout from "@/layouts/EmptyLayout.vue";
import PrintLayout from "@/layouts/PrintLayout.vue";

const authStore = useAuthStore();
const route = useRoute();

const layouts: Record<string, any> = {
  DefaultLayout,
  EmptyLayout,
  PrintLayout,
};

onUnmounted(() => {
  authStore.clearConnectivityCheck();
});

// Pilih layout berdasarkan meta data di router
const layoutComponent = computed(() => {
  const layoutName = (route.meta.layout as string) || "DefaultLayout";
  // Jika layout ditemukan di mapping, gunakan. Jika tidak, balik ke DefaultLayout.
  return layouts[layoutName] || DefaultLayout;
});
</script>

<template>
  <!-- PRINT ROUTE: TANPA V-APP -->
  <component v-if="route.meta.layout === 'PrintLayout'" :is="layoutComponent" />

  <!-- NORMAL APP -->
  <v-app v-else class="desktop-app-container bg-background">
    <component :is="layoutComponent" />
  </v-app>
</template>

<style scoped>
/* Menargetkan v-main di dalam layout yang dimuat */
.desktop-app-container :deep(.v-main) {
  min-height: 100vh;
}
</style>
