import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, respondentBiodata } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth-server";

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

    // Aggregates
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
    const ageGroups: Record<string, number> = { "< 20": 0, "20 - 21": 0, "22 - 23": 0, "> 23": 0 };
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

    const calcPct = (cnt: number) =>
      filledCount > 0 ? `${((cnt / filledCount) * 100).toFixed(1)}%` : "0.0%";

    const avgAge =
      usiaList.length > 0
        ? (usiaList.reduce((acc, curr) => acc + curr, 0) / usiaList.length).toFixed(1)
        : "—";

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

    sheetSummary.columns = [
      { width: 4 },  // A
      { width: 28 }, // B
      { width: 14 }, // C
      { width: 16 }, // D
      { width: 28 }, // E
      { width: 14 }, // F
      { width: 16 }, // G
    ];

    // Banner
    sheetSummary.mergeCells("B2:G2");
    const titleCell = sheetSummary.getCell("B2");
    titleCell.value = "LAPORAN REKAPITULASI BIODATA & PROFIL DEMOGRAFI RESPONDEN";
    titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheetSummary.getRow(2).height = 32;

    sheetSummary.mergeCells("B3:G3");
    const subTitle = sheetSummary.getCell("B3");
    subTitle.value = `Tanggal Ekspor: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })} | Sumber: 8 Butir Instrumen Awal Responden`;
    subTitle.font = { italic: true, size: 9.5, color: { argb: "FF64748B" } };
    subTitle.alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getRow(3).height = 20;

    // Overview KPIs
    const formatSection = (cellRef: string, title: string) => {
      sheetSummary.mergeCells(cellRef);
      const c = sheetSummary.getCell(cellRef.split(":")[0]);
      c.value = title;
      c.font = { bold: true, size: 10.5, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      c.alignment = { vertical: "middle", indent: 1 };
    };

    formatSection("B5:G5", "1. STATUS PARTISIPASI & PENGISIAN BIODATA");
    sheetSummary.getRow(5).height = 22;

    const kpiRows = [
      ["Total Responden Terdaftar", totalRegistered, "Responden Sudah Mengisi", `${filledCount} (${completionRate}%)`],
      ["Responden Belum Mengisi", pendingCount, "Rata-rata Usia Responden", `${avgAge} Tahun`],
    ];

    kpiRows.forEach((r, idx) => {
      const rowIdx = 6 + idx;
      sheetSummary.getRow(rowIdx).height = 20;
      sheetSummary.getCell(`B${rowIdx}`).value = r[0];
      sheetSummary.getCell(`B${rowIdx}`).font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      sheetSummary.getCell(`B${rowIdx}`).border = borderStyle;

      sheetSummary.mergeCells(`C${rowIdx}:D${rowIdx}`);
      const val1 = sheetSummary.getCell(`C${rowIdx}`);
      val1.value = r[1];
      val1.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
      val1.alignment = { horizontal: "center" };
      val1.border = borderStyle;
      sheetSummary.getCell(`D${rowIdx}`).border = borderStyle;

      sheetSummary.getCell(`E${rowIdx}`).value = r[2];
      sheetSummary.getCell(`E${rowIdx}`).font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      sheetSummary.getCell(`E${rowIdx}`).border = borderStyle;

      sheetSummary.mergeCells(`F${rowIdx}:G${rowIdx}`);
      const val2 = sheetSummary.getCell(`F${rowIdx}`);
      val2.value = r[3];
      val2.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
      val2.alignment = { horizontal: "center" };
      val2.border = borderStyle;
      sheetSummary.getCell(`G${rowIdx}`).border = borderStyle;
    });

    // Helper to render 2-column breakdown tables
    const renderTableBlock = (
      startRow: number,
      colStart: string,
      colEnd: string,
      title: string,
      headerBg: string,
      data: Array<[string, number, string]>
    ) => {
      // Header Section
      sheetSummary.mergeCells(`${colStart}${startRow}:${colEnd}${startRow}`);
      const h = sheetSummary.getCell(`${colStart}${startRow}`);
      h.value = title;
      h.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
      h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerBg } };
      h.alignment = { vertical: "middle", indent: 1 };
      sheetSummary.getRow(startRow).height = 22;

      // Subheader
      const subRow = startRow + 1;
      sheetSummary.getRow(subRow).height = 18;
      const cols = colStart === "B" ? ["B", "C", "D"] : ["E", "F", "G"];
      const subLabels = ["Kategori / Opsi", "Frekuensi", "Persentase"];

      cols.forEach((col, i) => {
        const c = sheetSummary.getCell(`${col}${subRow}`);
        c.value = subLabels[i];
        c.font = { bold: true, size: 9, color: { argb: "FF334155" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center" };
        c.border = borderStyle;
      });

      // Data Rows
      data.forEach((d, i) => {
        const rIdx = subRow + 1 + i;
        sheetSummary.getRow(rIdx).height = 19;
        cols.forEach((col, cIdx) => {
          const c = sheetSummary.getCell(`${col}${rIdx}`);
          c.value = d[cIdx];
          c.font = { size: 9.5, bold: cIdx > 0 };
          c.alignment = { vertical: "middle", horizontal: cIdx === 0 ? "left" : "center" };
          c.border = borderStyle;
        });
      });
    };

    // Row 9: Left (Jenis Kelamin) & Right (Pernah Investasi Saham)
    renderTableBlock(9, "B", "D", "2.1 Jenis Kelamin", "FF0369A1", [
      ["Laki-laki", countLaki, calcPct(countLaki)],
      ["Perempuan", countPerempuan, calcPct(countPerempuan)],
    ]);

    renderTableBlock(9, "E", "G", "2.2 Pengalaman Investasi Saham", "FF0F766E", [
      ["Pernah (Ya)", countSahamYa, calcPct(countSahamYa)],
      ["Belum Pernah (Tidak)", countSahamTidak, calcPct(countSahamTidak)],
    ]);

    // Row 14: Left (Pelatihan Investasi) & Right (Jurusan SMA)
    renderTableBlock(14, "B", "D", "2.3 Pelatihan Keuangan / Investasi", "FF4338CA", [
      ["Pernah Pelatihan (Ya)", countPelatihanYa, calcPct(countPelatihanYa)],
      ["Belum Pelatihan (Tidak)", countPelatihanTidak, calcPct(countPelatihanTidak)],
    ]);

    renderTableBlock(14, "E", "G", "2.4 Jurusan Sewaktu SMA", "FF4F46E5", [
      ["IPA", countSmaIpa, calcPct(countSmaIpa)],
      ["IPS", countSmaIps, calcPct(countSmaIps)],
      ["Bahasa / Lain-lain", countSmaBahasa, calcPct(countSmaBahasa)],
    ]);

    // Row 20: Left (Sumber Penghasilan) & Right (Distribusi Usia)
    renderTableBlock(20, "B", "D", "2.5 Sumber Penghasilan Utama", "FF0284C7", [
      ["Orang tua", countOrtu, calcPct(countOrtu)],
      ["Beasiswa", countBeasiswa, calcPct(countBeasiswa)],
      ["Pekerjaan sampingan", countSideJob, calcPct(countSideJob)],
      ["Lainnya", countLainnya, calcPct(countLainnya)],
    ]);

    renderTableBlock(20, "E", "G", "2.6 Distribusi Usia Responden", "FF0D9488", [
      ["< 20 Tahun", ageGroups["< 20"], calcPct(ageGroups["< 20"])],
      ["20 - 21 Tahun", ageGroups["20 - 21"], calcPct(ageGroups["20 - 21"])],
      ["22 - 23 Tahun", ageGroups["22 - 23"], calcPct(ageGroups["22 - 23"])],
      ["> 23 Tahun", ageGroups["> 23"], calcPct(ageGroups["> 23"])],
    ]);

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
      { header: "Jenis Kelamin", key: "jk", width: 14 },
      { header: "Usia (Thn)", key: "usia", width: 12 },
      { header: "Program Studi / Jurusan", key: "prodi", width: 28 },
      { header: "Semester", key: "semester", width: 12 },
      { header: "Pernah Saham", key: "saham", width: 15 },
      { header: "Pelatihan Keuangan", key: "pelatihan", width: 18 },
      { header: "Sumber Penghasilan Utama", key: "sumber", width: 24 },
      { header: "Rincian Sumber Lainnya", key: "sumberLain", width: 24 },
      { header: "Jurusan SMA", key: "sma", width: 16 },
      { header: "Waktu Submit (WIB)", key: "createdAt", width: 22 },
    ];

    const hRow2 = sheetData.getRow(1);
    hRow2.height = 28;
    hRow2.eachCell((cell, colNum) => {
      let bg = "FF1E293B"; // Slate
      if (colNum >= 5 && colNum <= 8) bg = "FF0369A1"; // Sky (Personal)
      if (colNum >= 9 && colNum <= 10) bg = "FF0F766E"; // Teal (Finance exp)
      if (colNum >= 11 && colNum <= 13) bg = "FF4338CA"; // Indigo (Income & SMA)

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    const filledRespondents = allRespondents
      .filter((u) => biodataMap.has(u.id))
      .sort((a, b) => {
        const numA = parseInt(a.nama.replace(/\D/g, ""), 10);
        const numB = parseInt(b.nama.replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.id - b.id;
      });

    filledRespondents.forEach((u, idx) => {
      const b = biodataMap.get(u.id)!;

      const row = sheetData.addRow({
        no: idx + 1,
        userId: u.id,
        nama: u.nama,
        status: "Lengkap",
        jk: b.jenisKelamin || "—",
        usia: b.usia ? `${b.usia}` : "—",
        prodi: b.programStudi || "—",
        semester: b.semester ? `Sem ${b.semester}` : "—",
        saham: b.pernahInvestasiSaham || "—",
        pelatihan: b.pernahPelatihanInvestasi || "—",
        sumber: b.sumberPenghasilan || "—",
        sumberLain: b.sumberPenghasilanLainnya || "—",
        sma: b.jurusanSma || "—",
        createdAt: b.createdAt ? new Date(b.createdAt).toLocaleString("id-ID") : "—",
      });

      row.height = 20;
      row.eachCell((cell, colNum) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };
        if (colNum !== 3 && colNum !== 7 && colNum !== 11 && colNum !== 12) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }

        if (colNum === 4) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          cell.font = { bold: true, color: { argb: "FF166534" } };
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
