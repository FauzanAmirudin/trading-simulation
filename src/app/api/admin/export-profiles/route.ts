import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, respondentProfiles, questions, questionnaireResponses } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { PROFILE_MATRIX, ProfileGroup, computeTercileCutoffs, CategoryType } from "@/lib/questionnaire-logic";
import { requireAdmin } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

type PieSlice = {
  label: string;
  count: number;
  percentage: number;
  color: string;
};

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateCircularPieSvg({
  tag,
  title,
  badgeText,
  slices,
  total,
  isNineGroup = false,
}: {
  tag: string;
  title: string;
  badgeText: string;
  slices: PieSlice[];
  total: number;
  isNineGroup?: boolean;
}): string {
  const width = 460;
  const height = isNineGroup ? 240 : 215;
  const cx = isNineGroup ? 98 : 105;
  const cy = isNineGroup ? 134 : 118;
  const radius = isNineGroup ? 68 : 72;
  const innerRadius = isNineGroup ? 22 : 24;

  const activeSlices = slices.filter((s) => s.count > 0);
  const totalCount = total > 0 ? total : activeSlices.reduce((a, b) => a + b.count, 0);

  let currentAngle = -90;

  const slicePaths =
    totalCount > 0 && activeSlices.length > 0
      ? activeSlices.map((s) => {
          const angle = (s.count / totalCount) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle = endAngle;

          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;
          const midAngle = startAngle + angle / 2;
          const midRad = (midAngle * Math.PI) / 180;

          const isFullCircle = angle >= 359.9;
          const largeArcFlag = angle > 180 ? 1 : 0;

          const x1 = cx + radius * Math.cos(startRad);
          const y1 = cy + radius * Math.sin(startRad);
          const x2 = cx + radius * Math.cos(endRad);
          const y2 = cy + radius * Math.sin(endRad);

          const pathData = isFullCircle
            ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${s.color}" stroke="#ffffff" stroke-width="2" />`
            : `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${s.color}" stroke="#ffffff" stroke-width="2" />`;

          const labelRadius = radius * 0.65;
          const lx = cx + labelRadius * Math.cos(midRad);
          const ly = cy + labelRadius * Math.sin(midRad);

          const showText = s.percentage >= 8;
          const textSvg = showText
            ? `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="Arial, sans-serif" font-weight="bold" font-size="${isNineGroup ? "9.5" : "10.5"}">${s.percentage}%</text>`
            : "";

          return pathData + textSvg;
        })
      : [
          `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5" />`,
        ];

  let legendSvg = "";
  if (!isNineGroup) {
    const legendX = 220;
    const legendStartY = 68;
    const legendSpacing = 36;

    legendSvg = slices
      .map((s, idx) => {
        const y = legendStartY + idx * legendSpacing;
        const pct = totalCount > 0 ? ((s.count / totalCount) * 100).toFixed(1) : "0.0";
        return `
          <g>
            <circle cx="${legendX}" cy="${y}" r="5.5" fill="${s.color}" />
            <text x="${legendX + 14}" y="${y + 4.5}" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="#1e293b">${escapeXml(s.label)}</text>
            <text x="${width - 20}" y="${y + 4.5}" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" text-anchor="end" fill="#475569">${s.count} (${pct}%)</text>
          </g>
        `;
      })
      .join("\n");
  } else {
    // 2-column legend for 9 groups (Col 1: 5 items, Col 2: 4 items)
    const col1X = 188;
    const col2X = 325;
    const startY = 62;
    const spacing = 32;

    legendSvg = slices
      .map((s, idx) => {
        const isCol2 = idx >= 5;
        const rowInCol = isCol2 ? idx - 5 : idx;
        const x = isCol2 ? col2X : col1X;
        const y = startY + rowInCol * spacing;
        const endX = isCol2 ? width - 15 : col2X - 10;
        const pct = totalCount > 0 ? ((s.count / totalCount) * 100).toFixed(1) : "0.0";

        return `
          <g>
            <circle cx="${x}" cy="${y}" r="4.5" fill="${s.color}" />
            <text x="${x + 10}" y="${y + 3.5}" font-family="Arial, sans-serif" font-size="9.5" font-weight="600" fill="#1e293b">${escapeXml(s.label)}</text>
            <text x="${endX}" y="${y + 3.5}" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="end" fill="#64748b">${s.count} (${pct}%)</text>
          </g>
        `;
      })
      .join("\n");
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background Card -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
      
      <!-- Card Header -->
      <g transform="translate(14, 12)">
        <rect x="0" y="0" width="34" height="22" rx="5" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1" />
        <text x="17" y="15.5" font-family="Arial, monospace, sans-serif" font-size="10" font-weight="bold" fill="#166534" text-anchor="middle">${escapeXml(tag)}</text>
        <text x="42" y="13" font-family="Arial, sans-serif" font-size="11.5" font-weight="bold" fill="#0f172a">${escapeXml(title)}</text>
        <text x="42" y="25" font-family="Arial, sans-serif" font-size="9" fill="#64748b">${escapeXml(badgeText)}</text>
      </g>
      <line x1="14" y1="44" x2="${width - 14}" y2="44" stroke="#f1f5f9" stroke-width="1.5" />

      <!-- Pie Chart Slices -->
      <g id="pie-slices">
        ${slicePaths.join("\n")}
      </g>

      <!-- Center Hole (Donut Ring Aesthetic) -->
      <circle cx="${cx}" cy="${cy}" r="${innerRadius}" fill="#ffffff" stroke="#f8fafc" stroke-width="1" />
      <text x="${cx}" y="${cy + 3.5}" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#475569">${totalCount}</text>

      <!-- Legend Items -->
      <g id="legend">
        ${legendSvg}
      </g>
    </svg>
  `;
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const targetUserIdParam = searchParams.get("userId");
    const targetUserId = targetUserIdParam ? parseInt(targetUserIdParam, 10) : null;

    // 1. Fetch all respondents
    const allRespondents = await db
      .select({
        id: users.id,
        nama: users.nama,
        role: users.role,
      })
      .from(users)
      .where(eq(users.role, "responden"))
      .orderBy(asc(users.id));

    if (allRespondents.length === 0) {
      return NextResponse.json({ error: "Tidak ada data responden." }, { status: 404 });
    }

    // 2. Fetch profiles
    const allProfiles = await db.select().from(respondentProfiles);
    const profileMap = new Map(allProfiles.map((p) => [p.userId, p]));

    // 3. Fetch questions
    const allQuestions = await db
      .select()
      .from(questions)
      .orderBy(asc(questions.instrument), asc(questions.orderNumber));

    const laQuestions = allQuestions.filter((q) => q.instrument === "LA");
    const eiQuestions = allQuestions.filter((q) => q.instrument === "EI");

    // 4. Fetch all raw responses
    const allResponses = await db.select().from(questionnaireResponses);
    const responseMatrix = new Map<string, number>(); // "userId_questionId" -> score
    allResponses.forEach((r) => {
      responseMatrix.set(`${r.userId}_${r.questionId}`, r.score);
    });

    // 5. Compute Ranks (1 = skor tertinggi, diurutkan dari atas ke bawah)
    const completedProfiles = allProfiles.filter((p) => p.isCompleted);
    const totalCompleted = completedProfiles.length;

    if (totalCompleted === 0) {
      return NextResponse.json(
        { error: "Belum ada responden yang mengisi dan menyelesaikan kuesioner untuk diekspor." },
        { status: 404 }
      );
    }

    const sortedByLA = [...completedProfiles].sort((a, b) => {
      if (b.laRawScore !== a.laRawScore) return b.laRawScore - a.laRawScore;
      return a.userId - b.userId;
    });
    const laRankMap = new Map<number, number>();
    sortedByLA.forEach((p, idx) => laRankMap.set(p.userId, idx + 1));

    const sortedByEI = [...completedProfiles].sort((a, b) => {
      if (b.eiRawScore !== a.eiRawScore) return b.eiRawScore - a.eiRawScore;
      return a.userId - b.userId;
    });
    const eiRankMap = new Map<number, number>();
    sortedByEI.forEach((p, idx) => eiRankMap.set(p.userId, idx + 1));

    // 6. Urutkan responden tetap berurutan (natural order)
    const completedRespondents = allRespondents.filter((u) => profileMap.get(u.id)?.isCompleted);

    if (completedRespondents.length === 0) {
      return NextResponse.json(
        { error: "Belum ada responden yang mengisi dan menyelesaikan kuesioner untuk diekspor." },
        { status: 404 }
      );
    }

    let sortedRespondents = [...completedRespondents].sort((a, b) => {
      const numA = parseInt(a.nama.replace(/\D/g, ""), 10);
      const numB = parseInt(b.nama.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.id - b.id;
    });

    if (targetUserId) {
      sortedRespondents = sortedRespondents.filter((u) => u.id === targetUserId);
      if (sortedRespondents.length === 0) {
        return NextResponse.json(
          { error: "Responden tersebut belum menyelesaikan pengisian kuesioner atau tidak ditemukan." },
          { status: 404 }
        );
      }
    }

    const firstDataRow = 2;
    const lastDataRow = 1 + sortedRespondents.length;

    // Calculate Cutoffs for LA and EI across population
    const categorizedForCutoffs = completedProfiles.map((p) => ({
      userId: p.userId,
      laRawScore: p.laRawScore,
      laAvgScore: Number(p.laAvgScore),
      laRank: laRankMap.get(p.userId) || 1,
      laCategory: p.laCategory as CategoryType,
      eiRawScore: p.eiRawScore,
      eiAvgScore: Number(p.eiAvgScore),
      eiRank: eiRankMap.get(p.userId) || 1,
      eiCategory: p.eiCategory as CategoryType,
      profileCode: p.profileCode,
      profileLabel: p.profileLabel,
      profileGroup: p.profileGroup as ProfileGroup,
    }));

    const laCutoff = computeTercileCutoffs(categorizedForCutoffs, "LA");
    const eiCutoff = computeTercileCutoffs(categorizedForCutoffs, "EI");

    // Group Counts
    const groupCounts: Record<ProfileGroup, number> = {
      A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0
    };
    sortedRespondents.forEach((u) => {
      const p = profileMap.get(u.id);
      if (p?.profileGroup && groupCounts[p.profileGroup as ProfileGroup] !== undefined) {
        groupCounts[p.profileGroup as ProfileGroup]++;
      }
    });

    // Population Averages
    const avgLaRaw = totalCompleted > 0
      ? completedProfiles.reduce((s, p) => s + (p.laRawScore || 0), 0) / totalCompleted
      : 0;
    const avgLaScale = totalCompleted > 0
      ? completedProfiles.reduce((s, p) => s + (Number(p.laAvgScore) || 0), 0) / totalCompleted
      : 0;
    const avgEiRaw = totalCompleted > 0
      ? completedProfiles.reduce((s, p) => s + (p.eiRawScore || 0), 0) / totalCompleted
      : 0;
    const avgEiScale = totalCompleted > 0
      ? completedProfiles.reduce((s, p) => s + (Number(p.eiAvgScore) || 0), 0) / totalCompleted
      : 0;

    const pctTinggiLA = totalCompleted > 0 ? laCutoff.countTinggi / totalCompleted : 0;
    const pctSedangLA = totalCompleted > 0 ? laCutoff.countSedang / totalCompleted : 0;
    const pctRendahLA = totalCompleted > 0 ? laCutoff.countRendah / totalCompleted : 0;

    const pctTinggiEI = totalCompleted > 0 ? eiCutoff.countTinggi / totalCompleted : 0;
    const pctSedangEI = totalCompleted > 0 ? eiCutoff.countSedang / totalCompleted : 0;
    const pctRendahEI = totalCompleted > 0 ? eiCutoff.countRendah / totalCompleted : 0;

    // Dominant group
    const sortedGroups = (Object.keys(groupCounts) as ProfileGroup[]).sort(
      (a, b) => groupCounts[b] - groupCounts[a]
    );
    const dominantGroup = sortedGroups[0];
    const dominantCount = groupCounts[dominantGroup] || 0;
    const dominantPct = totalCompleted > 0 ? ((dominantCount / totalCompleted) * 100).toFixed(1) : "0.0";
    const dominantText = dominantCount > 0 ? `Kel. ${dominantGroup} (${dominantCount} User / ${dominantPct}%)` : "Belum Terbentuk";

    // Prepare slices for the 3 charts
    const slicesLA: PieSlice[] = [
      {
        label: "Tinggi (T)",
        count: laCutoff.countTinggi,
        percentage: Number((pctTinggiLA * 100).toFixed(1)),
        color: "#DC2626",
      },
      {
        label: "Sedang (S)",
        count: laCutoff.countSedang,
        percentage: Number((pctSedangLA * 100).toFixed(1)),
        color: "#F59E0B",
      },
      {
        label: "Rendah (R)",
        count: laCutoff.countRendah,
        percentage: Number((pctRendahLA * 100).toFixed(1)),
        color: "#10B981",
      },
    ];

    const slicesEI: PieSlice[] = [
      {
        label: "Tinggi (T)",
        count: eiCutoff.countTinggi,
        percentage: Number((pctTinggiEI * 100).toFixed(1)),
        color: "#10B981",
      },
      {
        label: "Sedang (S)",
        count: eiCutoff.countSedang,
        percentage: Number((pctSedangEI * 100).toFixed(1)),
        color: "#3B82F6",
      },
      {
        label: "Rendah (R)",
        count: eiCutoff.countRendah,
        percentage: Number((pctRendahEI * 100).toFixed(1)),
        color: "#DC2626",
      },
    ];

    const groupColors: Record<ProfileGroup, string> = {
      A: "#4338CA",
      B: "#2563EB",
      C: "#06B6D4",
      D: "#059669",
      E: "#D97706",
      F: "#EA580C",
      G: "#DB2777",
      H: "#7C3AED",
      I: "#475569",
    };

    const slicesGroup: PieSlice[] = (["A", "B", "C", "D", "E", "F", "G", "H", "I"] as ProfileGroup[]).map((grp) => {
      const count = groupCounts[grp] || 0;
      const def = PROFILE_MATRIX[grp];
      return {
        label: `Kel. ${grp} (${def.laCategory}/${def.eiCategory})`,
        count,
        percentage: totalCompleted > 0 ? Number(((count / totalCompleted) * 100).toFixed(1)) : 0,
        color: groupColors[grp],
      };
    });

    // Generate PNG buffers for the 3 charts in parallel
    const [pngChartLA, pngChartEI, pngChartGroup] = await Promise.all([
      sharp(
        Buffer.from(
          generateCircularPieSvg({
            tag: "LA",
            title: "Distribusi Kategori Loss Aversion (LA)",
            badgeText: "3 Kelompok Tercile Populasi",
            slices: slicesLA,
            total: totalCompleted,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            tag: "EI",
            title: "Distribusi Kategori Emotional Intelligence (EI)",
            badgeText: "3 Kelompok Tercile Populasi",
            slices: slicesEI,
            total: totalCompleted,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            tag: "GRP",
            title: "Distribusi 9 Kelompok Profil Psikologis",
            badgeText: "Matriks Perilaku 3x3 (A s/d I)",
            slices: slicesGroup,
            total: totalCompleted,
            isNineGroup: true,
          })
        )
      )
        .png()
        .toBuffer(),
    ]);

    // 7. Create Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Simulasi Investasi Platform";
    workbook.created = new Date();

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };

    // ─────────────────────────────────────────────────────────────
    // ── SHEET 1: Ringkasan & Ambang Batas Tercile ──
    // ─────────────────────────────────────────────────────────────
    const sheetSummary = workbook.addWorksheet("Ringkasan & Metodologi", {
      views: [{ showGridLines: true }],
    });

    sheetSummary.columns = [
      { width: 4 },  // A Margin
      { width: 18 }, // B Kategori / Label
      { width: 10 }, // C Kode
      { width: 14 }, // D Jumlah Responden
      { width: 13 }, // E Persentase
      { width: 22 }, // F Rentang Peringkat
      { width: 18 }, // G Rentang Skor Mentah
      { width: 18 }, // H Rentang Skor Rerata
      { width: 4 },  // I Spacer
      { width: 18 }, // J Chart Area
      { width: 18 }, // K Chart Area
      { width: 18 }, // L Chart Area
      { width: 18 }, // M Chart Area
      { width: 18 }, // N Chart Area
    ];

    // Judul Banner
    sheetSummary.mergeCells("B2:N2");
    const titleCell = sheetSummary.getCell("B2");
    titleCell.value = "LAPORAN HASIL KUESIONER PSIKOLOGIS & PENGELOMPOKAN POPULATION TERCILES";
    titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheetSummary.getRow(2).height = 32;

    // Subjudul / Deskripsi Metodologi
    sheetSummary.mergeCells("B3:N3");
    const descCell = sheetSummary.getCell("B3");
    descCell.value = `Tanggal Ekspor: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })} | Metodologi: Pemeringkatan Skor (1..N) dibagi seimbang menjadi 3 Kelompok Tercile (Tinggi 33.3%, Sedang 33.3%, Rendah 33.3%).`;
    descCell.font = { italic: true, size: 9.5, color: { argb: "FF475569" } };
    descCell.alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getRow(3).height = 20;

    sheetSummary.mergeCells("B4:N4");
    const subNotice = sheetSummary.getCell("B4");
    subNotice.value =
      "⚡ Seluruh frekuensi & persentase tabel dihitung secara dinamis via RUMUS EXCEL (=COUNTIF, =AVERAGE, =SUM) bersanding dengan Diagram Lingkaran Visual Dashboard.";
    subNotice.font = { bold: true, size: 9, color: { argb: "FF0369A1" } };
    subNotice.alignment = { vertical: "middle", horizontal: "center" };
    subNotice.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F9FF" } };
    sheetSummary.getRow(4).height = 20;

    const formatSectionHeader = (cellRef: string, text: string, bgColor = "FF1E293B") => {
      sheetSummary.mergeCells(cellRef);
      const cell = sheetSummary.getCell(cellRef.split(":")[0]);
      cell.value = text;
      cell.font = { bold: true, size: 10.5, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.alignment = { vertical: "middle", indent: 1 };
    };

    // ── 1. Metrik Partisipasi Responden ──
    formatSectionHeader("B6:N6", "1. RINGKASAN POPULASI & METRIK PARTISIPASI RESPONDEN");
    sheetSummary.getRow(6).height = 23;

    // Row 7: Total Responden Mengisi & Total Akun Terdaftar
    sheetSummary.getRow(7).height = 22;
    sheetSummary.getCell("B7").value = "Total Responden Mengisi";
    sheetSummary.getCell("B7").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("B7").border = borderStyle;

    sheetSummary.getCell("C7").value = {
      formula: `COUNTA('Daftar Profil Responden'!$B$${firstDataRow}:$B$${lastDataRow})`,
      result: totalCompleted,
    };
    sheetSummary.getCell("C7").numFmt = "#,##0";
    sheetSummary.getCell("C7").font = { bold: true, size: 10.5, color: { argb: "FF047857" } };
    sheetSummary.getCell("C7").alignment = { horizontal: "center", vertical: "middle" };
    sheetSummary.getCell("C7").border = borderStyle;

    sheetSummary.mergeCells("D7:E7");
    const lblMetode = sheetSummary.getCell("D7");
    lblMetode.value = "Metode Kategorisasi";
    lblMetode.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    lblMetode.border = borderStyle;
    sheetSummary.getCell("E7").border = borderStyle;

    sheetSummary.mergeCells("F7:H7");
    const valMetode = sheetSummary.getCell("F7");
    valMetode.value = "Population Terciles (Seimbang 33.3%)";
    valMetode.alignment = { horizontal: "center", vertical: "middle" };
    valMetode.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    valMetode.border = borderStyle;
    sheetSummary.getCell("G7").border = borderStyle;
    sheetSummary.getCell("H7").border = borderStyle;

    sheetSummary.getCell("J7").value = "Total Akun Terdaftar";
    sheetSummary.getCell("J7").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("J7").border = borderStyle;

    sheetSummary.getCell("K7").value = allRespondents.length;
    sheetSummary.getCell("K7").numFmt = "#,##0";
    sheetSummary.getCell("K7").font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    sheetSummary.getCell("K7").alignment = { horizontal: "center", vertical: "middle" };
    sheetSummary.getCell("K7").border = borderStyle;

    sheetSummary.mergeCells("L7:M7");
    const lblPart = sheetSummary.getCell("L7");
    lblPart.value = "Tingkat Partisipasi";
    lblPart.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    lblPart.border = borderStyle;
    sheetSummary.getCell("M7").border = borderStyle;

    const valPart = sheetSummary.getCell("N7");
    valPart.value = {
      formula: `'Ringkasan & Metodologi'!C7 / 'Ringkasan & Metodologi'!K7`,
      result: allRespondents.length > 0 ? totalCompleted / allRespondents.length : 0,
    };
    valPart.numFmt = "0.0%";
    valPart.font = { bold: true, size: 10, color: { argb: "FF047857" } };
    valPart.alignment = { horizontal: "center", vertical: "middle" };
    valPart.border = borderStyle;

    // Row 8: Rata-rata Skor Populasi (LA & EI)
    sheetSummary.getRow(8).height = 22;
    sheetSummary.getCell("B8").value = "Rata-rata Skor LA (Total)";
    sheetSummary.getCell("B8").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("B8").border = borderStyle;

    sheetSummary.getCell("C8").value = {
      formula: `AVERAGE('Daftar Profil Responden'!$E$${firstDataRow}:$E$${lastDataRow})`,
      result: avgLaRaw,
    };
    sheetSummary.getCell("C8").numFmt = '0.0 "pts"';
    sheetSummary.getCell("C8").font = { bold: true, size: 10, color: { argb: "FF0D9488" } };
    sheetSummary.getCell("C8").alignment = { horizontal: "center", vertical: "middle" };
    sheetSummary.getCell("C8").border = borderStyle;

    sheetSummary.mergeCells("D8:E8");
    const lblLaScale = sheetSummary.getCell("D8");
    lblLaScale.value = "Rerata Skala LA (1-5)";
    lblLaScale.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    lblLaScale.border = borderStyle;
    sheetSummary.getCell("E8").border = borderStyle;

    sheetSummary.mergeCells("F8:H8");
    const valLaScale = sheetSummary.getCell("F8");
    valLaScale.value = {
      formula: `AVERAGE('Daftar Profil Responden'!$F$${firstDataRow}:$F$${lastDataRow})`,
      result: avgLaScale,
    };
    valLaScale.numFmt = '0.00 "skala"';
    valLaScale.font = { bold: true, size: 10, color: { argb: "FF0D9488" } };
    valLaScale.alignment = { horizontal: "center", vertical: "middle" };
    valLaScale.border = borderStyle;
    sheetSummary.getCell("G8").border = borderStyle;
    sheetSummary.getCell("H8").border = borderStyle;

    sheetSummary.getCell("J8").value = "Rata-rata Skor EI (Total)";
    sheetSummary.getCell("J8").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("J8").border = borderStyle;

    sheetSummary.getCell("K8").value = {
      formula: `AVERAGE('Daftar Profil Responden'!$I$${firstDataRow}:$I$${lastDataRow})`,
      result: avgEiRaw,
    };
    sheetSummary.getCell("K8").numFmt = '0.0 "pts"';
    sheetSummary.getCell("K8").font = { bold: true, size: 10, color: { argb: "FF4338CA" } };
    sheetSummary.getCell("K8").alignment = { horizontal: "center", vertical: "middle" };
    sheetSummary.getCell("K8").border = borderStyle;

    sheetSummary.mergeCells("L8:M8");
    const lblEiScale = sheetSummary.getCell("L8");
    lblEiScale.value = "Rerata Skala EI (1-5)";
    lblEiScale.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    lblEiScale.border = borderStyle;
    sheetSummary.getCell("M8").border = borderStyle;

    const valEiScale = sheetSummary.getCell("N8");
    valEiScale.value = {
      formula: `AVERAGE('Daftar Profil Responden'!$J$${firstDataRow}:$J$${lastDataRow})`,
      result: avgEiScale,
    };
    valEiScale.numFmt = '0.00 "skala"';
    valEiScale.font = { bold: true, size: 10, color: { argb: "FF4338CA" } };
    valEiScale.alignment = { horizontal: "center", vertical: "middle" };
    valEiScale.border = borderStyle;

    // Row 9: Catatan Cakupan & Dominansi
    sheetSummary.getRow(9).height = 22;
    sheetSummary.getCell("B9").value = "Cakupan Ekspor";
    sheetSummary.getCell("B9").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("B9").border = borderStyle;

    sheetSummary.mergeCells("C9:E9");
    const valCakup = sheetSummary.getCell("C9");
    valCakup.value = "Hanya Responden Selesai Mengisi Kuesioner";
    valCakup.font = { size: 9.5, color: { argb: "FF0F172A" } };
    valCakup.alignment = { horizontal: "center", vertical: "middle" };
    valCakup.border = borderStyle;
    sheetSummary.getCell("D9").border = borderStyle;
    sheetSummary.getCell("E9").border = borderStyle;

    sheetSummary.mergeCells("F9:H9");
    const valInstr = sheetSummary.getCell("F9");
    valInstr.value = "Instrumen LA: 15 Butir | EI: 15 Butir (Likert 1-5)";
    valInstr.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    valInstr.alignment = { horizontal: "center", vertical: "middle" };
    valInstr.border = borderStyle;
    sheetSummary.getCell("G9").border = borderStyle;
    sheetSummary.getCell("H9").border = borderStyle;

    sheetSummary.getCell("J9").value = "Dominansi Kelompok";
    sheetSummary.getCell("J9").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("J9").border = borderStyle;

    sheetSummary.mergeCells("K9:N9");
    const valDom = sheetSummary.getCell("K9");
    valDom.value = dominantText;
    valDom.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    valDom.alignment = { horizontal: "center", vertical: "middle" };
    valDom.border = borderStyle;
    sheetSummary.getCell("L9").border = borderStyle;
    sheetSummary.getCell("M9").border = borderStyle;
    sheetSummary.getCell("N9").border = borderStyle;

    // ── 2. Tabel Ambang Batas Tercile Loss Aversion (LA) ──
    formatSectionHeader("B11:H11", "2. AMBANG BATAS & SEBARAN TERCILE — LOSS AVERSION (LA)", "FF0F766E");
    sheetSummary.getRow(11).height = 23;

    const cutoffHeaders = [
      "Kategori",
      "Kode",
      "Jumlah Responden",
      "Persentase",
      "Rentang Peringkat (Rank)",
      "Rentang Skor Mentah",
      "Rentang Skor Rerata",
    ];
    const cutoffHeaderRow1 = sheetSummary.getRow(12);
    cutoffHeaderRow1.height = 21;
    ["B", "C", "D", "E", "F", "G", "H"].forEach((col, idx) => {
      const cell = sheetSummary.getCell(`${col}12`);
      cell.value = cutoffHeaders[idx];
      cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    const laCutoffRowsDef = [
      {
        kategori: "Tinggi",
        kode: "T",
        preCount: laCutoff.countTinggi,
        pctPre: pctTinggiLA,
        rankRange: laCutoff.countTinggi > 0 ? `Peringkat 1 s/d ${laCutoff.countTinggi}` : "—",
        scoreRange: laCutoff.tinggiMinScore !== null ? `${laCutoff.tinggiMinScore} s/d ${laCutoff.tinggiMaxScore}` : "—",
        avgRange: laCutoff.tinggiMinAvg !== null ? `${laCutoff.tinggiMinAvg?.toFixed(2)} s/d ${laCutoff.tinggiMaxAvg?.toFixed(2)}` : "—",
        bg: "FFF0FDF4",
      },
      {
        kategori: "Sedang",
        kode: "S",
        preCount: laCutoff.countSedang,
        pctPre: pctSedangLA,
        rankRange: laCutoff.countSedang > 0 ? `Peringkat ${laCutoff.countTinggi + 1} s/d ${laCutoff.countTinggi + laCutoff.countSedang}` : "—",
        scoreRange: laCutoff.sedangMinScore !== null ? `${laCutoff.sedangMinScore} s/d ${laCutoff.sedangMaxScore}` : "—",
        avgRange: laCutoff.sedangMinAvg !== null ? `${laCutoff.sedangMinAvg?.toFixed(2)} s/d ${laCutoff.sedangMaxAvg?.toFixed(2)}` : "—",
        bg: "FFEFF6FF",
      },
      {
        kategori: "Rendah",
        kode: "R",
        preCount: laCutoff.countRendah,
        pctPre: pctRendahLA,
        rankRange: laCutoff.countRendah > 0 ? `Peringkat ${laCutoff.countTinggi + laCutoff.countSedang + 1} s/d ${totalCompleted}` : "—",
        scoreRange: laCutoff.rendahMinScore !== null ? `${laCutoff.rendahMinScore} s/d ${laCutoff.rendahMaxScore}` : "—",
        avgRange: laCutoff.rendahMinAvg !== null ? `${laCutoff.rendahMinAvg?.toFixed(2)} s/d ${laCutoff.rendahMaxAvg?.toFixed(2)}` : "—",
        bg: "FFFFF1F2",
      },
    ];

    laCutoffRowsDef.forEach((item, i) => {
      const rowIdx = 13 + i;
      sheetSummary.getRow(rowIdx).height = 20;

      // Kategori
      const cKat = sheetSummary.getCell(`B${rowIdx}`);
      cKat.value = item.kategori;
      cKat.font = { bold: true, size: 9.5 };
      cKat.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.bg } };
      cKat.alignment = { vertical: "middle", horizontal: "center" };
      cKat.border = borderStyle;

      // Kode
      const cKode = sheetSummary.getCell(`C${rowIdx}`);
      cKode.value = item.kode;
      cKode.font = { bold: true, size: 9.5 };
      cKode.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.bg } };
      cKode.alignment = { vertical: "middle", horizontal: "center" };
      cKode.border = borderStyle;

      // Jumlah Responden (COUNTIF)
      const cCount = sheetSummary.getCell(`D${rowIdx}`);
      cCount.value = {
        formula: `COUNTIF('Daftar Profil Responden'!$H$${firstDataRow}:$H$${lastDataRow}, "*${item.kategori}*")`,
        result: item.preCount,
      };
      cCount.numFmt = "#,##0";
      cCount.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
      cCount.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.bg } };
      cCount.alignment = { vertical: "middle", horizontal: "center" };
      cCount.border = borderStyle;

      // Persentase (D{row}/$C$7)
      const cPct = sheetSummary.getCell(`E${rowIdx}`);
      cPct.value = {
        formula: `D${rowIdx}/$C$7`,
        result: item.pctPre,
      };
      cPct.numFmt = "0.0%";
      cPct.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      cPct.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.bg } };
      cPct.alignment = { vertical: "middle", horizontal: "center" };
      cPct.border = borderStyle;

      // Rank Range
      const cRank = sheetSummary.getCell(`F${rowIdx}`);
      cRank.value = item.rankRange;
      cRank.font = { size: 9 };
      cRank.alignment = { vertical: "middle", horizontal: "center" };
      cRank.border = borderStyle;

      // Score Range
      const cScore = sheetSummary.getCell(`G${rowIdx}`);
      cScore.value = item.scoreRange;
      cScore.font = { size: 9 };
      cScore.alignment = { vertical: "middle", horizontal: "center" };
      cScore.border = borderStyle;

      // Avg Range
      const cAvg = sheetSummary.getCell(`H${rowIdx}`);
      cAvg.value = item.avgRange;
      cAvg.font = { size: 9 };
      cAvg.alignment = { vertical: "middle", horizontal: "center" };
      cAvg.border = borderStyle;
    });

    // Total Row LA
    sheetSummary.getRow(16).height = 20;
    sheetSummary.mergeCells("B16:C16");
    const lblTotalLA = sheetSummary.getCell("B16");
    lblTotalLA.value = "Total Populasi LA";
    lblTotalLA.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    lblTotalLA.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    lblTotalLA.alignment = { vertical: "middle", horizontal: "center" };
    lblTotalLA.border = borderStyle;
    sheetSummary.getCell("C16").border = borderStyle;

    const valTotalCountLA = sheetSummary.getCell("D16");
    valTotalCountLA.value = {
      formula: "SUM(D13:D15)",
      result: totalCompleted,
    };
    valTotalCountLA.numFmt = "#,##0";
    valTotalCountLA.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    valTotalCountLA.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    valTotalCountLA.alignment = { vertical: "middle", horizontal: "center" };
    valTotalCountLA.border = borderStyle;

    const valTotalPctLA = sheetSummary.getCell("E16");
    valTotalPctLA.value = {
      formula: "SUM(E13:E15)",
      result: 1.0,
    };
    valTotalPctLA.numFmt = "0.0%";
    valTotalPctLA.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    valTotalPctLA.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    valTotalPctLA.alignment = { vertical: "middle", horizontal: "center" };
    valTotalPctLA.border = borderStyle;

    sheetSummary.mergeCells("F16:H16");
    const lblStatusLA = sheetSummary.getCell("F16");
    lblStatusLA.value = "100.0% Terdistribusi Seimbang (Terciles)";
    lblStatusLA.font = { italic: true, size: 9, color: { argb: "FF0D9488" } };
    lblStatusLA.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    lblStatusLA.alignment = { vertical: "middle", horizontal: "center" };
    lblStatusLA.border = borderStyle;
    sheetSummary.getCell("G16").border = borderStyle;
    sheetSummary.getCell("H16").border = borderStyle;

    // Catatan Ringkas LA
    const laNotes = [
      "Loss Aversion (LA) mengukur keengganan investor terhadap kerugian finansial dibandingkan keuntungan bernilai sama.",
      "Kategori Tinggi (T) mencerminkan sensitivitas tinggi terhadap potensi kerugian dan kecenderungan menghindari risiko.",
      "Instrumen terdiri atas 15 butir pernyataan skala Likert 1–5 (Skor total 15 s/d 75 poin).",
    ];
    laNotes.forEach((note, idx) => {
      const rIdx = 17 + idx;
      sheetSummary.getRow(rIdx).height = 18;
      sheetSummary.mergeCells(`B${rIdx}:H${rIdx}`);
      const c = sheetSummary.getCell(`B${rIdx}`);
      c.value = `• ${note}`;
      c.font = { italic: true, size: 8.5, color: { argb: "FF64748B" } };
      c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    });

    // Embed Diagram 1: Loss Aversion (LA)
    const imgLAId = workbook.addImage({
      buffer: pngChartLA as any,
      extension: "png",
    });
    sheetSummary.addImage(imgLAId, {
      tl: { col: 9, row: 10 },
      ext: { width: 460, height: 215 },
    });

    // ── 3. Tabel Ambang Batas Tercile Emotional Intelligence (EI) ──
    formatSectionHeader("B22:H22", "3. AMBANG BATAS & SEBARAN TERCILE — EMOTIONAL INTELLIGENCE (EI)", "FF4338CA");
    sheetSummary.getRow(22).height = 23;

    const cutoffHeaderRow2 = sheetSummary.getRow(23);
    cutoffHeaderRow2.height = 21;
    ["B", "C", "D", "E", "F", "G", "H"].forEach((col, idx) => {
      const cell = sheetSummary.getCell(`${col}23`);
      cell.value = cutoffHeaders[idx];
      cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    const eiCutoffRowsDef = [
      {
        kategori: "Tinggi",
        kode: "T",
        preCount: eiCutoff.countTinggi,
        pctPre: pctTinggiEI,
        rankRange: eiCutoff.countTinggi > 0 ? `Peringkat 1 s/d ${eiCutoff.countTinggi}` : "—",
        scoreRange: eiCutoff.tinggiMinScore !== null ? `${eiCutoff.tinggiMinScore} s/d ${eiCutoff.tinggiMaxScore}` : "—",
        avgRange: eiCutoff.tinggiMinAvg !== null ? `${eiCutoff.tinggiMinAvg?.toFixed(2)} s/d ${eiCutoff.tinggiMaxAvg?.toFixed(2)}` : "—",
        bg: "FFF0FDF4",
      },
      {
        kategori: "Sedang",
        kode: "S",
        preCount: eiCutoff.countSedang,
        pctPre: pctSedangEI,
        rankRange: eiCutoff.countSedang > 0 ? `Peringkat ${eiCutoff.countTinggi + 1} s/d ${eiCutoff.countTinggi + eiCutoff.countSedang}` : "—",
        scoreRange: eiCutoff.sedangMinScore !== null ? `${eiCutoff.sedangMinScore} s/d ${eiCutoff.sedangMaxScore}` : "—",
        avgRange: eiCutoff.sedangMinAvg !== null ? `${eiCutoff.sedangMinAvg?.toFixed(2)} s/d ${eiCutoff.sedangMaxAvg?.toFixed(2)}` : "—",
        bg: "FFEFF6FF",
      },
      {
        kategori: "Rendah",
        kode: "R",
        preCount: eiCutoff.countRendah,
        pctPre: pctRendahEI,
        rankRange: eiCutoff.countRendah > 0 ? `Peringkat ${eiCutoff.countTinggi + eiCutoff.countSedang + 1} s/d ${totalCompleted}` : "—",
        scoreRange: eiCutoff.rendahMinScore !== null ? `${eiCutoff.rendahMinScore} s/d ${eiCutoff.rendahMaxScore}` : "—",
        avgRange: eiCutoff.rendahMinAvg !== null ? `${eiCutoff.rendahMinAvg?.toFixed(2)} s/d ${eiCutoff.rendahMaxAvg?.toFixed(2)}` : "—",
        bg: "FFFFF1F2",
      },
    ];

    eiCutoffRowsDef.forEach((item, i) => {
      const rowIdx = 24 + i;
      sheetSummary.getRow(rowIdx).height = 20;

      // Kategori
      const cKat = sheetSummary.getCell(`B${rowIdx}`);
      cKat.value = item.kategori;
      cKat.font = { bold: true, size: 9.5 };
      cKat.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.bg } };
      cKat.alignment = { vertical: "middle", horizontal: "center" };
      cKat.border = borderStyle;

      // Kode
      const cKode = sheetSummary.getCell(`C${rowIdx}`);
      cKode.value = item.kode;
      cKode.font = { bold: true, size: 9.5 };
      cKode.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.bg } };
      cKode.alignment = { vertical: "middle", horizontal: "center" };
      cKode.border = borderStyle;

      // Jumlah Responden (COUNTIF)
      const cCount = sheetSummary.getCell(`D${rowIdx}`);
      cCount.value = {
        formula: `COUNTIF('Daftar Profil Responden'!$L$${firstDataRow}:$L$${lastDataRow}, "*${item.kategori}*")`,
        result: item.preCount,
      };
      cCount.numFmt = "#,##0";
      cCount.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
      cCount.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.bg } };
      cCount.alignment = { vertical: "middle", horizontal: "center" };
      cCount.border = borderStyle;

      // Persentase (D{row}/$C$7)
      const cPct = sheetSummary.getCell(`E${rowIdx}`);
      cPct.value = {
        formula: `D${rowIdx}/$C$7`,
        result: item.pctPre,
      };
      cPct.numFmt = "0.0%";
      cPct.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      cPct.fill = { type: "pattern", pattern: "solid", fgColor: { argb: item.bg } };
      cPct.alignment = { vertical: "middle", horizontal: "center" };
      cPct.border = borderStyle;

      // Rank Range
      const cRank = sheetSummary.getCell(`F${rowIdx}`);
      cRank.value = item.rankRange;
      cRank.font = { size: 9 };
      cRank.alignment = { vertical: "middle", horizontal: "center" };
      cRank.border = borderStyle;

      // Score Range
      const cScore = sheetSummary.getCell(`G${rowIdx}`);
      cScore.value = item.scoreRange;
      cScore.font = { size: 9 };
      cScore.alignment = { vertical: "middle", horizontal: "center" };
      cScore.border = borderStyle;

      // Avg Range
      const cAvg = sheetSummary.getCell(`H${rowIdx}`);
      cAvg.value = item.avgRange;
      cAvg.font = { size: 9 };
      cAvg.alignment = { vertical: "middle", horizontal: "center" };
      cAvg.border = borderStyle;
    });

    // Total Row EI
    sheetSummary.getRow(27).height = 20;
    sheetSummary.mergeCells("B27:C27");
    const lblTotalEI = sheetSummary.getCell("B27");
    lblTotalEI.value = "Total Populasi EI";
    lblTotalEI.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    lblTotalEI.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    lblTotalEI.alignment = { vertical: "middle", horizontal: "center" };
    lblTotalEI.border = borderStyle;
    sheetSummary.getCell("C27").border = borderStyle;

    const valTotalCountEI = sheetSummary.getCell("D27");
    valTotalCountEI.value = {
      formula: "SUM(D24:D26)",
      result: totalCompleted,
    };
    valTotalCountEI.numFmt = "#,##0";
    valTotalCountEI.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    valTotalCountEI.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    valTotalCountEI.alignment = { vertical: "middle", horizontal: "center" };
    valTotalCountEI.border = borderStyle;

    const valTotalPctEI = sheetSummary.getCell("E27");
    valTotalPctEI.value = {
      formula: "SUM(E24:E26)",
      result: 1.0,
    };
    valTotalPctEI.numFmt = "0.0%";
    valTotalPctEI.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    valTotalPctEI.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    valTotalPctEI.alignment = { vertical: "middle", horizontal: "center" };
    valTotalPctEI.border = borderStyle;

    sheetSummary.mergeCells("F27:H27");
    const lblStatusEI = sheetSummary.getCell("F27");
    lblStatusEI.value = "100.0% Terdistribusi Seimbang (Terciles)";
    lblStatusEI.font = { italic: true, size: 9, color: { argb: "FF4338CA" } };
    lblStatusEI.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    lblStatusEI.alignment = { vertical: "middle", horizontal: "center" };
    lblStatusEI.border = borderStyle;
    sheetSummary.getCell("G27").border = borderStyle;
    sheetSummary.getCell("H27").border = borderStyle;

    // Catatan Ringkas EI
    const eiNotes = [
      "Emotional Intelligence (EI) mengukur kesadaran diri, regulasi emosi, motivasi, empati, dan keterampilan sosial.",
      "Kategori Tinggi (T) menunjukkan kemampuan regulasi emosi yang matang saat menghadapi gejolak pasar finansial.",
      "Instrumen terdiri atas 15 butir pernyataan skala Likert 1–5 (Skor total 15 s/d 75 poin).",
    ];
    eiNotes.forEach((note, idx) => {
      const rIdx = 28 + idx;
      sheetSummary.getRow(rIdx).height = 18;
      sheetSummary.mergeCells(`B${rIdx}:H${rIdx}`);
      const c = sheetSummary.getCell(`B${rIdx}`);
      c.value = `• ${note}`;
      c.font = { italic: true, size: 8.5, color: { argb: "FF64748B" } };
      c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    });

    // Embed Diagram 2: Emotional Intelligence (EI)
    const imgEIId = workbook.addImage({
      buffer: pngChartEI as any,
      extension: "png",
    });
    sheetSummary.addImage(imgEIId, {
      tl: { col: 9, row: 21 },
      ext: { width: 460, height: 215 },
    });

    // ── 4. Tabel Distribusi 9 Kelompok Profil Psikologis (A s/d I) ──
    formatSectionHeader("B33:H33", "4. DISTRIBUSI 9 KELOMPOK PROFIL PSIKOLOGIS (KELOMPOK A s/d I)", "FF6D28D9");
    sheetSummary.getRow(33).height = 23;

    const groupHeaders = [
      "Kelompok",
      "Kode",
      "Jumlah",
      "Persentase",
      "Kategori LA & EI",
      "Label & Karakteristik Profil",
    ];
    const groupHeaderRow = sheetSummary.getRow(34);
    groupHeaderRow.height = 21;
    sheetSummary.getCell("B34").value = groupHeaders[0];
    sheetSummary.getCell("C34").value = groupHeaders[1];
    sheetSummary.getCell("D34").value = groupHeaders[2];
    sheetSummary.getCell("E34").value = groupHeaders[3];
    sheetSummary.getCell("F34").value = groupHeaders[4];
    sheetSummary.mergeCells("G34:H34");
    sheetSummary.getCell("G34").value = groupHeaders[5];

    ["B", "C", "D", "E", "F", "G", "H"].forEach((col) => {
      const cell = sheetSummary.getCell(`${col}34`);
      cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    const allGroupKeys: ProfileGroup[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    allGroupKeys.forEach((grp, i) => {
      const rowIdx = 35 + i;
      sheetSummary.getRow(rowIdx).height = 20;
      const def = PROFILE_MATRIX[grp];
      const count = groupCounts[grp] || 0;
      const pctPre = totalCompleted > 0 ? count / totalCompleted : 0;

      // B: Kelompok
      const cGrp = sheetSummary.getCell(`B${rowIdx}`);
      cGrp.value = `Kelompok ${grp}`;
      cGrp.font = { bold: true, size: 9 };
      cGrp.alignment = { vertical: "middle", horizontal: "center" };
      cGrp.border = borderStyle;

      // C: Kode
      const cCode = sheetSummary.getCell(`C${rowIdx}`);
      cCode.value = def.code;
      cCode.font = { bold: true, size: 8.5, color: { argb: "FF475569" } };
      cCode.alignment = { vertical: "middle", horizontal: "center" };
      cCode.border = borderStyle;

      // D: Jumlah Responden (COUNTIF)
      const cCount = sheetSummary.getCell(`D${rowIdx}`);
      cCount.value = {
        formula: `COUNTIF('Daftar Profil Responden'!$M$${firstDataRow}:$M$${lastDataRow}, "*Kelompok ${grp}*")`,
        result: count,
      };
      cCount.numFmt = "#,##0";
      cCount.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
      cCount.alignment = { vertical: "middle", horizontal: "center" };
      cCount.border = borderStyle;

      // E: Persentase (D{row}/$C$7)
      const cPct = sheetSummary.getCell(`E${rowIdx}`);
      cPct.value = {
        formula: `D${rowIdx}/$C$7`,
        result: pctPre,
      };
      cPct.numFmt = "0.0%";
      cPct.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      cPct.alignment = { vertical: "middle", horizontal: "center" };
      cPct.border = borderStyle;

      // F: Kategori LA & EI
      const cCat = sheetSummary.getCell(`F${rowIdx}`);
      const laDesc = def.laCategory === "T" ? "Tinggi" : def.laCategory === "S" ? "Sedang" : "Rendah";
      const eiDesc = def.eiCategory === "T" ? "Tinggi" : def.eiCategory === "S" ? "Sedang" : "Rendah";
      cCat.value = `LA ${laDesc} · EI ${eiDesc}`;
      cCat.font = { size: 9, color: { argb: "FF334155" } };
      cCat.alignment = { vertical: "middle", horizontal: "center" };
      cCat.border = borderStyle;

      // G:H Label Profil
      sheetSummary.mergeCells(`G${rowIdx}:H${rowIdx}`);
      const cLbl = sheetSummary.getCell(`G${rowIdx}`);
      cLbl.value = def.label;
      cLbl.font = { size: 8.5, color: { argb: "FF0F172A" } };
      cLbl.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cLbl.border = borderStyle;
      sheetSummary.getCell(`H${rowIdx}`).border = borderStyle;
    });

    // Total Row Kelompok (Row 44)
    sheetSummary.getRow(44).height = 20;
    sheetSummary.mergeCells("B44:C44");
    const lblTotalGrp = sheetSummary.getCell("B44");
    lblTotalGrp.value = "Total Kelompok (A s/d I)";
    lblTotalGrp.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    lblTotalGrp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    lblTotalGrp.alignment = { vertical: "middle", horizontal: "center" };
    lblTotalGrp.border = borderStyle;
    sheetSummary.getCell("C44").border = borderStyle;

    const valTotalCountGrp = sheetSummary.getCell("D44");
    valTotalCountGrp.value = {
      formula: "SUM(D35:D43)",
      result: totalCompleted,
    };
    valTotalCountGrp.numFmt = "#,##0";
    valTotalCountGrp.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    valTotalCountGrp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    valTotalCountGrp.alignment = { vertical: "middle", horizontal: "center" };
    valTotalCountGrp.border = borderStyle;

    const valTotalPctGrp = sheetSummary.getCell("E44");
    valTotalPctGrp.value = {
      formula: "SUM(E35:E43)",
      result: 1.0,
    };
    valTotalPctGrp.numFmt = "0.0%";
    valTotalPctGrp.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    valTotalPctGrp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    valTotalPctGrp.alignment = { vertical: "middle", horizontal: "center" };
    valTotalPctGrp.border = borderStyle;

    sheetSummary.mergeCells("F44:H44");
    const lblStatusGrp = sheetSummary.getCell("F44");
    lblStatusGrp.value = "9 Kelompok Profil Terprofil Lengkap";
    lblStatusGrp.font = { italic: true, size: 9, color: { argb: "FF6D28D9" } };
    lblStatusGrp.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    lblStatusGrp.alignment = { vertical: "middle", horizontal: "center" };
    lblStatusGrp.border = borderStyle;
    sheetSummary.getCell("G44").border = borderStyle;
    sheetSummary.getCell("H44").border = borderStyle;

    // Embed Diagram 3: 9 Kelompok Profil
    const imgGrpId = workbook.addImage({
      buffer: pngChartGroup as any,
      extension: "png",
    });
    sheetSummary.addImage(imgGrpId, {
      tl: { col: 9, row: 32 },
      ext: { width: 460, height: 240 },
    });

    // ── 5. Matriks 3x3 Interseksi Distribusi Kelompok Profil (LA × EI) ──
    formatSectionHeader("B46:N46", "5. MATRIKS 3x3 INTERSEKSI DISTRIBUSI KELOMPOK PROFIL (LA × EI)", "FF1E293B");
    sheetSummary.getRow(46).height = 24;

    const matrixHeaderRow = sheetSummary.getRow(47);
    matrixHeaderRow.height = 22;
    sheetSummary.getCell("B47").value = "Kategori LA \\ EI";
    sheetSummary.getCell("B47").font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    sheetSummary.getCell("B47").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    sheetSummary.getCell("B47").alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getCell("B47").border = borderStyle;

    sheetSummary.mergeCells("C47:E47");
    const mH1 = sheetSummary.getCell("C47");
    mH1.value = "EI Tinggi (T)";
    mH1.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    mH1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
    mH1.alignment = { vertical: "middle", horizontal: "center" };
    mH1.border = borderStyle;
    sheetSummary.getCell("D47").border = borderStyle;
    sheetSummary.getCell("E47").border = borderStyle;

    sheetSummary.mergeCells("F47:H47");
    const mH2 = sheetSummary.getCell("F47");
    mH2.value = "EI Sedang (S)";
    mH2.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    mH2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3730A3" } };
    mH2.alignment = { vertical: "middle", horizontal: "center" };
    mH2.border = borderStyle;
    sheetSummary.getCell("G47").border = borderStyle;
    sheetSummary.getCell("H47").border = borderStyle;

    sheetSummary.mergeCells("I47:K47");
    const mH3 = sheetSummary.getCell("I47");
    mH3.value = "EI Rendah (R)";
    mH3.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    mH3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
    mH3.alignment = { vertical: "middle", horizontal: "center" };
    mH3.border = borderStyle;
    sheetSummary.getCell("J47").border = borderStyle;
    sheetSummary.getCell("K47").border = borderStyle;

    sheetSummary.mergeCells("L47:N47");
    const mH4 = sheetSummary.getCell("L47");
    mH4.value = "Subtotal Baris LA";
    mH4.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    mH4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    mH4.alignment = { vertical: "middle", horizontal: "center" };
    mH4.border = borderStyle;
    sheetSummary.getCell("M47").border = borderStyle;
    sheetSummary.getCell("N47").border = borderStyle;

    const matrixRowsDef = [
      {
        rowIdx: 48,
        laLabel: "LA Tinggi (T)",
        g1: { grp: "A", rowRef: 35 },
        g2: { grp: "B", rowRef: 36 },
        g3: { grp: "C", rowRef: 37 },
        subtotalLaRow: 13,
      },
      {
        rowIdx: 49,
        laLabel: "LA Sedang (S)",
        g1: { grp: "D", rowRef: 38 },
        g2: { grp: "E", rowRef: 39 },
        g3: { grp: "F", rowRef: 40 },
        subtotalLaRow: 14,
      },
      {
        rowIdx: 50,
        laLabel: "LA Rendah (R)",
        g1: { grp: "G", rowRef: 41 },
        g2: { grp: "H", rowRef: 42 },
        g3: { grp: "I", rowRef: 43 },
        subtotalLaRow: 15,
      },
    ];

    matrixRowsDef.forEach((m) => {
      sheetSummary.getRow(m.rowIdx).height = 24;

      const laCell = sheetSummary.getCell(`B${m.rowIdx}`);
      laCell.value = m.laLabel;
      laCell.font = { bold: true, size: 9.5 };
      laCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      laCell.alignment = { vertical: "middle", horizontal: "center" };
      laCell.border = borderStyle;

      const renderMatrixItem = (startCol: string, midCol: string, endCol: string, item: { grp: string; rowRef: number }) => {
        sheetSummary.mergeCells(`${startCol}${m.rowIdx}:${endCol}${m.rowIdx}`);
        const c = sheetSummary.getCell(`${startCol}${m.rowIdx}`);
        const cnt = groupCounts[item.grp as ProfileGroup] || 0;
        const pct = totalCompleted > 0 ? ((cnt / totalCompleted) * 100).toFixed(1) : "0.0";

        c.value = {
          formula: `="Kelompok ${item.grp}: " & D${item.rowRef} & " org (" & TEXT(E${item.rowRef},"0.0%") & ")"`,
          result: `Kelompok ${item.grp}: ${cnt} org (${pct}%)`,
        };
        c.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
        c.alignment = { vertical: "middle", horizontal: "center" };
        c.border = borderStyle;
        sheetSummary.getCell(`${midCol}${m.rowIdx}`).border = borderStyle;
        sheetSummary.getCell(`${endCol}${m.rowIdx}`).border = borderStyle;
      };

      renderMatrixItem("C", "D", "E", m.g1);
      renderMatrixItem("F", "G", "H", m.g2);
      renderMatrixItem("I", "J", "K", m.g3);

      // Subtotal LA
      sheetSummary.mergeCells(`L${m.rowIdx}:N${m.rowIdx}`);
      const cSub = sheetSummary.getCell(`L${m.rowIdx}`);
      cSub.value = {
        formula: `="Subtotal: " & D${m.subtotalLaRow} & " org (" & TEXT(E${m.subtotalLaRow},"0.0%") & ")"`,
        result: `Subtotal LA`,
      };
      cSub.font = { bold: true, size: 9, color: { argb: "FF0F766E" } };
      cSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
      cSub.alignment = { vertical: "middle", horizontal: "center" };
      cSub.border = borderStyle;
      sheetSummary.getCell(`M${m.rowIdx}`).border = borderStyle;
      sheetSummary.getCell(`N${m.rowIdx}`).border = borderStyle;
    });

    // Row 51: Subtotal Kolom EI
    sheetSummary.getRow(51).height = 24;
    const cTotEI = sheetSummary.getCell("B51");
    cTotEI.value = "Subtotal Kolom EI";
    cTotEI.font = { bold: true, size: 9.5, color: { argb: "FF4338CA" } };
    cTotEI.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cTotEI.alignment = { vertical: "middle", horizontal: "center" };
    cTotEI.border = borderStyle;

    const renderEiSubtotal = (startCol: string, midCol: string, endCol: string, eiRowRef: number, lbl: string) => {
      sheetSummary.mergeCells(`${startCol}51:${endCol}51`);
      const c = sheetSummary.getCell(`${startCol}51`);
      c.value = {
        formula: `="Subtotal: " & D${eiRowRef} & " org (" & TEXT(E${eiRowRef},"0.0%") & ")"`,
        result: `Subtotal ${lbl}`,
      };
      c.font = { bold: true, size: 9, color: { argb: "FF4338CA" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
      c.alignment = { vertical: "middle", horizontal: "center" };
      c.border = borderStyle;
      sheetSummary.getCell(`${midCol}51`).border = borderStyle;
      sheetSummary.getCell(`${endCol}51`).border = borderStyle;
    };

    renderEiSubtotal("C", "D", "E", 24, "EI Tinggi");
    renderEiSubtotal("F", "G", "H", 25, "EI Sedang");
    renderEiSubtotal("I", "J", "K", 26, "EI Rendah");

    sheetSummary.mergeCells("L51:N51");
    const cGrandTot = sheetSummary.getCell("L51");
    cGrandTot.value = {
      formula: `="Grand Total: " & C7 & " org (100.0%)"`,
      result: `Grand Total: ${totalCompleted} org (100.0%)`,
    };
    cGrandTot.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
    cGrandTot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    cGrandTot.alignment = { vertical: "middle", horizontal: "center" };
    cGrandTot.border = borderStyle;
    sheetSummary.getCell("M51").border = borderStyle;
    sheetSummary.getCell("N51").border = borderStyle;

    // ─────────────────────────────────────────────────────────────
    // ── SHEET 2: Daftar Profil Responden (Psikometri LA & EI) ──
    // ─────────────────────────────────────────────────────────────
    const sheetProfiles = workbook.addWorksheet("Daftar Profil Responden", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    });

    const sheet2Columns = [
      { header: "No", key: "no", width: 6 },
      { header: "User ID", key: "userId", width: 10 },
      { header: "Nama Responden", key: "nama", width: 22 },
      { header: "Status Pengisian", key: "status", width: 16 },

      // Psikometri LA
      { header: "Total LA", key: "laRaw", width: 12 },
      { header: "Rerata LA", key: "laAvg", width: 12 },
      { header: "Peringkat LA", key: "laRank", width: 15 },
      { header: "Kategori LA", key: "laCat", width: 15 },

      // Psikometri EI
      { header: "Total EI", key: "eiRaw", width: 12 },
      { header: "Rerata EI", key: "eiAvg", width: 12 },
      { header: "Peringkat EI", key: "eiRank", width: 15 },
      { header: "Kategori EI", key: "eiCat", width: 15 },

      // Kelompok & Kode Profil
      { header: "Kelompok", key: "profileGroup", width: 14 },
      { header: "Kode Profil", key: "profileCode", width: 14 },
      { header: "String Profil", key: "profileLabel", width: 16 },
      { header: "Karakteristik & Profil Perilaku", key: "groupDesc", width: 45 },
      { header: "Waktu Selesai (WIB)", key: "completedAt", width: 22 },
    ];
    sheetProfiles.columns = sheet2Columns;

    const headerRow2 = sheetProfiles.getRow(1);
    headerRow2.height = 28;
    headerRow2.eachCell((cell, colNumber) => {
      let bgColor = "FF1E293B"; // Slate 800 (Default No, UserID, Nama, Status)
      if (colNumber >= 5 && colNumber <= 8) {
        bgColor = "FF0F766E"; // Teal 700 (LA)
      } else if (colNumber >= 9 && colNumber <= 12) {
        bgColor = "FF4338CA"; // Indigo 700 (EI)
      } else if (colNumber >= 13 && colNumber <= 15) {
        bgColor = "FF6366F1"; // Violet 600 (Kelompok & Kode Profil)
      }

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });



    sortedRespondents.forEach((u, index) => {
      const p = profileMap.get(u.id);
      const isCompleted = Boolean(p?.isCompleted);
      const groupKey = (p?.profileGroup || "E") as ProfileGroup;
      const groupDef = PROFILE_MATRIX[groupKey] || PROFILE_MATRIX.E;

      const laRank = isCompleted ? laRankMap.get(u.id) || null : null;
      const eiRank = isCompleted ? eiRankMap.get(u.id) || null : null;

      const rowData = {
        no: index + 1,
        userId: u.id,
        nama: u.nama,
        status: "Lengkap",

        // LA
        laRaw: p?.laRawScore ?? "—",
        laAvg: p ? Number(p.laAvgScore) : "—",
        laRank: laRank ? `Peringkat #${laRank}` : "—",
        laCat: p ? (p.laCategory === "T" ? "Tinggi (T)" : p.laCategory === "S" ? "Sedang (S)" : "Rendah (R)") : "—",

        // EI
        eiRaw: p?.eiRawScore ?? "—",
        eiAvg: p ? Number(p.eiAvgScore) : "—",
        eiRank: eiRank ? `Peringkat #${eiRank}` : "—",
        eiCat: p ? (p.eiCategory === "T" ? "Tinggi (T)" : p.eiCategory === "S" ? "Sedang (S)" : "Rendah (R)") : "—",

        // Kelompok & Kode Profil
        profileGroup: p ? `Kelompok ${p.profileGroup}` : "—",
        profileCode: p?.profileCode || "—",
        profileLabel: p?.profileLabel || "—",
        groupDesc: p ? groupDef.description : "—",
        completedAt: p?.completedAt ? new Date(p.completedAt).toLocaleString("id-ID") : "—",
      };

      const row = sheetProfiles.addRow(rowData);
      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };
        if (colNumber !== 3 && colNumber !== 16) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }

        // Badge Status Pengisian
        if (colNumber === 4) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          cell.font = { bold: true, color: { argb: "FF166534" } };
        }

        // Highlight sel kategori LA & EI sesuai kelompok tercile
        if (isCompleted) {
          if (colNumber === 8) { // Kategori LA
            if (p?.laCategory === "T") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
            if (p?.laCategory === "S") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
            if (p?.laCategory === "R") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } };
          }
          if (colNumber === 12) { // Kategori EI
            if (p?.eiCategory === "T") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
            if (p?.eiCategory === "S") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
            if (p?.eiCategory === "R") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } };
          }
          if (colNumber === 13) { // Kelompok
            cell.font = { bold: true };
          }
        }
      });
    });

    // ─────────────────────────────────────────────────────────────
    // ── SHEET 3: Matriks Jawaban Kuesioner (LA 1-15 & EI 1-15) ──
    // ─────────────────────────────────────────────────────────────
    const sheetResponses = workbook.addWorksheet("Matriks Jawaban Mentah", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    });

    const sheet3Columns: any[] = [
      { header: "No", key: "no", width: 6 },
      { header: "User ID", key: "userId", width: 10 },
      { header: "Nama Responden", key: "nama", width: 22 },
    ];

    laQuestions.forEach((q) => {
      sheet3Columns.push({
        header: `LA${q.orderNumber}`,
        key: `la_${q.id}`,
        width: 6,
      });
    });
    sheet3Columns.push(
      { header: "Total LA", key: "total_la", width: 11 },
      { header: "Rank LA", key: "rank_la", width: 11 },
      { header: "Kat. LA", key: "cat_la", width: 10 }
    );

    eiQuestions.forEach((q) => {
      sheet3Columns.push({
        header: `EI${q.orderNumber}`,
        key: `ei_${q.id}`,
        width: 6,
      });
    });
    sheet3Columns.push(
      { header: "Total EI", key: "total_ei", width: 11 },
      { header: "Rank EI", key: "rank_ei", width: 11 },
      { header: "Kat. EI", key: "cat_ei", width: 10 },
      { header: "Kelompok", key: "group", width: 12 },
      { header: "String Profil", key: "label", width: 16 }
    );

    sheetResponses.columns = sheet3Columns;

    const headerRow3 = sheetResponses.getRow(1);
    headerRow3.height = 28;
    const s3LaEnd = 3 + laQuestions.length;
    const s3EiStart = s3LaEnd + 4;
    const s3EiEnd = s3EiStart + eiQuestions.length - 1;

    headerRow3.eachCell((cell, colNumber) => {
      let bgColor = "FF1E293B"; // Slate 800 (No, User ID, Nama)
      if (colNumber > 3 && colNumber <= s3LaEnd + 3) {
        bgColor = "FF0F766E"; // Teal 700 (LA Butir & Summary)
      } else if (colNumber >= s3EiStart && colNumber <= s3EiEnd + 3) {
        bgColor = "FF4338CA"; // Indigo 700 (EI Butir & Summary)
      } else if (colNumber > s3EiEnd + 3) {
        bgColor = "FF6366F1"; // Indigo/Violet (Profile)
      }

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    sortedRespondents.forEach((u, index) => {
      const p = profileMap.get(u.id);
      const isCompleted = Boolean(p?.isCompleted);
      const laRank = isCompleted ? laRankMap.get(u.id) || null : null;
      const eiRank = isCompleted ? eiRankMap.get(u.id) || null : null;

      const rowData: any = {
        no: index + 1,
        userId: u.id,
        nama: u.nama,
      };

      let sumLa = 0;
      let hasLa = false;
      laQuestions.forEach((q) => {
        const val = responseMatrix.get(`${u.id}_${q.id}`);
        rowData[`la_${q.id}`] = val !== undefined ? val : "—";
        if (val !== undefined) {
          sumLa += val;
          hasLa = true;
        }
      });
      rowData.total_la = hasLa ? sumLa : (p ? p.laRawScore : "—");
      rowData.rank_la = laRank ? `#${laRank}` : "—";
      rowData.cat_la = p?.laCategory || "—";

      let sumEi = 0;
      let hasEi = false;
      eiQuestions.forEach((q) => {
        const val = responseMatrix.get(`${u.id}_${q.id}`);
        rowData[`ei_${q.id}`] = val !== undefined ? val : "—";
        if (val !== undefined) {
          sumEi += val;
          hasEi = true;
        }
      });
      rowData.total_ei = hasEi ? sumEi : (p ? p.eiRawScore : "—");
      rowData.rank_ei = eiRank ? `#${eiRank}` : "—";
      rowData.cat_ei = p?.eiCategory || "—";
      rowData.group = p ? `Kel. ${p.profileGroup}` : "—";
      rowData.label = p ? p.profileLabel : "—";

      const row = sheetResponses.addRow(rowData);
      row.height = 20;
      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };
        if (colNumber !== 3) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }
      });
    });

    // ─────────────────────────────────────────────────────────────
    // ── SHEET 4: Codebook & Definisi Instrumen (LA & EI) ──
    // ─────────────────────────────────────────────────────────────
    const sheetCodebook = workbook.addWorksheet("Codebook & Instrumen", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    });

    sheetCodebook.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Instrumen Penelitian", key: "section", width: 28 },
      { header: "Nomor Butir", key: "orderNumber", width: 14 },
      { header: "Kode Kolom", key: "code", width: 16 },
      { header: "Pernyataan / Indikator Instrumen", key: "questionText", width: 75 },
      { header: "Skala Penilaian", key: "scale", width: 40 },
    ];

    const headerRow4 = sheetCodebook.getRow(1);
    headerRow4.height = 28;
    headerRow4.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    let codebookCounter = 1;
    allQuestions.forEach((q) => {
      const isLA = q.instrument === "LA";
      const row = sheetCodebook.addRow({
        no: codebookCounter++,
        section: isLA ? "Instrumen 1: Loss Aversion (LA)" : "Instrumen 2: Emotional Intelligence (EI)",
        orderNumber: `Butir ${q.orderNumber}`,
        code: `${q.instrument}_${q.orderNumber}`,
        questionText: q.questionText,
        scale: "Likert 1 (Sangat Tidak Setuju) s/d 5 (Sangat Setuju)",
      });

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };
        if (colNumber <= 4) cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const safeDate = new Date().toISOString().slice(0, 10);
    const filename = targetUserId
      ? `Profil_Responden_${targetUserId}_${safeDate}.xlsx`
      : `Laporan_Profil_Psikologis_Responden_${safeDate}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting respondent profiles to Excel:", error);
    return NextResponse.json(
      { error: "Gagal mengekspor data profil responden ke Excel." },
      { status: 500 }
    );
  }
}
