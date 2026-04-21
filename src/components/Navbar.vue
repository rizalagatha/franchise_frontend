<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import logoSrc from "@/assets/logo.png"; // Pastikan Anda sudah menyalin logo.png ke src/assets/
import { usePasswordDialog } from "@/composables/usePasswordDialog"; // Kita masih perlu ini

interface NavItem {
  title: string;
  to?: string;
  icon?: string;
  divider?: boolean;
  subItems?: NavItem[];
  onClick?: () => void;
}

interface MenuSection {
  title: string;
  icon: string;
  items: NavItem[];
}

interface MenuItem {
  title: string;
  icon: string;
  model: any;
  items?: NavItem[];
  sections?: MenuSection[];
  isLarge?: boolean;
}

// Stores and composables
const authStore = useAuthStore();
const router = useRouter();
const { openPasswordDialog } = usePasswordDialog();

// Component state
const scrolled = ref(false);
const userMenu = ref(false);

// State menu baru untuk Franchise
const daftarMenu = ref(false);
const transaksiMenu = ref(false);
const laporanMenu = ref(false);
const toolsMenu = ref(false);

// Computed properties
const appBarElevation = computed(() => (scrolled.value ? 2 : 0));
const appBarClass = computed(() => ({
  "navbar-scrolled": scrolled.value,
}));

// Access control helper (Sama seperti retail)
const hasAccess = (routeNameOrPath?: string) => {
  if (!routeNameOrPath) return true;

  const authStore = useAuthStore();
  const route = router
    .getRoutes()
    .find((r) => r.name === routeNameOrPath || r.path === routeNameOrPath);

  if (!route) return false;

  // Jika route tidak memerlukan login sama sekali, selalu tampilkan.
  if (!route.meta.requiresAuth) {
    return true;
  }

  // Jika route butuh login, cek apakah user sudah login.
  if (!authStore.isAuthenticated) {
    return false;
  }

  // Jika route butuh izin spesifik (punya menuId), cek izinnya.
  if (route.meta.menuId) {
    return authStore.allowedMenus.includes(route.meta.menuId as string);
  }

  // Jika sampai di sini, artinya route butuh login tapi tidak butuh izin spesifik.
  // Karena user sudah login, maka tampilkan menunya.
  return true;
};

// Menu configuration (BARU UNTUK FRANCHISE)
const menuItems: MenuItem[] = [
  {
    title: "Daftar",
    icon: "mdi-clipboard-list-outline",
    model: daftarMenu,
    items: [
      {
        title: "Customer",
        to: "/daftar/customer",
        icon: "mdi-account-outline",
      },
      {
        title: "Price List",
        to: "/daftar/price-list",
        icon: "mdi-format-list-numbered",
      },
      {
        title: "Cetak Barcode",
        to: "/daftar/cetak-barcode",
        icon: "mdi-barcode",
      },
      {
        title: "Rekening Bank",
        to: "/daftar/rekening",
        icon: "mdi-bank-outline",
      },
    ],
  },
  {
    title: "Transaksi",
    icon: "mdi-cash-register",
    model: transaksiMenu,
    items: [
      {
        title: "Pembelian",
        to: "/transaksi/pembelian",
        icon: "mdi-cart-arrow-down",
      },
      {
        title: "Minta Barang Pusat",
        to: "/transaksi/minta-barang-kaosan",
        icon: "mdi-truck-delivery-outline",
      },
      {
        title: "Koreksi Stok",
        to: "/transaksi/koreksi-stok",
        icon: "mdi-pencil-outline",
      },
      {
        title: "Standar Stok",
        to: "/transaksi/standar-stok",
        icon: "mdi-database-outline",
      },
      { title: "Kasir", to: "/transaksi/kasir", icon: "mdi-cash-register" },
      {
        title: "Form Setoran Kasir",
        to: "/transaksi/fsk",
        icon: "mdi-cash-multiple",
      },
      {
        title: "Setoran Pembayaran",
        to: "/transaksi/setoran-pembayaran",
        icon: "mdi-bank-transfer",
      },
    ],
  },
  {
    title: "Laporan",
    icon: "mdi-chart-box-outline",
    model: laporanMenu,
    isLarge: true, // Kita gunakan layout sectioned agar rapi
    sections: [
      {
        title: "Stok",
        icon: "mdi-archive-outline",
        items: [
          {
            title: "Laporan Stok",
            to: "/laporan/stok",
            icon: "mdi-package-variant",
          },
        ],
      },
      {
        title: "Penjualan",
        icon: "mdi-trending-up",
        items: [
          {
            title: "Laporan Penjualan",
            to: "/laporan/penjualan",
            icon: "mdi-receipt",
          },
        ],
      },
    ],
  },
  {
    title: "Tools",
    icon: "mdi-wrench-outline",
    model: toolsMenu,
    items: [
      {
        title: "Backup Data",
        to: "/tools/backup",
        icon: "mdi-database-export-outline",
      },
      {
        title: "Master User",
        to: "/tools/users",
        icon: "mdi-account-group-outline",
      },
    ],
  },
];

