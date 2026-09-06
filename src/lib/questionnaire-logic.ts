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
  laCategory: CategoryType;
  eiRawScore: number;
  eiAvgScore: number;
  eiCategory: CategoryType;
  profileCode: string;
  profileLabel: string;
  profileGroup: ProfileGroup;
}

/**
 * Algoritma Tercile: Mengurutkan seluruh responden dan membagi populasi menjadi 3 kelompok sama rata:
 * - Sepertiga terbawah (Bottom 33.3%) = Rendah (R)
 * - Sepertiga tengah (Middle 33.3%) = Sedang (S)
 * - Sepertiga teratas (Top 33.3%) = Tinggi (T)
 *
 * Dijalankan secara independen untuk instrumen LA dan EI.
 */
export function computePopulationTerciles(
  respondents: RespondentScoreInput[]
): CategorizedProfileResult[] {
  if (respondents.length === 0) return [];

  // Jika jumlah responden sedikit (< 3), gunakan klasifikasi standard cutoff
  if (respondents.length < 3) {
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
        laCategory: laCat,
        eiRawScore: r.eiRawScore,
        eiAvgScore: Number((r.eiRawScore / eiItemCount).toFixed(2)),
        eiCategory: eiCat,
        profileCode: profile.code,
        profileLabel: profile.label,
        profileGroup: profile.group,
      };
    });
  }

  const n = respondents.length;
  const t1Index = Math.floor(n / 3);
  const t2Index = Math.floor((2 * n) / 3);

  // 1. Kategorisasi LA secara independen
  const sortedByLA = [...respondents].sort((a, b) => a.laRawScore - b.laRawScore);
  const laCategoryMap = new Map<number, CategoryType>();
  sortedByLA.forEach((r, idx) => {
    if (idx < t1Index) {
      laCategoryMap.set(r.userId, "R");
    } else if (idx < t2Index) {
      laCategoryMap.set(r.userId, "S");
    } else {
      laCategoryMap.set(r.userId, "T");
    }
  });

  // 2. Kategorisasi EI secara independen
  const sortedByEI = [...respondents].sort((a, b) => a.eiRawScore - b.eiRawScore);
  const eiCategoryMap = new Map<number, CategoryType>();
  sortedByEI.forEach((r, idx) => {
    if (idx < t1Index) {
      eiCategoryMap.set(r.userId, "R");
    } else if (idx < t2Index) {
      eiCategoryMap.set(r.userId, "S");
    } else {
      eiCategoryMap.set(r.userId, "T");
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
      laCategory: laCat,
      eiRawScore: r.eiRawScore,
      eiAvgScore: Number((r.eiRawScore / eiItemCount).toFixed(2)),
      eiCategory: eiCat,
      profileCode: profile.code,
      profileLabel: profile.label,
      profileGroup: profile.group,
    };
  });
}
