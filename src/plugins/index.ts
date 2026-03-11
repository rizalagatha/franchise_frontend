/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

import { createVuetify, type VuetifyOptions } from "vuetify";
import vuetifyOptions from "./vuetify";
import type { App } from "vue";

export function registerPlugins(app: App) {
  const vuetify = createVuetify(vuetifyOptions as VuetifyOptions);

  app.use(vuetify);
}
