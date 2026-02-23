// src/plugins/vuetify.ts
// File ini HANYA berisi OPSI/KONFIGURASI, bukan createVuetify

import { aliases, mdi } from "vuetify/iconsets/mdi";

// Custom theme configuration
const customTheme = {
  dark: false,
  colors: {
    primary: "#1976D2",
    secondary: "#424242",
    accent: "#82B1FF",
    error: "#FF5252",
    info: "#2196F3",
    success: "#4CAF50",
    warning: "#FFC107",
    background: "#F8F9FA",
    surface: "#FFFFFF",
    "surface-variant": "#F5F5F5",
    "on-primary": "#FFFFFF",
    "on-secondary": "#FFFFFF",
    "on-surface": "#1A1A1A",
    "on-surface-variant": "#5F5F5F",
    "on-background": "#1A1A1A",
  },
};

// Ekspor OPSI-nya saja
export default {
  icons: {
    defaultSet: "mdi",
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: "light",
    themes: {
      light: customTheme,
    },
  },
  defaults: {
    // Global component defaults
    VBtn: {
      style: "text-transform: none; font-weight: 600; letter-spacing: 0.01em;",
      rounded: "lg",
    },
    VCard: {
      rounded: "lg",
      elevation: 2,
    },
    VTextField: {
      variant: "outlined",
      rounded: "lg",
      color: "primary",
    },
    VSelect: {
      variant: "outlined",
      rounded: "lg",
      color: "primary",
    },
    VTextarea: {
      variant: "outlined",
      rounded: "lg",
      color: "primary",
    },
    VDataTable: {
      class: "custom-data-table",
    },
    VChip: {
      rounded: "lg",
    },
    VAlert: {
      rounded: "lg",
    },
  },
  display: {
    mobileBreakpoint: "sm",
    thresholds: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
};
