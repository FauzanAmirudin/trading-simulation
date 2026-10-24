export type CategoryType = "T" | "S" | "R"; // Tinggi, Sedang, Rendah

export type ProfileGroup = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";

export interface ProfileDefinition {
  group: ProfileGroup;
  code: string;
  label: string;
  laCategory: CategoryType;
  eiCategory: CategoryType;
  name: string;
  description: string;
}

export const PROFILE_MATRIX: Record<ProfileGroup, ProfileDefinition> = {
  A: {
    group: "A",
    code: "LATEIT",
    label: "LA(T)+EI(T)",
    laCategory: "T",
    eiCategory: "T",
    name: "Kelompok A (Loss Aversion Tinggi, Emotional Intelligence Tinggi)",
    description: "Sangat sensitif terhadap risiko/kerugian, namun memiliki kontrol emosi dan kesadaran diri yang sangat baik.",
  },
  B: {
    group: "B",
    code: "LATEIS",
    label: "LA(T)+EI(S)",
    laCategory: "T",
    eiCategory: "S",
    name: "Kelompok B (Loss Aversion Tinggi, Emotional Intelligence Sedang)",
    description: "Cenderung menghindari kerugian dengan tingkat regulasi emosi yang cukup stabil.",
  },
  C: {
    group: "C",
    code: "LATEIR",
    label: "LA(T)+EI(R)",
    laCategory: "T",
    eiCategory: "R",
    name: "Kelompok C (Loss Aversion Tinggi, Emotional Intelligence Rendah)",
    description: "Sangat takut rugi dan rentan mengalami kecemasan atau impulsifitas saat menghadapi tekanan pasar.",
  },
  D: {
    group: "D",
    code: "LASEIT",
    label: "LA(S)+EI(T)",
    laCategory: "S",
    eiCategory: "T",
    name: "Kelompok D (Loss Aversion Sedang, Emotional Intelligence Tinggi)",
    description: "Sikap seimbang terhadap risiko dengan kecerdasan emosional dan ketenangan analisis yang tinggi.",
  },
  E: {
    group: "E",
    code: "LASEIS",
    label: "LA(S)+EI(S)",
    laCategory: "S",
    eiCategory: "S",
    name: "Kelompok E (Loss Aversion Sedang, Emotional Intelligence Sedang)",
    description: "Profil moderat pada kedua instrumen dengan reaksi risiko dan emosi yang wajar.",
  },
  F: {
    group: "F",
    code: "LASEIR",
    label: "LA(S)+EI(R)",
    laCategory: "S",
    eiCategory: "R",
    name: "Kelompok F (Loss Aversion Sedang, Emotional Intelligence Rendah)",
    description: "Sensitivitas risiko moderat namun perlu peningkatan kesadaran emosional dalam keputusan investasi.",
  },
  G: {
    group: "G",
    code: "LAREIT",
    label: "LA(R)+EI(T)",
    laCategory: "R",
    eiCategory: "T",
    name: "Kelompok G (Loss Aversion Rendah, Emotional Intelligence Tinggi)",
    description: "Berani mengambil risiko (risk-tolerant) dengan disiplin emosional yang terkelola dengan sangat matang.",
  },
  H: {
    group: "H",
    code: "LAREIS",
    label: "LA(R)+EI(S)",
    laCategory: "R",
    eiCategory: "S",
    name: "Kelompok H (Loss Aversion Rendah, Emotional Intelligence Sedang)",
    description: "Toleransi risiko cukup tinggi dengan kendali emosi yang memadai.",
  },
  I: {
    group: "I",
    code: "LAREIR",
    label: "LA(R)+EI(R)",
    laCategory: "R",
    eiCategory: "R",
    name: "Kelompok I (Loss Aversion Rendah, Emotional Intelligence Rendah)",
    description: "Sangat berani spekulasi namun berpotensi overconfidence atau impulsif tanpa kontrol emosi memadai.",
  },
};

/**
 * Mencari definisi profil berdasarkan kategori LA dan EI
 */
export function getProfileByCategories(
  laCategory: CategoryType,
  eiCategory: CategoryType
): ProfileDefinition {
  const match = Object.values(PROFILE_MATRIX).find(
    (p) => p.laCategory === laCategory && p.eiCategory === eiCategory
  );
  return match || PROFILE_MATRIX.E;
}

/**
 * Klasifikasi standar berdasarkan batas skor teoritis (Skala 1-5, 15 butir -> rentang 15 s.d 75)
 */
export function classifyByStandardCutoff(totalScore: number, itemCount: number = 15): CategoryType {
  const avg = itemCount > 0 ? totalScore / itemCount : 3;
  if (avg <= 2.66) return "R"; // Rendah
  if (avg <= 3.66) return "S"; // Sedang
  return "T"; // Tinggi
}

export interface RespondentScoreInput {
  userId: number;
  laRawScore: number;
  eiRawScore: number;
  laItemCount?: number;
  eiItemCount?: number;
}

