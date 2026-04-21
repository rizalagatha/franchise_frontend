export const formatRupiah = (
  value: number | string | null | undefined,
): string => {
  if (value === null || value === undefined) return "Rp 0";

  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numericValue)) return "Rp 0";

  // Math.round() akan membulatkan 47979.96 menjadi 47980
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0, // Paksa hilangkan angka di belakang koma
  }).format(Math.round(numericValue));
};
