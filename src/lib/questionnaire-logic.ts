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
 * Helper untuk menghitung ukuran 3 kuantil (Tinggi, Sedang, Rendah)
 * secara seimbang dan proporsional untuk sejumlah N responden.
 */
export function getTercileSplit(total: number): { countT: number; countS: number; countR: number } {
  if (total <= 0) return { countT: 0, countS: 0, countR: 0 };
  const remainder = total % 3;
  const baseSize = Math.floor(total / 3);
  const countT = baseSize + (remainder >= 1 ? 1 : 0);
  const countS = baseSize + (remainder === 2 ? 1 : 0);
  const countR = baseSize;
  return { countT, countS, countR };
}

/**
 * Algoritma Balanced Hierarchical Terciles (Seimbang & Terbagi Rata):
 * 1. Peringkat Global:
 *    - Seluruh responden dihitung peringkat skornya secara menyeluruh (Global Rank 1..N)
 *      untuk instrumen Loss Aversion (LA) dan Emotional Intelligence (EI).
 * 2. Strata Utama (Loss Aversion):
 *    - Populasi diurutkan berdasarkan skor LA (descending), lalu dibagi menjadi 3 kuantil seimbang:
 *      * Sepertiga teratas  (Top 33.3%)    = LA Tinggi (T)
 *      * Sepertiga tengah   (Middle 33.3%) = LA Sedang (S)
 *      * Sepertiga terbawah (Bottom 33.3%) = LA Rendah (R)
 * 3. Stratifikasi Kondisional (Emotional Intelligence):
 *    - Di dalam masing-masing strata LA tersebut, skor EI diurutkan kembali dan dibagi 3 kuantil sama rata:
 *      * Strata LA(T): dibagi rata menjadi Kelompok A (T+T), Kelompok B (T+S), Kelompok C (T+R).
 *      * Strata LA(S): dibagi rata menjadi Kelompok D (S+T), Kelompok E (S+S), Kelompok F (S+R).
 *      * Strata LA(R): dibagi rata menjadi Kelompok G (R+T), Kelompok H (R+S), Kelompok I (R+R).
 * 4. Hasil:
 *    - Seluruh 9 kelompok (Kelompok A s.d I) TERBAGI RATA SECARA SEMPURNA (misal 10 responden per kelompok untuk N=90).
 *    - Margin LA dan EI (Tinggi, Sedang, Rendah) juga tepat seimbang (masing-masing 33.3%).
 *    - Data mentah (jawaban asli responden, skor total, skor rata-rata) 100% aman dan tidak tersentuh.
 */
export function computePopulationTerciles(
  respondents: RespondentScoreInput[]
): CategorizedProfileResult[] {
  if (respondents.length === 0) return [];

  const n = respondents.length;

  // Jika responden < 3, gunakan standard cutoff sebagai fallback
  if (n < 3) {
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

  // 1. Peringkat Global Populasi (1 = nilai skor tertinggi, diurutkan dari atas ke bawah)
  const sortedGlobalLA = [...respondents].sort((a, b) => {
    if (b.laRawScore !== a.laRawScore) return b.laRawScore - a.laRawScore;
    return a.userId - b.userId; // deterministic tie-breaker
  });
  const laRankMap = new Map<number, number>();
  sortedGlobalLA.forEach((r, idx) => laRankMap.set(r.userId, idx + 1));

  const sortedGlobalEI = [...respondents].sort((a, b) => {
    if (b.eiRawScore !== a.eiRawScore) return b.eiRawScore - a.eiRawScore;
    return a.userId - b.userId; // deterministic tie-breaker
  });
  const eiRankMap = new Map<number, number>();
  sortedGlobalEI.forEach((r, idx) => eiRankMap.set(r.userId, idx + 1));

  // 2. Bagi populasi menjadi 3 strata Loss Aversion secara seimbang (Tinggi, Sedang, Rendah)
  const { countT: laCountT, countS: laCountS } = getTercileSplit(n);
  const laStratumT: RespondentScoreInput[] = [];
  const laStratumS: RespondentScoreInput[] = [];
  const laStratumR: RespondentScoreInput[] = [];

  sortedGlobalLA.forEach((r, idx) => {
    if (idx < laCountT) {
      laStratumT.push(r);
    } else if (idx < laCountT + laCountS) {
      laStratumS.push(r);
    } else {
      laStratumR.push(r);
    }
  });

  // 3. Hierarchical / Conditional Stratification untuk EI di setiap strata LA:
  //    Membagi setiap strata LA menjadi 3 kuantil EI secara seimbang sehingga
  //    seluruh 9 kelompok (A s.d I) terbagi rata tanpa merusak data mentah.
  const laCategoryMap = new Map<number, CategoryType>();
  const eiCategoryMap = new Map<number, CategoryType>();

  const assignConditionalEI = (
    stratum: RespondentScoreInput[],
    laCat: CategoryType
  ) => {
    // Urutkan anggota strata berdasarkan skor EI tertinggi ke terendah
    const sortedStratumEI = [...stratum].sort((a, b) => {
      if (b.eiRawScore !== a.eiRawScore) return b.eiRawScore - a.eiRawScore;
      return a.userId - b.userId;
    });

    const { countT, countS } = getTercileSplit(sortedStratumEI.length);

    sortedStratumEI.forEach((r, idx) => {
      laCategoryMap.set(r.userId, laCat);
      if (idx < countT) {
        eiCategoryMap.set(r.userId, "T"); // Sub-kuantil atas
      } else if (idx < countT + countS) {
        eiCategoryMap.set(r.userId, "S"); // Sub-kuantil tengah
      } else {
        eiCategoryMap.set(r.userId, "R"); // Sub-kuantil bawah
      }
    });
  };

  assignConditionalEI(laStratumT, "T"); // Menghasilkan Kelompok A (T+T), B (T+S), C (T+R)
  assignConditionalEI(laStratumS, "S"); // Menghasilkan Kelompok D (S+T), E (S+S), F (S+R)
  assignConditionalEI(laStratumR, "R"); // Menghasilkan Kelompok G (R+T), H (R+S), I (R+R)

  // 4. Gabungkan hasil menjadi profil 9 kelompok seimbang
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

