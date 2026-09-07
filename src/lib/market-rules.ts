/**
 * market-rules.ts
 * Aturan pasar BEI: Fraksi Harga (Tick Size) dan Auto Rejection (ARA/ARB).
 * Digunakan di server.ts (validasi backend) dan komponen frontend.
 */

// ============================================================
// FRAKSI HARGA (TICK SIZE)
// ============================================================

/**
 * Mengembalikan fraksi harga (step minimal) berdasarkan rentang harga.
 * Sumber: Tabel 3 BEI (Lampiran Pengumuman No. Peng-00067/BEI.POP/04-2026)
 */
export function getTickSize(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/**
 * Memvalidasi apakah harga merupakan kelipatan fraksi yang benar.
 * Jika basePrice diberikan, harga yang sama dengan basePrice atau
 * kelipatan fraksi dari basePrice dianggap valid.
 */
export function isValidTickSize(price: number, basePrice?: number): boolean {
  if (price <= 0) return false;
  // Harga pembukaan / acuan saham itu sendiri selalu sah
  if (basePrice !== undefined && basePrice > 0 && price === basePrice) {
    return true;
  }
  const tick = getTickSize(price);
  if (price % tick === 0) return true;
  // Jika harga merupakan kelipatan fraksi yang dihitung dari basePrice
  if (basePrice !== undefined && basePrice > 0) {
    const baseTick = getTickSize(basePrice);
    if (Math.abs(price - basePrice) % baseTick === 0) return true;
  }
  // Toleransi kelipatan Rp 5 untuk saham < Rp 5.000 (seperti 2.025, 2.225, 2.475, 2.725)
  if (price < 5000 && price % 5 === 0) return true;
  return false;
}

/**
 * Menghitung harga prediksi otomatis untuk quick percentage chips.
 * Jika persentase 0 ("Sama"), selalu mengembalikan basePrice secara eksak.
 */
export function calculateQuickPrice(basePrice: number, pct: number): number {
  if (pct === 0) return basePrice;
  const raw = basePrice * (1 + pct / 100);
  const tick = getTickSize(raw);
  return Math.round(raw / tick) * tick;
}

/**
 * Membulatkan harga ke kelipatan fraksi yang valid terdekat (ke bawah).
 * Berguna untuk tombol +/- agar selalu menghasilkan harga valid.
 */
export function snapToTickSize(price: number): number {
  if (price <= 0) return getTickSize(1);
  const tick = getTickSize(price);
  return Math.max(tick, Math.floor(price / tick) * tick);
}

/**
 * Menaikkan harga ke harga valid berikutnya sesuai fraksi.
 */
export function incrementPrice(price: number): number {
  const tick = getTickSize(price);
  return price + tick;
}

/**
 * Menurunkan harga ke harga valid sebelumnya sesuai fraksi.
 * Tidak akan turun di bawah nilai fraksi minimum (Rp 1).
 */
export function decrementPrice(price: number): number {
  const tick = getTickSize(price);
  return Math.max(tick, price - tick);
}

// ============================================================
// AUTO REJECTION (ARA / ARB)
// ============================================================

/**
 * Mengembalikan batas Auto Rejection Atas (ARA) dan Bawah (ARB)
 * berdasarkan harga acuan.
 * Sumber: Tabel 4 BEI (Lampiran Pengumuman No. Peng-00067/BEI.POP/04-2026)
 *
 * @param referencePrice - Harga acuan (basePrice untuk Pra-Pasar, openingPrice untuk Trading)
 * @returns { upper: ARA, lower: ARB } — sudah dibulatkan ke fraksi yang valid
 */
export function getAutoRejectionLimits(referencePrice: number): {
  upper: number;
  lower: number;
} {
  let pct: number;
  if (referencePrice <= 200) {
    pct = 0.35;
  } else if (referencePrice <= 5000) {
    pct = 0.25;
  } else {
    pct = 0.2;
  }

  const rawUpper = referencePrice * (1 + pct);
  const rawLower = referencePrice * (1 - pct);

  // Bulatkan ke fraksi valid: atas ke bawah (agar tidak melampaui batas), bawah ke atas
  const upper = snapToTickSize(rawUpper);
  const tickLower = getTickSize(Math.max(1, Math.floor(rawLower)));
  const lower = Math.ceil(rawLower / tickLower) * tickLower;

  return { upper, lower: Math.max(tickLower, lower) };
}
