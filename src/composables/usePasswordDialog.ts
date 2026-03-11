import { ref } from "vue";

const isPasswordDialogOpen = ref(false);

export function usePasswordDialog() {
  const openPasswordDialog = () => {
    isPasswordDialogOpen.value = true;
  };

  const closePasswordDialog = () => {
    isPasswordDialogOpen.value = false;
  };

  return {
    isPasswordDialogOpen,
    openPasswordDialog,
    closePasswordDialog,
  };
}