// Menu control methods
const closeMenus = () => {
  menuItems.forEach((menu) => {
    if (menu.model && menu.model.value) {
      menu.model.value = false;
    }
  });
};

// Event handlers
const handleLogout = () => {
  authStore.logout();
  router.push("/login");
};

const handleScroll = () => {
  scrolled.value = window.scrollY > 10;
};

// Lifecycle hooks
onMounted(() => {
  window.addEventListener("scroll", handleScroll);
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<template>
  <v-app-bar
    flat
    color="white"
    height="64"
    :elevation="appBarElevation"
    :class="appBarClass"
    fixed
    class="desktop-navbar"
  >
    <!-- Logo Section -->
    <RouterLink to="/" class="logo-section">
      <v-avatar size="32" class="logo-avatar">
        <v-img :src="logoSrc" alt="Logo" cover />
      </v-avatar>
      <div class="brand-info">
        <span class="brand-title">Franchise</span>
        <span class="brand-subtitle">Management System</span>
      </div>
    </RouterLink>

    <v-spacer />

    <!-- Main Navigation Menu -->
    <nav class="main-navigation">
      <template v-for="menu in menuItems" :key="menu.title">
        <!-- Standard Menu Items (non-Large) -->
        <v-menu
          v-if="
            !menu.isLarge && (!('to' in menu) || hasAccess(menu.to as string))
          "
          v-model="menu.model.value"
          offset-y
          :close-on-content-click="false"
          transition="fade-transition"
          class="nav-menu"
          location="bottom center"
          origin="top center"
        >
          <template #activator="{ props }">
            <v-btn
              variant="text"
              v-bind="props"
              :prepend-icon="menu.icon"
              class="nav-button"
              size="default"
            >
              {{ menu.title }}
            </v-btn>
          </template>

          <v-card class="nav-dropdown" elevation="8">
            <v-list class="nav-list" density="comfortable">
              <template
                v-for="(item, index) in (menu.items ?? []).filter(
                  (i) => !i.to || hasAccess(i.to),
                )"
                :key="index"
              >
                <v-divider v-if="item.divider" class="nav-divider" />

                <!-- Sub Menu Group -->
                <v-list-group
                  v-else-if="'subItems' in item"
                  :value="item.title"
                  class="nav-list-group"
                >
                  <template #activator="{ props }">
                    <v-list-item
                      v-bind="props"
                      :prepend-icon="item.icon"
                      class="nav-list-item"
                    >
                      <v-list-item-title>{{ item.title }}</v-list-item-title>
                    </v-list-item>
                  </template>

                  <template
                    v-for="subItem in (
                      (item.subItems as NavItem[] | undefined) ?? []
                    ).filter((si) => hasAccess(si.to))"
                    :key="subItem.title"
                  >
                    <!-- Regular Sub Item -->
                    <v-list-item
                      :to="subItem.to"
                      :prepend-icon="subItem.icon"
                      class="nav-list-item sub"
                      @click="closeMenus"
                    >
                      <v-list-item-title>{{ subItem.title }}</v-list-item-title>
                    </v-list-item>
                  </template>
                </v-list-group>

                <!-- Regular Menu Item -->
                <v-list-item
                  v-else
                  :to="item.to"
                  :prepend-icon="item.icon"
                  class="nav-list-item"
                  @click="
                    () => {
                      if (item.onClick) {
                        item.onClick();
                      }
                      closeMenus();
                    }
                  "
                >
                  <v-list-item-title>{{ item.title }}</v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-card>
        </v-menu>

        <!-- Large Menu Items with Sections -->
        <v-menu
          v-else-if="menu.isLarge"
          v-model="menu.model.value"
          offset-y
          :max-width="1000"
          transition="fade-transition"
          :close-on-content-click="false"
          class="nav-menu large"
        >
          <template #activator="{ props }">
            <v-btn
              variant="text"
              v-bind="props"
              :prepend-icon="menu.icon"
              class="nav-button"
              size="default"
            >
              {{ menu.title }}
            </v-btn>
          </template>

          <v-card class="large-nav-dropdown" elevation="8">
            <v-container fluid class="pa-4">
              <v-row>
                <v-col
                  v-for="section in menu.sections ?? []"
                  :key="section.title"
                  :cols="12 / ((menu.sections ?? []).length || 1)"
                  class="section-col"
                >
                  <div class="section-header">
                    <v-icon
                      :icon="section.icon"
                      size="18"
                      class="section-icon"
                    />
                    <h4 class="section-title">{{ section.title }}</h4>
                  </div>

                  <v-list density="compact" class="section-list">
                    <template
                      v-for="item in section.items.filter(
                        (i) => !i.to || hasAccess(i.to),
                      )"
                      :key="item.title"
                    >
                      <!-- Section Sub Items -->
                      <v-list-group
                        v-if="item.subItems"
                        :value="item.title"
                        class="section-list-group"
                      >
                        <template #activator="{ props }">
                          <v-list-item
                            v-bind="props"
                            :prepend-icon="item.icon"
                            :title="item.title"
                            class="section-list-item"
                          />
                        </template>
                        <template
                          v-for="subItem in item.subItems.filter((si) =>
                            hasAccess(si.to),
                          )"
                          :key="subItem.title"
                        >
                          <v-list-item
                            :to="subItem.to"
                            :prepend-icon="subItem.icon"
                            class="section-list-item sub"
                            @click="closeMenus"
                          >
                            <v-list-item-title>{{
                              subItem.title
                            }}</v-list-item-title>
                          </v-list-item>
                        </template>
                      </v-list-group>

                      <!-- Regular Section Item -->
                      <v-list-item
                        v-else
                        :to="item.to"
                        :prepend-icon="item.icon"
                        class="section-list-item"
                        @click="closeMenus"
                      >
                        <v-list-item-title>{{ item.title }}</v-list-item-title>
                      </v-list-item>
                    </template>
                  </v-list>
                </v-col>
              </v-row>
            </v-container>
          </v-card>
        </v-menu>
      </template>
    </nav>

    <v-spacer />

    <!-- User Menu -->
    <v-menu
      v-model="userMenu"
      offset-y
      transition="fade-transition"
      class="user-menu"
    >
      <template #activator="{ props }">
        <v-btn variant="text" v-bind="props" class="user-button">
          <v-avatar color="primary" size="28" class="user-avatar">
            <span class="user-initial">{{ authStore.userInitial }}</span>
          </v-avatar>
          <span class="user-name">{{ authStore.userName }}</span>
          <v-icon icon="mdi-chevron-down" size="16" class="user-chevron" />
        </v-btn>
      </template>

      <v-card class="user-dropdown" elevation="8">
        <v-list class="user-list">
          <v-list-item class="user-profile-item">
            <template #prepend>
              <v-avatar color="primary" size="32">
                <span class="user-profile-initial">{{
                  authStore.userInitial
                }}</span>
              </v-avatar>
            </template>
            <v-list-item-title class="user-profile-name">{{
              authStore.userName
            }}</v-list-item-title>
            <v-list-item-subtitle class="user-profile-branch">{{
              authStore.userCabang
            }}</v-list-item-subtitle>
          </v-list-item>

          <v-divider class="user-divider" />

          <!-- Hapus Tautkan WhatsApp, hanya sisakan Ganti Password -->
          <v-list-item
            @click="openPasswordDialog"
            prepend-icon="mdi-lock-outline"
            class="user-menu-item"
          >
            <v-list-item-title>Ganti Password</v-list-item-title>
          </v-list-item>

          <v-divider class="user-divider" />

          <v-list-item
            @click="handleLogout"
            prepend-icon="mdi-logout"
            class="user-menu-item logout"
          >
            <v-list-item-title>Logout</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>
  </v-app-bar>
