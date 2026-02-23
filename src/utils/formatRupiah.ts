/**
 * Memformat angka ke dalam format mata uang Rupiah
 * Contoh: 150000 -> Rp 150.000
 */
export const formatRupiah = (
  value: number | string | null | undefined,
): string => {
  if (value === null || value === undefined || value === "") return "Rp 0";

  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) return "Rp 0";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);
};