export interface CategorizedProfileResult {
  userId: number;
  laRawScore: number;
  laAvgScore: number;
  laRank: number; // 1 = skor tertinggi (dari atas ke bawah)
  laCategory: CategoryType;
  eiRawScore: number;
  eiAvgScore: number;
  eiRank: number; // 1 = skor tertinggi (dari atas ke bawah)
  eiCategory: CategoryType;
  profileCode: string;
  profileLabel: string;
  profileGroup: ProfileGroup;
}

export interface InstrumentTercileCutoff {
  instrument: "LA" | "EI";
  totalRespondents: number;
  countTinggi: number;
  countSedang: number;
  countRendah: number;
  tinggiMinScore: number | null;
  tinggiMaxScore: number | null;
  sedangMinScore: number | null;
  sedangMaxScore: number | null;
  rendahMinScore: number | null;
  rendahMaxScore: number | null;
  tinggiMinAvg: number | null;
  tinggiMaxAvg: number | null;
  sedangMinAvg: number | null;
  sedangMaxAvg: number | null;
  rendahMinAvg: number | null;
  rendahMaxAvg: number | null;
}

/**
 * Algoritma Population Terciles (Seimbang Berdasarkan Jumlah User):
 * 1. Seluruh responden diurutkan berdasarkan nilai skor dari atas ke bawah (descending).
 * 2. Dibagi menjadi 3 kelompok seimbang:
 *    - Sepertiga teratas (Top 33.3%, peringkat 1 s.d N/3) = Tinggi (T)
 *    - Sepertiga tengah (Middle 33.3%)                   = Sedang (S)
 *    - Sepertiga terbawah (Bottom 33.3%)                 = Rendah (R)
 * 3. Dijalankan secara independen untuk instrumen Loss Aversion (LA) dan Emotional Intelligence (EI).
 *    Contoh: Jika N = 90 responden, maka otomatis terbagi 30 Tinggi, 30 Sedang, dan 30 Rendah.
 *    Jika N bukan kelipatan 3 (misal N = 91 atau 92), sisa dialokasikan proporsional ke kuantil teratas.
 */
export function computePopulationTerciles(
  respondents: RespondentScoreInput[]
): CategorizedProfileResult[] {
  if (respondents.length === 0) return [];

  const n = respondents.length;

  // Jika responden < 3, gunakan standard cutoff sebagai fallback
  if (n < 3) {
    // Tetap urutkan untuk peringkat
    const sortedLA = [...respondents].sort((a, b) => b.laRawScore - a.laRawScore || a.userId - b.userId);
    const sortedEI = [...respondents].sort((a, b) => b.eiRawScore - a.eiRawScore || a.userId - b.userId);
    const laRankMap = new Map<number, number>();
    const eiRankMap = new Map<number, number>();
    sortedLA.forEach((r, idx) => laRankMap.set(r.userId, idx + 1));
    sortedEI.forEach((r, idx) => eiRankMap.set(r.userId, idx + 1));

    return respondents.map((r) => {
      const laItemCount = r.laItemCount || 15;
      const eiItemCount = r.eiItemCount || 15;
      const laCat = classifyByStandardCutoff(r.laRawScore, laItemCount);
      const eiCat = classifyByStandardCutoff(r.eiRawScore, eiItemCount);
      const profile = getProfileByCategories(laCat, eiCat);

      return {
        userId: r.userId,
        laRawScore: r.laRawScore,
        laAvgScore: Number((r.laRawScore / laItemCount).toFixed(2)),
        laRank: laRankMap.get(r.userId) || 1,
        laCategory: laCat,
        eiRawScore: r.eiRawScore,
        eiAvgScore: Number((r.eiRawScore / eiItemCount).toFixed(2)),
        eiRank: eiRankMap.get(r.userId) || 1,
        eiCategory: eiCat,
        profileCode: profile.code,
        profileLabel: profile.label,
        profileGroup: profile.group,
      };
    });
  }

  // Hitung ukuran kelompok seimbang untuk N responden
  const remainder = n % 3;
  const baseSize = Math.floor(n / 3);
  const countT = baseSize + (remainder >= 1 ? 1 : 0);
  const countS = baseSize + (remainder === 2 ? 1 : 0);
  // Sisa kuota kelompok R (Rendah) adalah baseSize

  // 1. Kategorisasi LA secara independen (Diurutkan dari atas ke bawah / Nilai Tertinggi ke Terendah)
  const sortedByLA = [...respondents].sort((a, b) => {
    if (b.laRawScore !== a.laRawScore) return b.laRawScore - a.laRawScore;
    return a.userId - b.userId; // deterministic tie-breaker
  });
  const laCategoryMap = new Map<number, CategoryType>();
  const laRankMap = new Map<number, number>();

  sortedByLA.forEach((r, idx) => {
    laRankMap.set(r.userId, idx + 1);
    if (idx < countT) {
      laCategoryMap.set(r.userId, "T"); // Sepertiga teratas -> Tinggi
    } else if (idx < countT + countS) {
      laCategoryMap.set(r.userId, "S"); // Sepertiga tengah -> Sedang
    } else {
      laCategoryMap.set(r.userId, "R"); // Sepertiga terbawah -> Rendah
    }
  });

  // 2. Kategorisasi EI secara independen (Diurutkan dari atas ke bawah / Nilai Tertinggi ke Terendah)
  const sortedByEI = [...respondents].sort((a, b) => {
    if (b.eiRawScore !== a.eiRawScore) return b.eiRawScore - a.eiRawScore;
    return a.userId - b.userId; // deterministic tie-breaker
  });
  const eiCategoryMap = new Map<number, CategoryType>();
  const eiRankMap = new Map<number, number>();

  sortedByEI.forEach((r, idx) => {
    eiRankMap.set(r.userId, idx + 1);
    if (idx < countT) {
      eiCategoryMap.set(r.userId, "T"); // Sepertiga teratas -> Tinggi
    } else if (idx < countT + countS) {
      eiCategoryMap.set(r.userId, "S"); // Sepertiga tengah -> Sedang
    } else {
      eiCategoryMap.set(r.userId, "R"); // Sepertiga terbawah -> Rendah
    }
  });

  // 3. Gabungkan hasil menjadi profil 9 kelompok
  return respondents.map((r) => {
    const laItemCount = r.laItemCount || 15;
    const eiItemCount = r.eiItemCount || 15;
    const laCat = laCategoryMap.get(r.userId) || "S";
    const eiCat = eiCategoryMap.get(r.userId) || "S";
    const profile = getProfileByCategories(laCat, eiCat);

    return {
      userId: r.userId,
      laRawScore: r.laRawScore,
      laAvgScore: Number((r.laRawScore / laItemCount).toFixed(2)),
      laRank: laRankMap.get(r.userId) || 1,
      laCategory: laCat,
      eiRawScore: r.eiRawScore,
      eiAvgScore: Number((r.eiRawScore / eiItemCount).toFixed(2)),
      eiRank: eiRankMap.get(r.userId) || 1,
      eiCategory: eiCat,
      profileCode: profile.code,
      profileLabel: profile.label,
      profileGroup: profile.group,
    };
  });
}