</template>

<style scoped>
/* Main navbar styling */
.desktop-navbar {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(8px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.navbar-scrolled {
  background-color: rgba(255, 255, 255, 0.95) !important;
}

/* Logo section */
.logo-section {
  display: flex;
  align-items: center;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
}

.logo-section:hover {
  background-color: rgba(25, 118, 210, 0.04);
  text-decoration: none !important;
}

.logo-avatar {
  margin-right: 12px;
}

.brand-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1976d2;
  letter-spacing: -0.02em;
}

.brand-subtitle {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
}

/* Main navigation */
.main-navigation {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-button {
  height: 40px;
  padding: 0 16px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #374151;
  border-radius: 6px;
  text-transform: none;
  letter-spacing: 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-button:hover {
  background-color: rgba(25, 118, 210, 0.06);
  color: #1976d2;
}

.nav-button.v-btn--active {
  background-color: rgba(25, 118, 210, 0.1);
  color: #1976d2;
}

/* Dropdown styling */
.nav-dropdown,
.large-nav-dropdown {
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
  backdrop-filter: blur(8px);
}

.nav-list,
.section-list,
.user-list {
  padding: 8px;
}

.nav-list-item,
.section-list-item,
.user-menu-item {
  min-height: 36px;
  border-radius: 6px;
  margin: 2px 0;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.nav-list-item:hover,
.section-list-item:hover,
.user-menu-item:hover {
  background-color: rgba(25, 118, 210, 0.06);
}

.nav-list-item.sub {
  padding-left: 48px;
}

.nav-list-item.nested {
  padding-left: 32px;
}

.nav-list-item.deep-nested {
  padding-left: 64px;
}

.section-list-item.sub {
  padding-left: 48px;
}

.section-list-item.nested {
  padding-left: 32px;
}

.section-list-item.deep-nested {
  padding-left: 64px;
}

.nav-divider,
.user-divider {
  margin: 8px 0;
  opacity: 0.6;
}

/* Large dropdown sections */
.section-col {
  padding: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: linear-gradient(
    135deg,
    rgba(25, 118, 210, 0.06) 0%,
    rgba(25, 118, 210, 0.02) 100%
  );
  border-left: 3px solid #1976d2;
}

.section-icon {
  color: #1976d2;
  margin-right: 8px;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1976d2;
  margin: 0;
  letter-spacing: -0.01em;
}

/* User menu styling */
.user-button {
  height: 40px;
  padding: 0 12px;
  border-radius: 20px;
  text-transform: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.user-button:hover {
  background-color: rgba(25, 118, 210, 0.06);
}

.user-avatar {
  margin-right: 8px;
}

.user-initial,
.user-profile-initial {
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin: 0 4px;
}

.user-chevron {
  color: #6b7280;
  transition: transform 0.2s ease;
}

.user-button:hover .user-chevron {
  transform: rotate(180deg);
}

.user-dropdown {
  min-width: 200px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.user-profile-item {
  padding: 12px 16px;
  background-color: rgba(25, 118, 210, 0.02);
}

.user-profile-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: #1f2937;
}

.user-menu-item.logout {
  color: #dc2626;
}

.user-menu-item.logout:hover {
  background-color: rgba(220, 38, 38, 0.06);
  color: #dc2626;
}

/* List group styling */
.nav-list-group,
.section-list-group {
  border-radius: 6px;
}

.nav-list-group .v-list-group__items,
.section-list-group .v-list-group__items {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 0 0 6px 6px;
}

/* Animations and transitions */
.fade-transition-enter-active,
.fade-transition-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-transition-enter-from,
.fade-transition-leave-to {
  opacity: 0;
}

/* Focus and active states */
.nav-button:focus-visible,
.nav-list-item:focus-visible,
.section-list-item:focus-visible,
.user-menu-item:focus-visible {
  outline: 2px solid #1976d2;
  outline-offset: 2px;
}

.nav-list-item.v-list-item--active,
.section-list-item.v-list-item--active {
  background-color: rgba(25, 118, 210, 0.12);
  color: #1976d2;
}

.nav-list-item.v-list-item--active .v-icon,
.section-list-item.v-list-item--active .v-icon {
  color: #1976d2;
}

/* Typography consistency */
.v-list-item-title {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
}

/* Menu positioning adjustments */
.nav-menu .v-overlay__content {
  margin-top: 8px;
}

.user-menu .v-overlay__content {
  margin-top: 8px;
}

/* Styling khusus untuk menu Large */
.nav-menu.large .v-overlay__content {
  position: fixed !important;
  top: 64px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  width: 1100px;
  max-width: 90vw;
}

/* Untuk semua menu dropdown standard */
.nav-menu:not(.large) .v-overlay__content {
  margin-top: 8px;
}

.section-col {
  min-width: 400px;
  flex: 1;
}

/* Override untuk menu Transaksi */
.nav-menu.large .section-col {
  min-width: 450px;
  max-width: 500px;
}

.centered-menu {
  left: 50% !important;
  transform: translateX(-50%) !important;
}

/* Konsistensi font size untuk semua item */
.nav-list-item .v-list-item-title,
.section-list-item .v-list-item-title {
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  line-height: 1.4 !important;
}

/* Khusus untuk list group activator (yang memiliki sub item) */
.nav-list-group .v-list-group__activator .v-list-item-title,
.section-list-group .v-list-group__activator .v-list-item-title {
  font-size: 0.875rem !important;
  font-weight: 500 !important;
}

/* Override default Vuetify list group styling */
.v-list-group .v-list-group__activator .v-list-item-title {
  font-size: 0.875rem !important;
  font-weight: 500 !important;
}

/* Ensure consistent height for all items */
.nav-list-item,
.section-list-item,
.nav-list-group .v-list-group__activator,
.section-list-group .v-list-group__activator {
  min-height: 36px !important;
}

/* Responsive adjustments for desktop only */
@media (min-width: 1200px) {
  .large-nav-dropdown {
    max-width: none;
  }

  .section-col {
    min-width: 250px;
  }
}

/* Subtle shadows and elevation */
.nav-dropdown {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.large-nav-dropdown {
  box-shadow:
    0 8px 25px -5px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.user-dropdown {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Icon consistency */
.v-icon {
  font-size: 18px;
}

.nav-button .v-icon {
  font-size: 20px;
  margin-right: 8px;
}

/* Improved spacing */
.v-app-bar .v-toolbar__content {
  padding: 0 24px;
}

/* Clean borders and dividers */
.v-divider {
  border-color: rgba(0, 0, 0, 0.06);
}

/* Menu item states */
.nav-list-item:not(.v-list-item--active):hover,
.section-list-item:not(.v-list-item--active):hover {
  color: #1976d2;
}

.nav-list-item:not(.v-list-item--active):hover .v-icon,
.section-list-item:not(.v-list-item--active):hover .v-icon {
  color: #1976d2;
}
</style>
