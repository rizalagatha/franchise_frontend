import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/authStore";

// Impor semua komponen View/halaman Anda
// Sesuaikan path import
import LoginView from "@/views/LoginView.vue";
import HomeView from "@/views/HomeView.vue";
import UnauthorizedView from "@/views/UnauthorizedView.vue"; // Tambahan
import NotFoundView from "@/views/NotFoundView.vue"; // Tambahan
import CustomerView from "@/views/CustomerView.vue";
import PriceListView from "@/views/PriceListView.vue";
import BarcodeView from "@/views/BarcodeView.vue";
import BarcodeFormView from "@/views/BarcodeFormView.vue";
import RekeningView from "@/views/RekeningView.vue";
import PembelianView from "@/views/PembelianView.vue";
import PembelianFormView from "@/views/PembelianFormView.vue";
import KoreksiStokView from "@/views/KoreksiStokView.vue";
import KoreksiStokFormView from "@/views/KoreksiStokFormView.vue";
import StandartStokView from "@/views/StandartStokView.vue";
import KasirView from "@/views/KasirView.vue";
import KasirFormView from "@/views/KasirFormView.vue";
import KasirPrintView from "@/views/KasirPrintView.vue";
import FskView from "@/views/FskView.vue";
import FskFormView from "@/views/FskFormView.vue";
import SetoranPembayaranView from "@/views/SetoranPembayaranView.vue";
import SetoranPembayaranFormView from "@/views/SetoranPembayaranFormView.vue";
import LaporanStokView from "@/views/LaporanStokView.vue";
import LaporanPenjualanView from "@/views/LaporanPenjualanView.vue";
import UserBrowseView from "@/views/UserBrowseView.vue";
import UserFormView from "@/views/UserFormView.vue";
import MintaBarangKaosanView from "@/views/MintaBarangKaosanView.vue";
import MintaBarangKaosanFormView from "@/views/MintaBarangKaosanFormView.vue";
import PerusahaanView from "@/views/PerusahaanView.vue"; // Tambahan untuk Perusahaan