/**
 * Menghitung batas skor empiris (min-max) tiap kategori Tercile untuk keperluan laporan & ekspor Excel.
 */
export function computeTercileCutoffs(
  results: CategorizedProfileResult[],
  instrument: "LA" | "EI"
): InstrumentTercileCutoff {
  const isLA = instrument === "LA";
  const total = results.length;

  const tinggi = results.filter((r) => (isLA ? r.laCategory : r.eiCategory) === "T");
  const sedang = results.filter((r) => (isLA ? r.laCategory : r.eiCategory) === "S");
  const rendah = results.filter((r) => (isLA ? r.laCategory : r.eiCategory) === "R");

  const getScores = (list: CategorizedProfileResult[]) =>
    list.map((r) => (isLA ? r.laRawScore : r.eiRawScore));
  const getAvgs = (list: CategorizedProfileResult[]) =>
    list.map((r) => (isLA ? r.laAvgScore : r.eiAvgScore));

  const tScores = getScores(tinggi);
  const sScores = getScores(sedang);
  const rScores = getScores(rendah);

  const tAvgs = getAvgs(tinggi);
  const sAvgs = getAvgs(sedang);
  const rAvgs = getAvgs(rendah);

  return {
    instrument,
    totalRespondents: total,
    countTinggi: tinggi.length,
    countSedang: sedang.length,
    countRendah: rendah.length,
    tinggiMinScore: tScores.length > 0 ? Math.min(...tScores) : null,
    tinggiMaxScore: tScores.length > 0 ? Math.max(...tScores) : null,
    sedangMinScore: sScores.length > 0 ? Math.min(...sScores) : null,
    sedangMaxScore: sScores.length > 0 ? Math.max(...sScores) : null,
    rendahMinScore: rScores.length > 0 ? Math.min(...rScores) : null,
    rendahMaxScore: rScores.length > 0 ? Math.max(...rScores) : null,
    tinggiMinAvg: tAvgs.length > 0 ? Math.min(...tAvgs) : null,
    tinggiMaxAvg: tAvgs.length > 0 ? Math.max(...tAvgs) : null,
    sedangMinAvg: sAvgs.length > 0 ? Math.min(...sAvgs) : null,
    sedangMaxAvg: sAvgs.length > 0 ? Math.max(...sAvgs) : null,
    rendahMinAvg: rAvgs.length > 0 ? Math.min(...rAvgs) : null,
    rendahMaxAvg: rAvgs.length > 0 ? Math.max(...rAvgs) : null,
  };
}

