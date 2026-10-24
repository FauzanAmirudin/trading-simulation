import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, respondentProfiles, questions, questionnaireResponses } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { PROFILE_MATRIX, ProfileGroup, computeTercileCutoffs, CategoryType } from "@/lib/questionnaire-logic";
import { requireAdmin } from "@/lib/auth-server";

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

    // 6. Create Workbook
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
      { width: 4 },  // A (margin)
      { width: 24 }, // B
      { width: 14 }, // C
      { width: 16 }, // D
      { width: 14 }, // E
      { width: 22 }, // F
      { width: 24 }, // G
      { width: 24 }, // H
    ];

    // Judul Banner
    sheetSummary.mergeCells("B2:H2");
    const titleCell = sheetSummary.getCell("B2");
    titleCell.value = "LAPORAN HASIL KUESIONER PSIKOLOGIS & PENGELOMPOKAN POPULATION TERCILES";
    titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheetSummary.getRow(2).height = 34;

    // Subjudul / Deskripsi Metodologi
    sheetSummary.mergeCells("B3:H3");
    const descCell = sheetSummary.getCell("B3");
    descCell.value =
      "Metodologi: Responden diurutkan berdasarkan skor dari atas ke bawah (peringkat 1 s/d N), lalu dibagi seimbang menjadi 3 kelompok sama rata (Tinggi 33.3%, Sedang 33.3%, Rendah 33.3%) untuk masing-masing instrumen (LA & EI).";
    descCell.font = { italic: true, size: 9.5, color: { argb: "FF475569" } };
    descCell.alignment = { vertical: "middle", horizontal: "left" };
    sheetSummary.getRow(3).height = 24;

    // ── 1. Metrik Partisipasi Responden ──
    const formatSectionHeader = (cellRef: string, text: string) => {
      sheetSummary.mergeCells(cellRef);
      const cell = sheetSummary.getCell(cellRef.split(":")[0]);
      cell.value = text;
      cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle", indent: 1 };
    };

    formatSectionHeader("B5:H5", "1. RINGKASAN POPULASI RESPONDEN");
    sheetSummary.getRow(5).height = 24;

    const summaryData = [
      ["Total Responden Mengisi (Diekspor)", totalCompleted, "Metode Kategorisasi", "Population Terciles (Seimbang 33.3%)"],
      ["Total Akun Responden Terdaftar", allRespondents.length, "Cakupan Ekspor", "Hanya Responden Selesai Mengisi Kuesioner"],
      [
        "Rata-rata Skor Populasi (LA)",
        totalCompleted > 0 ? (completedProfiles.reduce((s, p) => s + p.laRawScore, 0) / totalCompleted).toFixed(2) + " pts" : "—",
        "Rata-rata Skor Populasi (EI)",
        totalCompleted > 0 ? (completedProfiles.reduce((s, p) => s + p.eiRawScore, 0) / totalCompleted).toFixed(2) + " pts" : "—",
      ],
    ];

    summaryData.forEach((row, i) => {
      const rowIdx = 6 + i;
      sheetSummary.getRow(rowIdx).height = 20;

      sheetSummary.getCell(`B${rowIdx}`).value = row[0];
      sheetSummary.getCell(`B${rowIdx}`).font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      sheetSummary.getCell(`B${rowIdx}`).border = borderStyle;

      sheetSummary.getCell(`C${rowIdx}`).value = row[1];
      sheetSummary.getCell(`C${rowIdx}`).alignment = { horizontal: "center" };
      sheetSummary.getCell(`C${rowIdx}`).font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
      sheetSummary.getCell(`C${rowIdx}`).border = borderStyle;

      sheetSummary.mergeCells(`D${rowIdx}:E${rowIdx}`);
      const lblCell = sheetSummary.getCell(`D${rowIdx}`);
      lblCell.value = row[2];
      lblCell.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      lblCell.border = borderStyle;
      sheetSummary.getCell(`E${rowIdx}`).border = borderStyle;

      sheetSummary.mergeCells(`F${rowIdx}:H${rowIdx}`);
      const valCell = sheetSummary.getCell(`F${rowIdx}`);
      valCell.value = row[3];
      valCell.alignment = { horizontal: "center" };
      valCell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
      valCell.border = borderStyle;
      sheetSummary.getCell(`G${rowIdx}`).border = borderStyle;
      sheetSummary.getCell(`H${rowIdx}`).border = borderStyle;
    });

    // ── 2. Tabel Ambang Batas Tercile Loss Aversion (LA) ──
    formatSectionHeader("B10:H10", "2. AMBANG BATAS & SEBARAN TERCILE — LOSS AVERSION (LA)");
    sheetSummary.getRow(10).height = 24;

    const cutoffHeaders = ["Kategori", "Kode", "Jumlah Responden", "Persentase", "Rentang Peringkat (Rank)", "Rentang Skor Mentah", "Rentang Skor Rerata"];
    const cutoffHeaderRow1 = sheetSummary.getRow(11);
    cutoffHeaderRow1.height = 22;
    ["B", "C", "D", "E", "F", "G", "H"].forEach((col, idx) => {
      const cell = sheetSummary.getCell(`${col}11`);
      cell.value = cutoffHeaders[idx];
      cell.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }; // Teal
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    const laCutoffRows = [
      [
        "Tinggi", "T", laCutoff.countTinggi,
        totalCompleted > 0 ? `${((laCutoff.countTinggi / totalCompleted) * 100).toFixed(1)}%` : "—",
        laCutoff.countTinggi > 0 ? `Peringkat 1 s/d ${laCutoff.countTinggi}` : "—",
        laCutoff.tinggiMinScore !== null ? `${laCutoff.tinggiMinScore} s/d ${laCutoff.tinggiMaxScore}` : "—",
        laCutoff.tinggiMinAvg !== null ? `${laCutoff.tinggiMinAvg?.toFixed(2)} s/d ${laCutoff.tinggiMaxAvg?.toFixed(2)}` : "—",
      ],
      [
        "Sedang", "S", laCutoff.countSedang,
        totalCompleted > 0 ? `${((laCutoff.countSedang / totalCompleted) * 100).toFixed(1)}%` : "—",
        laCutoff.countSedang > 0 ? `Peringkat ${laCutoff.countTinggi + 1} s/d ${laCutoff.countTinggi + laCutoff.countSedang}` : "—",
        laCutoff.sedangMinScore !== null ? `${laCutoff.sedangMinScore} s/d ${laCutoff.sedangMaxScore}` : "—",
        laCutoff.sedangMinAvg !== null ? `${laCutoff.sedangMinAvg?.toFixed(2)} s/d ${laCutoff.sedangMaxAvg?.toFixed(2)}` : "—",
      ],
      [
        "Rendah", "R", laCutoff.countRendah,
        totalCompleted > 0 ? `${((laCutoff.countRendah / totalCompleted) * 100).toFixed(1)}%` : "—",
        laCutoff.countRendah > 0 ? `Peringkat ${laCutoff.countTinggi + laCutoff.countSedang + 1} s/d ${totalCompleted}` : "—",
        laCutoff.rendahMinScore !== null ? `${laCutoff.rendahMinScore} s/d ${laCutoff.rendahMaxScore}` : "—",
        laCutoff.rendahMinAvg !== null ? `${laCutoff.rendahMinAvg?.toFixed(2)} s/d ${laCutoff.rendahMaxAvg?.toFixed(2)}` : "—",
      ],
    ];

    laCutoffRows.forEach((row, i) => {
      const rowIdx = 12 + i;
      sheetSummary.getRow(rowIdx).height = 20;
      ["B", "C", "D", "E", "F", "G", "H"].forEach((col, idx) => {
        const cell = sheetSummary.getCell(`${col}${rowIdx}`);
        cell.value = row[idx];
        cell.font = { size: 9.5 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = borderStyle;
        if (i === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
        if (i === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
        if (i === 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF1F2" } };
      });
    });

    // ── 3. Tabel Ambang Batas Tercile Emotional Intelligence (EI) ──
    formatSectionHeader("B16:H16", "3. AMBANG BATAS & SEBARAN TERCILE — EMOTIONAL INTELLIGENCE (EI)");
    sheetSummary.getRow(16).height = 24;

    const cutoffHeaderRow2 = sheetSummary.getRow(17);
    cutoffHeaderRow2.height = 22;
    ["B", "C", "D", "E", "F", "G", "H"].forEach((col, idx) => {
      const cell = sheetSummary.getCell(`${col}17`);
      cell.value = cutoffHeaders[idx];
      cell.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } }; // Indigo
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    const eiCutoffRows = [
      [
        "Tinggi", "T", eiCutoff.countTinggi,
        totalCompleted > 0 ? `${((eiCutoff.countTinggi / totalCompleted) * 100).toFixed(1)}%` : "—",
        eiCutoff.countTinggi > 0 ? `Peringkat 1 s/d ${eiCutoff.countTinggi}` : "—",
        eiCutoff.tinggiMinScore !== null ? `${eiCutoff.tinggiMinScore} s/d ${eiCutoff.tinggiMaxScore}` : "—",
        eiCutoff.tinggiMinAvg !== null ? `${eiCutoff.tinggiMinAvg?.toFixed(2)} s/d ${eiCutoff.tinggiMaxAvg?.toFixed(2)}` : "—",
      ],
      [
        "Sedang", "S", eiCutoff.countSedang,
        totalCompleted > 0 ? `${((eiCutoff.countSedang / totalCompleted) * 100).toFixed(1)}%` : "—",
        eiCutoff.countSedang > 0 ? `Peringkat ${eiCutoff.countTinggi + 1} s/d ${eiCutoff.countTinggi + eiCutoff.countSedang}` : "—",
        eiCutoff.sedangMinScore !== null ? `${eiCutoff.sedangMinScore} s/d ${eiCutoff.sedangMaxScore}` : "—",
        eiCutoff.sedangMinAvg !== null ? `${eiCutoff.sedangMinAvg?.toFixed(2)} s/d ${eiCutoff.sedangMaxAvg?.toFixed(2)}` : "—",
      ],
      [
        "Rendah", "R", eiCutoff.countRendah,
        totalCompleted > 0 ? `${((eiCutoff.countRendah / totalCompleted) * 100).toFixed(1)}%` : "—",
        eiCutoff.countRendah > 0 ? `Peringkat ${eiCutoff.countTinggi + eiCutoff.countSedang + 1} s/d ${totalCompleted}` : "—",
        eiCutoff.rendahMinScore !== null ? `${eiCutoff.rendahMinScore} s/d ${eiCutoff.rendahMaxScore}` : "—",
        eiCutoff.rendahMinAvg !== null ? `${eiCutoff.rendahMinAvg?.toFixed(2)} s/d ${eiCutoff.rendahMaxAvg?.toFixed(2)}` : "—",
      ],
    ];

    eiCutoffRows.forEach((row, i) => {
      const rowIdx = 18 + i;
      sheetSummary.getRow(rowIdx).height = 20;
      ["B", "C", "D", "E", "F", "G", "H"].forEach((col, idx) => {
        const cell = sheetSummary.getCell(`${col}${rowIdx}`);
        cell.value = row[idx];
        cell.font = { size: 9.5 };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = borderStyle;
        if (i === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
        if (i === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
        if (i === 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF1F2" } };
      });
    });

    // ── 4. Matriks 3x3 Distribusi Kelompok Profil (A s/d I) ──
    formatSectionHeader("B22:H22", "4. MATRIKS 3x3 DISTRIBUSI KELOMPOK PROFIL (A s/d I)");
    sheetSummary.getRow(22).height = 24;

    const groupCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0 };
    completedProfiles.forEach((p) => {
      if (p.profileGroup && groupCounts[p.profileGroup] !== undefined) {
        groupCounts[p.profileGroup]++;
      }
    });

    const matrixHeaderRow = sheetSummary.getRow(23);
    matrixHeaderRow.height = 22;
    sheetSummary.getCell("B23").value = "Kategori LA / EI";
    sheetSummary.getCell("B23").font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
    sheetSummary.getCell("B23").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    sheetSummary.getCell("B23").alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getCell("B23").border = borderStyle;

    sheetSummary.mergeCells("C23:D23");
    sheetSummary.getCell("C23").value = "EI Tinggi (T)";
    sheetSummary.getCell("C23").font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
    sheetSummary.getCell("C23").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
    sheetSummary.getCell("C23").alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getCell("C23").border = borderStyle;
    sheetSummary.getCell("D23").border = borderStyle;

    sheetSummary.mergeCells("E23:F23");
    sheetSummary.getCell("E23").value = "EI Sedang (S)";
    sheetSummary.getCell("E23").font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
    sheetSummary.getCell("E23").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3730A3" } };
    sheetSummary.getCell("E23").alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getCell("E23").border = borderStyle;
    sheetSummary.getCell("F23").border = borderStyle;

    sheetSummary.mergeCells("G23:H23");
    sheetSummary.getCell("G23").value = "EI Rendah (R)";
    sheetSummary.getCell("G23").font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
    sheetSummary.getCell("G23").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
    sheetSummary.getCell("G23").alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getCell("G23").border = borderStyle;
    sheetSummary.getCell("H23").border = borderStyle;

    const matrixRows = [
      { laLabel: "LA Tinggi (T)", g1: "A", g2: "B", g3: "C" },
      { laLabel: "LA Sedang (S)", g1: "D", g2: "E", g3: "F" },
      { laLabel: "LA Rendah (R)", g1: "G", g2: "H", g3: "I" },
    ];

    matrixRows.forEach((mRow, i) => {
      const rowIdx = 24 + i;
      sheetSummary.getRow(rowIdx).height = 24;

      const laCell = sheetSummary.getCell(`B${rowIdx}`);
      laCell.value = mRow.laLabel;
      laCell.font = { bold: true, size: 9.5 };
      laCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      laCell.alignment = { vertical: "middle", horizontal: "center" };
      laCell.border = borderStyle;

      const renderCell = (startCol: string, endCol: string, grp: string) => {
        sheetSummary.mergeCells(`${startCol}${rowIdx}:${endCol}${rowIdx}`);
        const c = sheetSummary.getCell(`${startCol}${rowIdx}`);
        const cnt = groupCounts[grp] || 0;
        const pct = totalCompleted > 0 ? ((cnt / totalCompleted) * 100).toFixed(1) : "0.0";
        c.value = `Kelompok ${grp} (${cnt} org / ${pct}%)`;
        c.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
        c.alignment = { vertical: "middle", horizontal: "center" };
        c.border = borderStyle;
        sheetSummary.getCell(`${endCol}${rowIdx}`).border = borderStyle;
      };

      renderCell("C", "D", mRow.g1);
      renderCell("E", "F", mRow.g2);
      renderCell("G", "H", mRow.g3);
    });

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

    // Filter HANYA responden yang telah mengisi dan menyelesaikan kuesioner
    const completedRespondents = allRespondents.filter((u) => profileMap.get(u.id)?.isCompleted);

    if (completedRespondents.length === 0) {
      return NextResponse.json(
        { error: "Belum ada responden yang mengisi dan menyelesaikan kuesioner untuk diekspor." },
        { status: 404 }
      );
    }

    // Urutkan responden tetap berurutan dari responden1 sampai 90 (natural order)
    let sortedRespondents = [...completedRespondents].sort((a, b) => {
      const numA = parseInt(a.nama.replace(/\D/g, ""), 10);
      const numB = parseInt(b.nama.replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.id - b.id;
    });

    // Filter jika userId spesifik diminta (Ekspor per Responden)
    if (targetUserId) {
      sortedRespondents = sortedRespondents.filter((u) => u.id === targetUserId);
      if (sortedRespondents.length === 0) {
        return NextResponse.json(
          { error: "Responden tersebut belum menyelesaikan pengisian kuesioner atau tidak ditemukan." },
          { status: 404 }
        );
      }
    }

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
