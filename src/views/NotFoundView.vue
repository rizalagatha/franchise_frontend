<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center" class="text-center">
      <v-col cols="12">
        <v-icon size="100" color="info">mdi-compass-off-outline</v-icon>
        <h1 class="text-h3 mt-4">404 - Halaman Tidak Ditemukan</h1>
        <p class="text-h6 text-medium-emphasis mt-2">
          Halaman yang Anda cari tidak ada.
        </p>
        <v-btn color="primary" @click="$router.push('/')" class="mt-6">
          Kembali ke Beranda
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