const routes = [
  {
    path: "/login",
    name: "Login",
    component: LoginView,
    meta: {
      title: "Login",
      layout: "AuthLayout", // Menggunakan AuthLayout
    },
  },
  {
    path: "/",
    name: "Home",
    component: HomeView,
    meta: {
      title: "Beranda",
      layout: "DefaultLayout", // Menggunakan DefaultLayout
      requiresAuth: true, // Kita set true untuk Home, beda dari retail
    },
  },
  {
    path: "/unauthorized",
    name: "Unauthorized",
    component: UnauthorizedView,
    meta: {
      title: "Tidak Diizinkan",
      layout: "DefaultLayout", // Tetap pakai layout default
      requiresAuth: true,
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: NotFoundView,
    meta: {
      title: "Tidak Ditemukan",
      layout: "DefaultLayout", // Tetap pakai layout default
    },
  },
  {
    path: "/daftar/customer", // Sesuai permintaan web_route
    name: "Customer",
    component: CustomerView,
    meta: {
      title: "Master Customer",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "11", // Menu ID 11
    },
  },
  {
    path: "/daftar/price-list", // Sesuai web_route
    name: "PriceList",
    component: PriceListView,
    meta: {
      title: "Price List Barang",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "12", // Menu ID 12
    },
  },
  {
    path: "/daftar/cetak-barcode", // Sesuai web_route
    name: "CetakBarcode",
    component: BarcodeView,
    meta: {
      title: "Cetak Barcode",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "13", // Menu ID 13
    },
  },
  {
    path: "/daftar/cetak-barcode/baru",
    name: "CetakBarcodeBaru", // Nama unik untuk form Baru
    component: BarcodeFormView,
    meta: {
      title: "Buat Cetak Barcode",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "13", // Menu ID sama
    },
  },
  {
    // Gunakan parameter :nomor
    path: "/daftar/cetak-barcode/ubah/:nomor",
    name: "CetakBarcodeUbah", // Nama unik untuk form Ubah
    component: BarcodeFormView,
    meta: {
      title: "Ubah Cetak Barcode",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "13", // Menu ID sama
    },
  },
  {
    path: "/daftar/rekening", // Sesuai web_route
    name: "RekeningBank",
    component: RekeningView,
    meta: {
      title: "Rekening Bank",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "14", // Menu ID 14
    },
  },
  {
    path: "/transaksi/pembelian", // Sesuai web_route
    name: "Pembelian",
    component: PembelianView,
    meta: {
      title: "Browse Pembelian",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "22", // Menu ID 22
    },
  },
  {
    path: "/transaksi/pembelian/baru",
    name: "PembelianBaru",
    component: PembelianFormView,
    meta: {
      title: "Buat Pembelian",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "22",
    },
  },
  {
    path: "/transaksi/pembelian/ubah/:nomor",
    name: "PembelianUbah",
    component: PembelianFormView,
    meta: {
      title: "Ubah Pembelian",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "22",
    },
  },
  {
    path: "/transaksi/koreksi-stok", // Sesuai web_route
    name: "KoreksiStok",
    component: KoreksiStokView,
    meta: {
      title: "Browse Koreksi Stok",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "23", // Menu ID 23
    },
  },
  {
    path: "/transaksi/koreksi-stok/baru",
    name: "KoreksiStokBaru",
    component: KoreksiStokFormView,
    meta: {
      title: "Buat Koreksi Stok",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "23",
      permission: "insert", // Izin insert
    },
  },
  {
    path: "/transaksi/koreksi-stok/ubah/:nomor",
    name: "KoreksiStokUbah",
    component: KoreksiStokFormView,
    meta: {
      title: "Ubah Koreksi Stok",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "23",
      permission: "edit", // Izin edit
    },
  },
  {
    path: "/transaksi/standar-stok",
    name: "StandartStok",
    component: StandartStokView,
    meta: {
      title: "Standar Stok",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "24",
    },
  },
  {
    path: "/transaksi/kasir",
    name: "Kasir",
    component: KasirView,
    meta: {
      title: "Browse Invoice Kasir",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "31", // Menu ID Kasir
    },
  },
  {
    path: "/transaksi/kasir/baru",
    name: "KasirBaru",
    component: KasirFormView,
    meta: {
      title: "Input Invoice Baru",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "31",
      permission: "insert", // Izin untuk menambah data
    },
  },
  {
    path: "/transaksi/kasir/ubah/:nomor",
    name: "KasirUbah",
    component: KasirFormView,
    meta: {
      title: "Ubah Invoice Kasir",
      layout: "DefaultLayout",
      requiresAuth: true,
      menuId: "31",
      permission: "edit", // Izin untuk mengubah data
    },
  },
  {
    path: "/transaksi/kasir/print/:nomor",
    name: "InvoicePrint", // Nama ini harus sama dengan yang dipanggil di router.resolve
    component: KasirPrintView,
    meta: {
      requiresAuth: true,
      layout: "PrintLayout",
    },
  },
  {
    path: "/transaksi/fsk",
    name: "FskBrowse",
    component: FskView,
    meta: {
      requiresAuth: true,
      menuId: "32",
      title: "Browse Form Setoran Kasir",
    },
  },
  {
    path: "/transaksi/fsk/baru",
    name: "FskCreate",
    component: FskFormView,
    meta: {
      requiresAuth: true,
      menuId: "32",
      title: "Buat Form Setoran Kasir",
    },
  },
  {
    path: "/transaksi/fsk/ubah/:nomor",
    name: "FskEdit",
    component: FskFormView,
    meta: {
      requiresAuth: true,
      menuId: "32",
      title: "Ubah Form Setoran Kasir",
    },
  },
  {
    path: "/transaksi/setoran-pembayaran",
    name: "SetoranPembayaranBrowse",
    component: SetoranPembayaranView,
    meta: { requiresAuth: true, menuId: "33", title: "Setoran Pembayaran" },
  },
  {
    path: "/transaksi/setoran-pembayaran/baru",
    name: "SetoranPembayaranCreate",
    component: SetoranPembayaranFormView,
    meta: {
      requiresAuth: true,
      menuId: "33",
      title: "Buat Setoran Pembayaran",
    },
  },
  {
    path: "/transaksi/setoran-pembayaran/ubah/:nomor",
    name: "SetoranPembayaranEdit",
    component: SetoranPembayaranFormView,
    meta: {
      requiresAuth: true,
      menuId: "33",
      title: "Ubah Setoran Pembayaran",
    },
  },
  {
    path: "/laporan/stok",
    name: "LaporanStok",
    component: LaporanStokView,
    meta: {
      requiresAuth: true,
      menuId: "51", // Sesuai dengan hak akses di database
      title: "Laporan Stok",
    },
  },
  {
    path: "/laporan/penjualan",
    name: "LaporanPenjualan",
    component: LaporanPenjualanView,
    meta: {
      requiresAuth: true,
      menuId: "52",
      title: "Laporan Penjualan",
    },
  },
  {
    path: "/tools/users",
    name: "Browse User",
    component: UserBrowseView,
    meta: { requiresAuth: true, menuId: "1" },
  },
  {
    path: "/tools/users/baru",
    name: "Buat User Baru",
    component: UserFormView,
    meta: { requiresAuth: true, menuId: "1" },
  },
  // Rute Edit
  {
    path: "/tools/users/ubah/:kode",
    name: "Edit User",
    component: UserFormView,
    meta: { requiresAuth: true, menuId: "1" },
  },
  {
    path: "/transaksi/minta-barang-kaosan",
    name: "MintaBarangKaosanBrowse",
    component: MintaBarangKaosanView,
    meta: { requiresAuth: true, menuId: "25", title: "Minta Barang Pusat" },
  },
  {
    path: "/transaksi/minta-barang-kaosan/baru",
    name: "MintaBarangKaosanCreate",
    component: MintaBarangKaosanFormView,
    meta: {
      requiresAuth: true,
      menuId: "25",
      title: "Buat Permintaan Barang",
    },
  },
  {
    path: "/transaksi/minta-barang-kaosan/ubah/:nomor",
    name: "MintaBarangKaosanEdit",
    component: MintaBarangKaosanFormView,
    meta: {
      requiresAuth: true,
      menuId: "25",
      title: "Ubah Permintaan Barang",
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Navigation Guard (Satpam Router)
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  // (Penting: Panggil useAuthStore HANYA di dalam guard,
  // jangan di atas, untuk menghindari masalah inisialisasi pinia)

  const loggedIn = authStore.isAuthenticated;
  const allowedMenus = authStore.allowedMenus || [];

  // 1. Cek jika token expired (mengambil dari logic retail)
  if (loggedIn && authStore.isTokenExpired) {
    authStore.handleSessionExpired(); // Gunakan handleSessionExpired
    return;
  }

  // 2. Update judul halaman (disesuaikan untuk Franchise)
  const title = to.meta?.title || to.name || "Franchise";
  document.title = `${String(title)} - Franchise App`;

  // 3. Route yang tidak memerlukan auth (public)
  if (!to.meta?.requiresAuth) {
    return next();
  }

  // 4. Belum login, tapi mengakses halaman protected
  if (!loggedIn && to.meta?.requiresAuth) {
    return next({ name: "Login" });
  }

  // 5. Sudah login, tapi akses login page
  if (to.name === "Login" && loggedIn) {
    return next({ name: "Home" });
  }

  // 6. Cek akses untuk route yang memerlukan permission
  if (to.meta?.menuId) {
    // pastikan menuId adalah string
    const hasPermission = allowedMenus.includes(String(to.meta.menuId));
    if (!hasPermission) {
      // Jika tidak punya izin, lempar ke halaman Unauthorized
      return next({ name: "Unauthorized" });
    }
  }

  // 7. Jika lolos semua, lanjutkan navigasi
  next();
});

export default router;
