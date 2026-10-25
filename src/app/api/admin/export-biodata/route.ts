import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, respondentBiodata } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import ExcelJS from "exceljs";
import sharp from "sharp";
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

// ── Reusable SVG Circular Pie Chart Generator (Sesuai Dashboard Admin) ──
function generateCircularPieSvg({
  questionNumber,
  title,
  badgeText,
  slices,
  total,
}: {
  questionNumber: number;
  title: string;
  badgeText: string;
  slices: PieSlice[];
  total: number;
}): string {
  const width = 460;
  const height = 215;
  const cx = 110;
  const cy = 116;
  const radius = 74;

  const activeSlices = slices.filter((s) => s.count > 0);
  const totalCount = activeSlices.reduce((a, b) => a + b.count, 0) || 1;

  let currentAngle = -90; // Mulai dari arah jam 12 (-90 derajat)

  const slicePaths = activeSlices.map((s) => {
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

    // Posisi teks persentase di dalam irisan
    const labelRadius = radius * 0.65;
    const lx = cx + labelRadius * Math.cos(midRad);
    const ly = cy + labelRadius * Math.sin(midRad);

    const showText = s.percentage >= 7;
    const textSvg = showText
      ? `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="Arial, sans-serif" font-weight="bold" font-size="10.5">${s.percentage}%</text>`
      : "";

    return pathData + textSvg;
  });

  // Komponen Legend (keterangan warna, label, jumlah dan persentase)
  const legendX = 225;
  const legendStartY = 64;
  const maxLegendItems = 6;
  const displaySlices = slices.slice(0, maxLegendItems);
  const legendSpacing = displaySlices.length > 4 ? 22 : 26;

  const legendItems = displaySlices.map((s, idx) => {
    const y = legendStartY + idx * legendSpacing;
    const pct = totalCount > 0 ? ((s.count / totalCount) * 100).toFixed(1) : "0.0";
    const truncatedLabel = s.label.length > 17 ? s.label.slice(0, 16) + "…" : s.label;
    return `
      <g>
        <circle cx="${legendX}" cy="${y}" r="5" fill="${s.color}" />
        <text x="${legendX + 12}" y="${y + 4}" font-family="Arial, sans-serif" font-size="10.5" font-weight="600" fill="#1e293b">${escapeXml(truncatedLabel)}</text>
        <text x="${width - 20}" y="${y + 4}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="end" fill="#64748b">${s.count} (${pct}%)</text>
      </g>
    `;
  });

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background Card -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
      
      <!-- Card Header -->
      <g transform="translate(14, 12)">
        <rect x="0" y="0" width="22" height="22" rx="5" fill="#f0f9ff" stroke="#bae6fd" stroke-width="1" />
        <text x="11" y="15.5" font-family="Arial, monospace, sans-serif" font-size="10.5" font-weight="bold" fill="#0284c7" text-anchor="middle">${questionNumber}</text>
        <text x="28" y="13" font-family="Arial, sans-serif" font-size="11.5" font-weight="bold" fill="#0f172a">${escapeXml(title)}</text>
        <text x="28" y="25" font-family="Arial, sans-serif" font-size="9" fill="#64748b">${escapeXml(badgeText)}</text>
      </g>
      <line x1="14" y1="44" x2="${width - 14}" y2="44" stroke="#f1f5f9" stroke-width="1.5" />

      <!-- Pie Chart Slices -->
      <g id="pie-slices">
        ${slicePaths.join("\n")}
      </g>

      <!-- Center Hole (Donut Ring Aesthetic) -->
      <circle cx="${cx}" cy="${cy}" r="22" fill="#ffffff" />
      <text x="${cx}" y="${cy + 4}" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#64748b">${totalCount}</text>

      <!-- Legend Items -->
      <g id="legend">
        ${legendItems.join("\n")}
      </g>
    </svg>
  `;
}

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    // 1. Fetch all respondents and biodata
    const [allRespondents, allBiodata] = await Promise.all([
      db
        .select({
          id: users.id,
          nama: users.nama,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.role, "responden"))
        .orderBy(asc(users.id)),
      db.select().from(respondentBiodata),
    ]);

    const biodataMap = new Map(allBiodata.map((b) => [b.userId, b]));
    const totalRegistered = allRespondents.length;
    const filledCount = allBiodata.length;
    const pendingCount = Math.max(0, totalRegistered - filledCount);
    const completionRate =
      totalRegistered > 0 ? ((filledCount / totalRegistered) * 100).toFixed(1) : "0.0";

    if (filledCount === 0) {
      return NextResponse.json(
        { error: "Belum ada responden yang mengisi kuesioner biodata untuk diekspor." },
        { status: 404 }
      );
    }

    // Sort respondents for Sheet 2
    const filledRespondents = allRespondents
      .filter((u) => biodataMap.has(u.id))
      .sort((a, b) => {
        const numA = parseInt(a.nama.replace(/\D/g, ""), 10);
        const numB = parseInt(b.nama.replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.id - b.id;
      });

    const firstDataRow = 2;
    const lastDataRow = 1 + filledRespondents.length;

    // Aggregates for precalculating values
    let countLaki = 0;
    let countPerempuan = 0;
    let countSahamYa = 0;
    let countSahamTidak = 0;
    let countPelatihanYa = 0;
    let countPelatihanTidak = 0;
    let countSmaIpa = 0;
    let countSmaIps = 0;
    let countSmaBahasa = 0;
    let countOrtu = 0;
    let countBeasiswa = 0;
    let countSideJob = 0;
    let countLainnya = 0;

    const usiaList: number[] = [];
    const ageGroups: Record<string, number> = {
      "< 20": 0,
      "20 - 21": 0,
      "22 - 23": 0,
      "> 23": 0,
    };
    const prodiMap: Record<string, number> = {};
    const semesterMap: Record<number, number> = {};

    allBiodata.forEach((b) => {
      if (b.jenisKelamin === "Laki-laki") countLaki++;
      else if (b.jenisKelamin === "Perempuan") countPerempuan++;

      if (b.pernahInvestasiSaham === "Ya") countSahamYa++;
      else if (b.pernahInvestasiSaham === "Tidak") countSahamTidak++;

      if (b.pernahPelatihanInvestasi === "Ya") countPelatihanYa++;
      else if (b.pernahPelatihanInvestasi === "Tidak") countPelatihanTidak++;

      if (b.jurusanSma === "IPA") countSmaIpa++;
      else if (b.jurusanSma === "IPS") countSmaIps++;
      else countSmaBahasa++;

      if (b.sumberPenghasilan === "Orang tua") countOrtu++;
      else if (b.sumberPenghasilan === "Beasiswa") countBeasiswa++;
      else if (b.sumberPenghasilan === "Pekerjaan sampingan") countSideJob++;
      else countLainnya++;

      if (typeof b.usia === "number") {
        usiaList.push(b.usia);
        if (b.usia < 20) ageGroups["< 20"]++;
        else if (b.usia <= 21) ageGroups["20 - 21"]++;
        else if (b.usia <= 23) ageGroups["22 - 23"]++;
        else ageGroups["> 23"]++;
      }

      if (typeof b.semester === "number") {
        semesterMap[b.semester] = (semesterMap[b.semester] || 0) + 1;
      }

      if (b.programStudi) {
        const cleaned = b.programStudi.trim();
        prodiMap[cleaned] = (prodiMap[cleaned] || 0) + 1;
      }
    });

    const avgAge =
      usiaList.length > 0
        ? (usiaList.reduce((acc, curr) => acc + curr, 0) / usiaList.length).toFixed(1)
        : "21.0";

    const calcPct = (cnt: number) =>
      filledCount > 0 ? Number(((cnt / filledCount) * 100).toFixed(1)) : 0;

    // ── Prepare Slices identical to Admin Dashboard ──
    const slicesJenisKelamin: PieSlice[] = [
      { label: "Laki-laki", count: countLaki, percentage: calcPct(countLaki), color: "#2563EB" },
      { label: "Perempuan", count: countPerempuan, percentage: calcPct(countPerempuan), color: "#DB2777" },
    ];

    const slicesSaham: PieSlice[] = [
      { label: "Pernah (Ya)", count: countSahamYa, percentage: calcPct(countSahamYa), color: "#16A34A" },
      { label: "Belum (Tidak)", count: countSahamTidak, percentage: calcPct(countSahamTidak), color: "#DC2626" },
    ];

    const slicesPelatihan: PieSlice[] = [
      { label: "Pernah (Ya)", count: countPelatihanYa, percentage: calcPct(countPelatihanYa), color: "#2563EB" },
      { label: "Belum (Tidak)", count: countPelatihanTidak, percentage: calcPct(countPelatihanTidak), color: "#F97316" },
    ];

    const slicesSma: PieSlice[] = [
      { label: "IPA", count: countSmaIpa, percentage: calcPct(countSmaIpa), color: "#2563EB" },
      { label: "IPS", count: countSmaIps, percentage: calcPct(countSmaIps), color: "#EAB308" },
      { label: "Bahasa / Lainnya", count: countSmaBahasa, percentage: calcPct(countSmaBahasa), color: "#16A34A" },
    ];

    const slicesSumber: PieSlice[] = [
      { label: "Orang tua", count: countOrtu, percentage: calcPct(countOrtu), color: "#16A34A" },
      { label: "Pekerjaan sampingan", count: countSideJob, percentage: calcPct(countSideJob), color: "#2563EB" },
      { label: "Beasiswa", count: countBeasiswa, percentage: calcPct(countBeasiswa), color: "#EAB308" },
      { label: "Lainnya", count: countLainnya, percentage: calcPct(countLainnya), color: "#9333EA" },
    ];

    const ageColors = ["#0D9488", "#2563EB", "#F97316", "#DC2626"];
    const slicesUsia: PieSlice[] = Object.entries(ageGroups).map(([group, count], idx) => ({
      label: `${group} Thn`,
      count,
      percentage: calcPct(count),
      color: ageColors[idx % ageColors.length],
    }));

    const semColors = [
      "#2563EB",
      "#0D9488",
      "#16A34A",
      "#EAB308",
      "#F97316",
      "#DC2626",
      "#9333EA",
      "#DB2777",
    ];
    const sortedSemesters = Object.keys(semesterMap)
      .map(Number)
      .sort((a, b) => a - b);
    const slicesSemester: PieSlice[] = sortedSemesters.map((sem, idx) => ({
      label: `Semester ${sem}`,
      count: semesterMap[sem] || 0,
      percentage: calcPct(semesterMap[sem] || 0),
      color: semColors[idx % semColors.length],
    }));

    const prodiColors = ["#16A34A", "#2563EB", "#EAB308", "#F97316", "#9333EA", "#64748B"];
    const sortedProdis = Object.entries(prodiMap).sort((a, b) => b[1] - a[1]);
    const slicesProdi: PieSlice[] = sortedProdis.map(([prodi, cnt], idx) => ({
      label: prodi,
      count: cnt,
      percentage: calcPct(cnt),
      color: prodiColors[idx % prodiColors.length],
    }));

    // Generate PNG buffers for all 8 charts in parallel
    const [
      pngChart1,
      pngChart2,
      pngChart3,
      pngChart4,
      pngChart5,
      pngChart6,
      pngChart7,
      pngChart8,
    ] = await Promise.all([
      sharp(
        Buffer.from(
          generateCircularPieSvg({
            questionNumber: 1,
            title: "Jenis Kelamin Responden",
            badgeText: "Laki-laki vs Perempuan",
            slices: slicesJenisKelamin,
            total: filledCount,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            questionNumber: 2,
            title: "Pengalaman Investasi di Pasar Saham",
            badgeText: "Pernah vs Belum Pernah",
            slices: slicesSaham,
            total: filledCount,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            questionNumber: 3,
            title: "Pelatihan / Mata Kuliah Keuangan",
            badgeText: "Pelatihan atau Kuliah Investasi Pribadi",
            slices: slicesPelatihan,
            total: filledCount,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            questionNumber: 4,
            title: "Jurusan Sewaktu SMA",
            badgeText: "Peminatan IPA, IPS, atau Bahasa",
            slices: slicesSma,
            total: filledCount,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            questionNumber: 5,
            title: "Sumber Penghasilan Utama",
            badgeText: "Orang Tua, Beasiswa, Side-Job, Lainnya",
            slices: slicesSumber,
            total: filledCount,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            questionNumber: 6,
            title: "Distribusi Kelompok Usia",
            badgeText: `Rerata: ${avgAge} Tahun`,
            slices: slicesUsia,
            total: filledCount,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            questionNumber: 7,
            title: "Distribusi Semester Perkuliahan",
            badgeText: "Tingkat Perkuliahan Saat Ini",
            slices: slicesSemester,
            total: filledCount,
          })
        )
      )
        .png()
        .toBuffer(),

      sharp(
        Buffer.from(
          generateCircularPieSvg({
            questionNumber: 8,
            title: "Sebaran Program Studi / Jurusan Kuliah",
            badgeText: `Top Program Studi (${slicesProdi.length} Terdata)`,
            slices: slicesProdi,
            total: filledCount,
          })
        )
      )
        .png()
        .toBuffer(),
    ]);

    // 2. Setup Excel Workbook
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
    // ── SHEET 1: Ringkasan & Diagram Demografi ──
    // ─────────────────────────────────────────────────────────────
    const sheetSummary = workbook.addWorksheet("Ringkasan Demografi", {
      views: [{ showGridLines: true }],
    });

    // Column Configuration:
    // A: Margin | B: Kategori | C: Frekuensi | D: Persentase | E: Spacer | F..J: Chart Image Area
    sheetSummary.columns = [
      { width: 4 },  // A Margin
      { width: 26 }, // B Kategori / Opsi
      { width: 14 }, // C Frekuensi
      { width: 14 }, // D Persentase
      { width: 4 },  // E Spacer
      { width: 18 }, // F Area Diagram
      { width: 18 }, // G Area Diagram
      { width: 18 }, // H Area Diagram
      { width: 18 }, // I Area Diagram
      { width: 18 }, // J Area Diagram
    ];

    // Banner Title
    sheetSummary.mergeCells("B2:J2");
    const titleCell = sheetSummary.getCell("B2");
    titleCell.value = "LAPORAN REKAPITULASI BIODATA & DIAGRAM LINGKARAN DEMOGRAFI RESPONDEN";
    titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheetSummary.getRow(2).height = 32;

    sheetSummary.mergeCells("B3:J3");
    const subTitle = sheetSummary.getCell("B3");
    subTitle.value = `Tanggal Ekspor: ${new Date().toLocaleDateString("id-ID", {
      dateStyle: "full",
    })} | Sumber: Sheet 'Data Responden Lengkap' (8 Butir Instrumen Riset)`;
    subTitle.font = { italic: true, size: 9.5, color: { argb: "FF64748B" } };
    subTitle.alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getRow(3).height = 20;

    sheetSummary.mergeCells("B4:J4");
    const subNotice = sheetSummary.getCell("B4");
    subNotice.value =
      "⚡ Seluruh frekuensi & persentase tabel dihitung secara dinamis via RUMUS EXCEL (=COUNTIF, =AVERAGE, =SUM) bersanding dengan Diagram Lingkaran Visual Dashboard.";
    subNotice.font = { bold: true, size: 9, color: { argb: "FF0369A1" } };
    subNotice.alignment = { vertical: "middle", horizontal: "center" };
    subNotice.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F9FF" } };
    sheetSummary.getRow(4).height = 20;

    // ── SECTION 1: Status Partisipasi & KPI ──
    sheetSummary.mergeCells("B6:J6");
    const sec1 = sheetSummary.getCell("B6");
    sec1.value = "1. STATUS PARTISIPASI & PENGISIAN BIODATA";
    sec1.font = { bold: true, size: 10.5, color: { argb: "FFFFFFFF" } };
    sec1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    sec1.alignment = { vertical: "middle", indent: 1 };
    sheetSummary.getRow(6).height = 23;

    // Row 7: Total Terdaftar & Responden Sudah Mengisi
    sheetSummary.getRow(7).height = 22;
    sheetSummary.getCell("B7").value = "Total Responden Terdaftar";
    sheetSummary.getCell("B7").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("B7").border = borderStyle;

    sheetSummary.mergeCells("C7:D7");
    const valTotalReg = sheetSummary.getCell("C7");
    valTotalReg.value = {
      formula: `COUNTA('Data Responden Lengkap'!$B$${firstDataRow}:$B$${lastDataRow})`,
      result: totalRegistered,
    };
    valTotalReg.numFmt = "#,##0";
    valTotalReg.font = { bold: true, size: 10.5, color: { argb: "FF0F172A" } };
    valTotalReg.alignment = { horizontal: "center", vertical: "middle" };
    valTotalReg.border = borderStyle;
    sheetSummary.getCell("D7").border = borderStyle;

    sheetSummary.getCell("F7").value = "Responden Sudah Mengisi";
    sheetSummary.getCell("F7").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("F7").border = borderStyle;

    sheetSummary.mergeCells("G7:H7");
    const valFilled = sheetSummary.getCell("G7");
    valFilled.value = {
      formula: `COUNTIF('Data Responden Lengkap'!$D$${firstDataRow}:$D$${lastDataRow}, "Lengkap")`,
      result: filledCount,
    };
    valFilled.numFmt = "#,##0";
    valFilled.font = { bold: true, size: 10.5, color: { argb: "FF047857" } };
    valFilled.alignment = { horizontal: "center", vertical: "middle" };
    valFilled.border = borderStyle;
    sheetSummary.getCell("H7").border = borderStyle;

    sheetSummary.mergeCells("I7:J7");
    const valRate = sheetSummary.getCell("I7");
    valRate.value = {
      formula: `'Ringkasan Demografi'!G7 / 'Ringkasan Demografi'!C7`,
      result: totalRegistered > 0 ? filledCount / totalRegistered : 0,
    };
    valRate.numFmt = "0.0%";
    valRate.font = { bold: true, size: 10, color: { argb: "FF047857" } };
    valRate.alignment = { vertical: "middle", horizontal: "center" };
    valRate.border = borderStyle;
    sheetSummary.getCell("J7").border = borderStyle;

    // Row 8: Belum Mengisi & Rata-rata Usia
    sheetSummary.getRow(8).height = 22;
    sheetSummary.getCell("B8").value = "Responden Belum Mengisi";
    sheetSummary.getCell("B8").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("B8").border = borderStyle;

    sheetSummary.mergeCells("C8:D8");
    const valPending = sheetSummary.getCell("C8");
    valPending.value = {
      formula: `'Ringkasan Demografi'!C7 - 'Ringkasan Demografi'!G7`,
      result: pendingCount,
    };
    valPending.numFmt = "#,##0";
    valPending.font = { bold: true, size: 10, color: { argb: "FFB91C1C" } };
    valPending.alignment = { horizontal: "center", vertical: "middle" };
    valPending.border = borderStyle;
    sheetSummary.getCell("D8").border = borderStyle;

    sheetSummary.getCell("F8").value = "Rata-rata Usia Responden";
    sheetSummary.getCell("F8").font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
    sheetSummary.getCell("F8").border = borderStyle;

    sheetSummary.mergeCells("G8:H8");
    const valAvgAge = sheetSummary.getCell("G8");
    valAvgAge.value = {
      formula: `AVERAGE('Data Responden Lengkap'!$F$${firstDataRow}:$F$${lastDataRow})`,
      result: Number(avgAge),
    };
    valAvgAge.numFmt = '0.0 "Tahun"';
    valAvgAge.font = { bold: true, size: 10.5, color: { argb: "FF0F172A" } };
    valAvgAge.alignment = { horizontal: "center", vertical: "middle" };
    valAvgAge.border = borderStyle;
    sheetSummary.getCell("H8").border = borderStyle;

    sheetSummary.mergeCells("I8:J8");
    const valColFNote = sheetSummary.getCell("I8");
    valColFNote.value = "Kolom F Data Responden";
    valColFNote.font = { italic: true, size: 8.5, color: { argb: "FF64748B" } };
    valColFNote.alignment = { vertical: "middle", horizontal: "center" };
    valColFNote.border = borderStyle;
    sheetSummary.getCell("J8").border = borderStyle;

    // ─────────────────────────────────────────────────────────────
    // Helper to render Question Block (Table with Formulas on Left + Circular Pie Chart on Right)
    // ─────────────────────────────────────────────────────────────
    type QuestionRowItem = {
      label: string;
      preCount: number;
      formulaFreq: string;
    };

    const renderQuestionPair = (params: {
      startRow: number;
      minRows: number;
      title: string;
      headerBg: string;
      items: QuestionRowItem[];
      chartBuffer: Buffer;
    }): number => {
      const { startRow, minRows, title, headerBg, items, chartBuffer } = params;

      // 1. Table Header (B..D)
      sheetSummary.mergeCells(`B${startRow}:D${startRow}`);
      const hCell = sheetSummary.getCell(`B${startRow}`);
      hCell.value = title;
      hCell.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
      hCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBg } };
      hCell.alignment = { vertical: "middle", indent: 1 };
      sheetSummary.getRow(startRow).height = 23;

      // 2. Table Subheader
      const subRow = startRow + 1;
      sheetSummary.getRow(subRow).height = 19;
      const subHeaders = [
        { col: "B", text: "Kategori / Opsi", align: "left" },
        { col: "C", text: "Frekuensi", align: "center" },
        { col: "D", text: "Persentase", align: "center" },
      ];

      subHeaders.forEach((sh) => {
        const c = sheetSummary.getCell(`${sh.col}${subRow}`);
        c.value = sh.text;
        c.font = { bold: true, size: 9, color: { argb: "FF334155" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        c.alignment = {
          vertical: "middle",
          horizontal: sh.align as ExcelJS.Alignment["horizontal"],
          indent: sh.align === "left" ? 1 : 0,
        };
        c.border = borderStyle;
      });

      // 3. Data Rows with Excel Formulas
      const firstDataR = subRow + 1;
      items.forEach((item, idx) => {
        const rIdx = firstDataR + idx;
        sheetSummary.getRow(rIdx).height = 20;

        // Label
        const cLabel = sheetSummary.getCell(`B${rIdx}`);
        cLabel.value = item.label;
        cLabel.font = { size: 9.5, color: { argb: "FF0F172A" } };
        cLabel.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        cLabel.border = borderStyle;

        // Frekuensi (Excel Formula: =COUNTIF(...))
        const cFreq = sheetSummary.getCell(`C${rIdx}`);
        cFreq.value = {
          formula: item.formulaFreq,
          result: item.preCount,
        };
        cFreq.numFmt = "#,##0";
        cFreq.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
        cFreq.alignment = { vertical: "middle", horizontal: "center" };
        cFreq.border = borderStyle;

        // Persentase (Excel Formula: =C{row}/$G$7)
        const cPct = sheetSummary.getCell(`D${rIdx}`);
        const pctVal = filledCount > 0 ? item.preCount / filledCount : 0;
        cPct.value = {
          formula: `C${rIdx}/$G$7`,
          result: pctVal,
        };
        cPct.numFmt = "0.0%";
        cPct.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
        cPct.alignment = { vertical: "middle", horizontal: "center" };
        cPct.border = borderStyle;
      });

      // 4. Total Row with Excel Formula: =SUM(...)
      const lastDataR = firstDataR + items.length - 1;
      const totalR = lastDataR + 1;
      sheetSummary.getRow(totalR).height = 20;

      const cTotalLabel = sheetSummary.getCell(`B${totalR}`);
      cTotalLabel.value = "Total";
      cTotalLabel.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
      cTotalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cTotalLabel.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      cTotalLabel.border = borderStyle;

      const cTotalFreq = sheetSummary.getCell(`C${totalR}`);
      const sumPreCount = items.reduce((acc, curr) => acc + curr.preCount, 0);
      cTotalFreq.value = {
        formula: `SUM(C${firstDataR}:C${lastDataR})`,
        result: sumPreCount,
      };
      cTotalFreq.numFmt = "#,##0";
      cTotalFreq.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
      cTotalFreq.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cTotalFreq.alignment = { vertical: "middle", horizontal: "center" };
      cTotalFreq.border = borderStyle;

      const cTotalPct = sheetSummary.getCell(`D${totalR}`);
      cTotalPct.value = {
        formula: `SUM(D${firstDataR}:D${lastDataR})`,
        result: 1.0,
      };
      cTotalPct.numFmt = "0.0%";
      cTotalPct.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
      cTotalPct.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      cTotalPct.alignment = { vertical: "middle", horizontal: "center" };
      cTotalPct.border = borderStyle;

      // 5. Embed Circular Pie Chart Image on the Right (Column F to J)
      const imageId = workbook.addImage({
        buffer: chartBuffer as any,
        extension: "png",
      });

      sheetSummary.addImage(imageId, {
        tl: { col: 5, row: startRow - 1 }, // Column F (0-indexed col 5), Row startRow-1 (0-indexed)
        ext: { width: 460, height: 212 },
      });

      // Ensure minimum row spacing for chart height (212px ≈ 10-11 rows)
      const actualBlockRows = Math.max(minRows, items.length + 3);
      for (let r = startRow; r < startRow + actualBlockRows; r++) {
        if (!sheetSummary.getRow(r).height) {
          sheetSummary.getRow(r).height = 20;
        }
      }

      return startRow + actualBlockRows + 1; // Next start row (+1 empty separator)
    };

    // ── Render 8 Questions with Tables & Circular Pie Charts ──
    let nextRow = 11;

    // 1. Jenis Kelamin
    nextRow = renderQuestionPair({
      startRow: nextRow,
      minRows: 10,
      title: "2.1 Jenis Kelamin Responden",
      headerBg: "FF2563EB", // Blue
      items: [
        {
          label: "Laki-laki",
          preCount: countLaki,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$E$${firstDataRow}:$E$${lastDataRow}, "Laki-laki")`,
        },
        {
          label: "Perempuan",
          preCount: countPerempuan,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$E$${firstDataRow}:$E$${lastDataRow}, "Perempuan")`,
        },
      ],
      chartBuffer: pngChart1,
    });

    // 2. Pengalaman Investasi di Pasar Saham
    nextRow = renderQuestionPair({
      startRow: nextRow,
      minRows: 10,
      title: "2.2 Pengalaman Investasi di Pasar Saham",
      headerBg: "FF16A34A", // Green
      items: [
        {
          label: "Pernah (Ya)",
          preCount: countSahamYa,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$I$${firstDataRow}:$I$${lastDataRow}, "Ya")`,
        },
        {
          label: "Belum (Tidak)",
          preCount: countSahamTidak,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$I$${firstDataRow}:$I$${lastDataRow}, "Tidak")`,
        },
      ],
      chartBuffer: pngChart2,
    });

    // 3. Pelatihan Keuangan / Investasi
    nextRow = renderQuestionPair({
      startRow: nextRow,
      minRows: 10,
      title: "2.3 Pelatihan / Mata Kuliah Keuangan",
      headerBg: "FF2563EB", // Blue
      items: [
        {
          label: "Pernah (Ya)",
          preCount: countPelatihanYa,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$J$${firstDataRow}:$J$${lastDataRow}, "Ya")`,
        },
        {
          label: "Belum (Tidak)",
          preCount: countPelatihanTidak,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$J$${firstDataRow}:$J$${lastDataRow}, "Tidak")`,
        },
      ],
      chartBuffer: pngChart3,
    });

    // 4. Jurusan Sewaktu SMA
    nextRow = renderQuestionPair({
      startRow: nextRow,
      minRows: 10,
      title: "2.4 Jurusan Sewaktu SMA",
      headerBg: "FF9333EA", // Purple
      items: [
        {
          label: "IPA",
          preCount: countSmaIpa,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$M$${firstDataRow}:$M$${lastDataRow}, "IPA")`,
        },
        {
          label: "IPS",
          preCount: countSmaIps,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$M$${firstDataRow}:$M$${lastDataRow}, "IPS")`,
        },
        {
          label: "Bahasa / Lain-lain",
          preCount: countSmaBahasa,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$M$${firstDataRow}:$M$${lastDataRow}, "Bahasa/lain-lain")`,
        },
      ],
      chartBuffer: pngChart4,
    });

    // 5. Sumber Penghasilan Utama
    nextRow = renderQuestionPair({
      startRow: nextRow,
      minRows: 10,
      title: "2.5 Sumber Penghasilan Utama",
      headerBg: "FF16A34A", // Green
      items: [
        {
          label: "Orang tua",
          preCount: countOrtu,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$K$${firstDataRow}:$K$${lastDataRow}, "Orang tua")`,
        },
        {
          label: "Pekerjaan sampingan",
          preCount: countSideJob,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$K$${firstDataRow}:$K$${lastDataRow}, "Pekerjaan sampingan")`,
        },
        {
          label: "Beasiswa",
          preCount: countBeasiswa,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$K$${firstDataRow}:$K$${lastDataRow}, "Beasiswa")`,
        },
        {
          label: "Lainnya",
          preCount: countLainnya,
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$K$${firstDataRow}:$K$${lastDataRow}, "Lainnya")`,
        },
      ],
      chartBuffer: pngChart5,
    });

    // 6. Distribusi Kelompok Usia
    nextRow = renderQuestionPair({
      startRow: nextRow,
      minRows: 10,
      title: "2.6 Distribusi Kelompok Usia",
      headerBg: "FF0D9488", // Teal
      items: [
        {
          label: "< 20 Tahun",
          preCount: ageGroups["< 20"],
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$F$${firstDataRow}:$F$${lastDataRow}, "<20")`,
        },
        {
          label: "20 - 21 Tahun",
          preCount: ageGroups["20 - 21"],
          formulaFreq: `COUNTIFS('Data Responden Lengkap'!$F$${firstDataRow}:$F$${lastDataRow}, ">=20", 'Data Responden Lengkap'!$F$${firstDataRow}:$F$${lastDataRow}, "<=21")`,
        },
        {
          label: "22 - 23 Tahun",
          preCount: ageGroups["22 - 23"],
          formulaFreq: `COUNTIFS('Data Responden Lengkap'!$F$${firstDataRow}:$F$${lastDataRow}, ">=22", 'Data Responden Lengkap'!$F$${firstDataRow}:$F$${lastDataRow}, "<=23")`,
        },
        {
          label: "> 23 Tahun",
          preCount: ageGroups["> 23"],
          formulaFreq: `COUNTIF('Data Responden Lengkap'!$F$${firstDataRow}:$F$${lastDataRow}, ">23")`,
        },
      ],
      chartBuffer: pngChart6,
    });

    // 7. Distribusi Semester Perkuliahan
    const semTableItems: QuestionRowItem[] = sortedSemesters.map((sem) => ({
      label: `Semester ${sem}`,
      preCount: semesterMap[sem] || 0,
      formulaFreq: `COUNTIF('Data Responden Lengkap'!$H$${firstDataRow}:$H$${lastDataRow}, ${sem})`,
    }));

    nextRow = renderQuestionPair({
      startRow: nextRow,
      minRows: 10,
      title: "2.7 Distribusi Semester Perkuliahan",
      headerBg: "FF2563EB", // Blue
      items:
        semTableItems.length > 0
          ? semTableItems
          : [
              {
                label: "Semester 3",
                preCount: 0,
                formulaFreq: `COUNTIF('Data Responden Lengkap'!$H$${firstDataRow}:$H$${lastDataRow}, 3)`,
              },
            ],
      chartBuffer: pngChart7,
    });

    // 8. Sebaran Program Studi / Jurusan Kuliah
    const prodiTableItems: QuestionRowItem[] = sortedProdis.map(([prodi, cnt]) => ({
      label: prodi,
      preCount: cnt,
      formulaFreq: `COUNTIF('Data Responden Lengkap'!$G$${firstDataRow}:$G$${lastDataRow}, "${prodi}")`,
    }));

    nextRow = renderQuestionPair({
      startRow: nextRow,
      minRows: 10,
      title: "2.8 Sebaran Program Studi Responden",
      headerBg: "FF16A34A", // Green
      items:
        prodiTableItems.length > 0
          ? prodiTableItems
          : [
              {
                label: "Akuntansi",
                preCount: 0,
                formulaFreq: `COUNTIF('Data Responden Lengkap'!$G$${firstDataRow}:$G$${lastDataRow}, "Akuntansi")`,
              },
            ],
      chartBuffer: pngChart8,
    });

    // ── SECTION 3: Catatan & Panduan Rumus Excel ──
    const noteStartRow = nextRow + 1;
    sheetSummary.mergeCells(`B${noteStartRow}:J${noteStartRow}`);
    const noteHeader = sheetSummary.getCell(`B${noteStartRow}`);
    noteHeader.value = "3. CATATAN FORMULA & INTEGRASI DIAGRAM EXCEL";
    noteHeader.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
    noteHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    noteHeader.alignment = { vertical: "middle", indent: 1 };
    sheetSummary.getRow(noteStartRow).height = 22;

    const notes = [
      "1. Frekuensi Responden dihitung dinamis menggunakan fungsi =COUNTIF('Data Responden Lengkap'!$Col$2:$Col$N, \"Nilai\") atau =COUNTIFS() untuk rentang usia.",
      "2. Persentase dihitung dengan rumus =Frekuensi/$G$7 (merujuk ke total responden yang sudah mengisi biodata lengkap pada baris KPI).",
      "3. Diagram Lingkaran (Circular Pie Chart) di samping kanan dirender secara presisi dan terkalibrasi dengan proporsi warna & irisan persis seperti tampilan Dashboard Admin.",
      "4. Setiap perubahan, penambahan, atau revisi baris data pada sheet 'Data Responden Lengkap' akan secara otomatis memperbarui angka & persentase tabel di sheet ini.",
    ];

    notes.forEach((text, i) => {
      const r = noteStartRow + 1 + i;
      sheetSummary.mergeCells(`B${r}:J${r}`);
      const c = sheetSummary.getCell(`B${r}`);
      c.value = text;
      c.font = { size: 8.5, color: { argb: "FF475569" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      c.alignment = { vertical: "middle", indent: 1 };
      c.border = borderStyle;
      sheetSummary.getRow(r).height = 19;
    });

    // ─────────────────────────────────────────────────────────────
    // ── SHEET 2: Data Responden Lengkap ──
    // ─────────────────────────────────────────────────────────────
    const sheetData = workbook.addWorksheet("Data Responden Lengkap", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    });

    sheetData.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "User ID", key: "userId", width: 10 },
      { header: "Nama Responden", key: "nama", width: 24 },
      { header: "Status Biodata", key: "status", width: 16 },
      { header: "Jenis Kelamin", key: "jk", width: 15 },
      { header: "Usia (Thn)", key: "usia", width: 12 },
      { header: "Program Studi / Jurusan", key: "prodi", width: 28 },
      { header: "Semester", key: "semester", width: 12 },
      { header: "Pernah Saham", key: "saham", width: 16 },
      { header: "Pelatihan Keuangan", key: "pelatihan", width: 18 },
      { header: "Sumber Penghasilan Utama", key: "sumber", width: 24 },
      { header: "Rincian Sumber Lainnya", key: "sumberLain", width: 24 },
      { header: "Jurusan SMA", key: "sma", width: 16 },
      { header: "Waktu Submit (WIB)", key: "createdAt", width: 22 },
    ];

    const hRow2 = sheetData.getRow(1);
    hRow2.height = 28;
    hRow2.eachCell((cell, colNum) => {
      let bg = "FF1E293B"; // Slate (General)
      if (colNum >= 5 && colNum <= 8) bg = "FF0369A1"; // Sky (Demografi & Akademik)
      if (colNum >= 9 && colNum <= 10) bg = "FF0F766E"; // Teal (Literasi Keuangan)
      if (colNum >= 11 && colNum <= 13) bg = "FF4338CA"; // Indigo (Ekonomi & SMA)

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    filledRespondents.forEach((u, idx) => {
      const b = biodataMap.get(u.id)!;
      const isEven = idx % 2 === 1;

      const row = sheetData.addRow({
        no: idx + 1,
        userId: u.id,
        nama: u.nama,
        status: "Lengkap",
        jk: b.jenisKelamin || "—",
        usia: typeof b.usia === "number" ? b.usia : null,
        prodi: b.programStudi ? b.programStudi.trim() : "—",
        semester: typeof b.semester === "number" ? b.semester : null,
        saham: b.pernahInvestasiSaham || "—",
        pelatihan: b.pernahPelatihanInvestasi || "—",
        sumber: b.sumberPenghasilan || "—",
        sumberLain: b.sumberPenghasilanLainnya || "—",
        sma: b.jurusanSma || "—",
        createdAt: b.createdAt
          ? new Date(b.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
          : "—",
      });

      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };

        // Zebra striping background
        if (isEven && colNum !== 4) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }

        // Center align specific columns
        if (
          colNum === 1 || // No
          colNum === 2 || // User ID
          colNum === 4 || // Status
          colNum === 5 || // JK
          colNum === 6 || // Usia
          colNum === 8 || // Semester
          colNum === 9 || // Saham
          colNum === 10 || // Pelatihan
          colNum === 13 || // SMA
          colNum === 14 // Waktu
        ) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }

        // Status "Lengkap" badge in green
        if (colNum === 4) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          cell.font = { bold: true, color: { argb: "FF166534" }, size: 9 };
        }
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const safeDate = new Date().toISOString().slice(0, 10);
    const filename = `Laporan_Biodata_Responden_${safeDate}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Error exporting biodata to Excel:", error);
    return NextResponse.json(
      { error: "Gagal mengekspor data biodata responden ke Excel." },
      { status: 500 }
    );
  }
}
