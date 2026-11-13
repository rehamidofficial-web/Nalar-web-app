/**
 * Mengubah array angka menjadi representasi string literal vector untuk PostgreSQL pgvector.
 * Contoh: [0.1, 0.2] => "[0.1,0.2]"
 * Memastikan semua elemen adalah angka valid (Number.isFinite).
 */
export function keTeksVektor(angka: number[]): string {
  if (!Array.isArray(angka) || angka.length === 0) {
    throw new Error("Larik vektor tidak boleh kosong atau tidak valid.");
  }

  for (let i = 0; i < angka.length; i += 1) {
    if (!Number.isFinite(angka[i])) {
      throw new Error(`Elemen vektor pada indeks ${i} bukan angka yang valid.`);
    }
  }

  return `[${angka.join(",")}]`;
}
