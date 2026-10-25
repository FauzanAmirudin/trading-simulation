import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, simulationEvaluations } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth-server";
import {
  EVALUATION_QUESTIONS,
  EVALUATION_LIKERT_OPTIONS,
  getEvaluationOptionLabel,
} from "@/lib/evaluation-questions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const targetUserIdParam = searchParams.get("userId");
    const targetUserId = targetUserIdParam ? parseInt(targetUserIdParam, 10) : null;

    // 1. Fetch respondents & evaluations
    const [allRespondents, allEvaluations] = await Promise.all([
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
      db.select().from(simulationEvaluations),
    ]);

    const evalMap = new Map(allEvaluations.map((e) => [e.userId, e]));
    const completedRespondents = allRespondents
      .filter((u) => evalMap.has(u.id))
      .sort((a, b) => {
        const numA = parseInt(a.nama.replace(/\D/g, ""), 10);
        const numB = parseInt(b.nama.replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.id - b.id;
      });

    if (completedRespondents.length === 0) {
      return NextResponse.json(
        { error: "Belum ada responden yang mengisi kuesioner evaluasi untuk diekspor." },
        { status: 404 }
      );
    }

    // If specific target user is requested
    if (targetUserId) {
      const targetUser = allRespondents.find((u) => u.id === targetUserId);
      const targetEval = evalMap.get(targetUserId);

      if (!targetUser || !targetEval) {
        return NextResponse.json(
          { error: "Responden tersebut belum mengisi evaluasi simulasi atau tidak ditemukan." },
          { status: 404 }
        );
      }

      // ── WORKBOOK SINGLE RESPONDENT ──
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Simulasi Investasi Platform";
      workbook.created = new Date();

      const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      const sheet = workbook.addWorksheet("Evaluasi Responden", {
        views: [{ showGridLines: true }],
      });

      sheet.columns = [
        { width: 4 },  // A margin
        { width: 8 },  // B No
        { width: 48 }, // C Butir Pertanyaan
        { width: 26 }, // D Jawaban Responden
        { width: 14 }, // E Nilai Skor
      ];

      // Banner Header
      sheet.mergeCells("B2:E2");
      const title = sheet.getCell("B2");
      title.value = "LEMBAR EVALUASI SIMULASI PERDAGANGAN SAHAM (INDIVIDUAL)";
      title.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      title.alignment = { vertical: "middle", horizontal: "center" };
      sheet.getRow(2).height = 32;

      // Metadata Info Box
      const infoRows = [
        ["ID Responden", targetUser.id, "Status Pengisian", "Lengkap (Selesai)"],
        ["Nama Lengkap", targetUser.nama, "Waktu Selesai", targetEval.completedAt ? new Date(targetEval.completedAt).toLocaleString("id-ID") : "—"],
      ];

      infoRows.forEach((r, idx) => {
        const rIdx = 4 + idx;
        sheet.getRow(rIdx).height = 20;
        sheet.getCell(`B${rIdx}`).value = r[0];
        sheet.getCell(`B${rIdx}`).font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
        sheet.getCell(`B${rIdx}`).border = borderStyle;

        sheet.getCell(`C${rIdx}`).value = r[1];
        sheet.getCell(`C${rIdx}`).font = { size: 9.5, bold: true, color: { argb: "FF0F172A" } };
        sheet.getCell(`C${rIdx}`).border = borderStyle;

        sheet.getCell(`D${rIdx}`).value = r[2];
        sheet.getCell(`D${rIdx}`).font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
        sheet.getCell(`D${rIdx}`).border = borderStyle;

        sheet.getCell(`E${rIdx}`).value = r[3];
        sheet.getCell(`E${rIdx}`).font = { size: 9.5, bold: true, color: { argb: "FF166534" } };
        sheet.getCell(`E${rIdx}`).alignment = { horizontal: "center" };
        sheet.getCell(`E${rIdx}`).border = borderStyle;
      });

      // Table Header
      sheet.getRow(7).height = 24;
      const headers = ["No", "Butir Pertanyaan Evaluasi", "Tanggapan / Jawaban Responden", "Skor (1-5)"];
      ["B", "C", "D", "E"].forEach((col, idx) => {
        const c = sheet.getCell(`${col}7`);
        c.value = headers[idx];
        c.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0369A1" } }; // Sky Blue
        c.alignment = { vertical: "middle", horizontal: idx === 1 ? "left" : "center" };
        c.border = borderStyle;
      });

      // Rows for 10 Questions
      EVALUATION_QUESTIONS.forEach((q, idx) => {
        const rIdx = 8 + idx;
        sheet.getRow(rIdx).height = 22;
        const qKey = `q${q.orderNumber}` as keyof typeof targetEval;
        const score = (targetEval[qKey] as number) || 0;
        const label = getEvaluationOptionLabel(score);

        sheet.getCell(`B${rIdx}`).value = q.orderNumber;
        sheet.getCell(`B${rIdx}`).alignment = { vertical: "middle", horizontal: "center" };
        sheet.getCell(`B${rIdx}`).font = { bold: true, size: 9.5 };
        sheet.getCell(`B${rIdx}`).border = borderStyle;

        sheet.getCell(`C${rIdx}`).value = q.questionText;
        sheet.getCell(`C${rIdx}`).alignment = { vertical: "middle", wrapText: true };
        sheet.getCell(`C${rIdx}`).font = { size: 9.5 };
        sheet.getCell(`C${rIdx}`).border = borderStyle;

        sheet.getCell(`D${rIdx}`).value = label;
        sheet.getCell(`D${rIdx}`).alignment = { vertical: "middle", horizontal: "center" };
        sheet.getCell(`D${rIdx}`).font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
        sheet.getCell(`D${rIdx}`).border = borderStyle;
        if (score >= 4) {
          sheet.getCell(`D${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
        } else if (score <= 2) {
          sheet.getCell(`D${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4E6" } };
        } else {
          sheet.getCell(`D${rIdx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
        }

        sheet.getCell(`E${rIdx}`).value = score;
        sheet.getCell(`E${rIdx}`).alignment = { vertical: "middle", horizontal: "center" };
        sheet.getCell(`E${rIdx}`).font = { bold: true, size: 10 };
        sheet.getCell(`E${rIdx}`).border = borderStyle;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const safeName = targetUser.nama.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Evaluasi_Responden_${targetUser.id}_${safeName}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ── WORKBOOK ALL COMPLETED RESPONDENTS ──
    // ─────────────────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Simulasi Investasi Platform";
    workbook.created = new Date();

    const borderStyle: Partial<ExcelJS.Borders> = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };

    // ── SHEET 1: Ringkasan & Sebaran Jawaban ──
    const sheetSummary = workbook.addWorksheet("Ringkasan Evaluasi", {
      views: [{ showGridLines: true }],
    });

    sheetSummary.columns = [
      { width: 4 },  // A margin
      { width: 6 },  // B No
      { width: 46 }, // C Butir Pertanyaan
      { width: 14 }, // D Rata-rata Skor
      { width: 14 }, // E Sangat Setuju
      { width: 14 }, // F Setuju
      { width: 14 }, // G Netral
      { width: 14 }, // H Tidak Setuju
      { width: 15 }, // I Sangat Tdk Setuju
    ];

    sheetSummary.mergeCells("B2:I2");
    const titleSummary = sheetSummary.getCell("B2");
    titleSummary.value = "LAPORAN HASIL EVALUASI SIMULASI PERDAGANGAN SAHAM";
    titleSummary.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    titleSummary.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    titleSummary.alignment = { vertical: "middle", horizontal: "center" };
    sheetSummary.getRow(2).height = 32;

    // Summary info
    const summaryRows = [
      ["Total Responden Mengisi Evaluasi (Diekspor)", completedRespondents.length, "Total Butir Pertanyaan", "10 Butir Pertanyaan Likert (1-5)"],
      ["Total Akun Responden Terdaftar", allRespondents.length, "Cakupan Data", "Hanya Responden yang Selesai Mengisi Evaluasi"],
    ];

    summaryRows.forEach((r, idx) => {
      const rIdx = 4 + idx;
      sheetSummary.getRow(rIdx).height = 20;
      sheetSummary.getCell(`B${rIdx}`).value = r[0];
      sheetSummary.getCell(`B${rIdx}`).font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      sheetSummary.getCell(`B${rIdx}`).border = borderStyle;

      sheetSummary.mergeCells(`C${rIdx}:D${rIdx}`);
      const c1 = sheetSummary.getCell(`C${rIdx}`);
      c1.value = r[1];
      c1.font = { size: 9.5, bold: true, color: { argb: "FF0F172A" } };
      c1.alignment = { horizontal: "center" };
      c1.border = borderStyle;
      sheetSummary.getCell(`D${rIdx}`).border = borderStyle;

      sheetSummary.mergeCells(`E${rIdx}:F${rIdx}`);
      const c2 = sheetSummary.getCell(`E${rIdx}`);
      c2.value = r[2];
      c2.font = { bold: true, size: 9.5, color: { argb: "FF334155" } };
      c2.border = borderStyle;
      sheetSummary.getCell(`F${rIdx}`).border = borderStyle;

      sheetSummary.mergeCells(`G${rIdx}:I${rIdx}`);
      const c3 = sheetSummary.getCell(`G${rIdx}`);
      c3.value = r[3];
      c3.font = { size: 9.5, bold: true, color: { argb: "FF166534" } };
      c3.alignment = { horizontal: "center" };
      c3.border = borderStyle;
      sheetSummary.getCell(`H${rIdx}`).border = borderStyle;
      sheetSummary.getCell(`I${rIdx}`).border = borderStyle;
    });

    // Table Header
    sheetSummary.getRow(7).height = 24;
    const sumHeaders = [
      "No",
      "Butir Pertanyaan Evaluasi",
      "Rerata Skor",
      "Sgt Setuju (5)",
      "Setuju (4)",
      "Netral (3)",
      "Tdk Setuju (2)",
      "Sgt Tdk Setuju (1)",
    ];
    ["B", "C", "D", "E", "F", "G", "H", "I"].forEach((col, idx) => {
      const c = sheetSummary.getCell(`${col}7`);
      c.value = sumHeaders[idx];
      c.font = { bold: true, size: 9.5, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }; // Teal
      c.alignment = { vertical: "middle", horizontal: idx === 1 ? "left" : "center" };
      c.border = borderStyle;
    });

    // Compute distribution per question
    EVALUATION_QUESTIONS.forEach((q, idx) => {
      const rIdx = 8 + idx;
      sheetSummary.getRow(rIdx).height = 22;
      const qKey = `q${q.orderNumber}` as keyof typeof allEvaluations[0];
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;

      allEvaluations.forEach((e) => {
        const val = e[qKey] as number;
        if (typeof val === "number" && val >= 1 && val <= 5) {
          counts[val] = (counts[val] || 0) + 1;
          sum += val;
        }
      });

      const total = allEvaluations.length;
      const avg = total > 0 ? (sum / total).toFixed(2) : "0.00";

      sheetSummary.getCell(`B${rIdx}`).value = q.orderNumber;
      sheetSummary.getCell(`B${rIdx}`).alignment = { vertical: "middle", horizontal: "center" };
      sheetSummary.getCell(`B${rIdx}`).font = { bold: true, size: 9.5 };
      sheetSummary.getCell(`B${rIdx}`).border = borderStyle;

      sheetSummary.getCell(`C${rIdx}`).value = q.questionText;
      sheetSummary.getCell(`C${rIdx}`).alignment = { vertical: "middle", wrapText: true };
      sheetSummary.getCell(`C${rIdx}`).font = { size: 9.5 };
      sheetSummary.getCell(`C${rIdx}`).border = borderStyle;

      sheetSummary.getCell(`D${rIdx}`).value = `${avg} pts`;
      sheetSummary.getCell(`D${rIdx}`).alignment = { vertical: "middle", horizontal: "center" };
      sheetSummary.getCell(`D${rIdx}`).font = { bold: true, size: 9.5, color: { argb: "FF0F766E" } };
      sheetSummary.getCell(`D${rIdx}`).border = borderStyle;

      [5, 4, 3, 2, 1].forEach((optVal, oIdx) => {
        const colLetter = ["E", "F", "G", "H", "I"][oIdx];
        const count = counts[optVal] || 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
        const c = sheetSummary.getCell(`${colLetter}${rIdx}`);
        c.value = `${count} (${pct}%)`;
        c.alignment = { vertical: "middle", horizontal: "center" };
        c.font = { size: 9 };
        c.border = borderStyle;
      });
    });

    // ── SHEET 2: Data Jawaban Mentah Per Responden ──
    const sheetData = workbook.addWorksheet("Data Jawaban Responden", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    });

    const sheet2Columns: any[] = [
      { header: "No", key: "no", width: 6 },
      { header: "User ID", key: "userId", width: 10 },
      { header: "Nama Responden", key: "nama", width: 22 },
      { header: "Status", key: "status", width: 12 },
    ];

    EVALUATION_QUESTIONS.forEach((q) => {
      sheet2Columns.push({
        header: `Q${q.orderNumber}: ${q.questionText.slice(0, 30)}...`,
        key: `q_${q.orderNumber}`,
        width: 18,
      });
    });

    sheet2Columns.push(
      { header: "Rerata Skor", key: "avgScore", width: 14 },
      { header: "Waktu Selesai (WIB)", key: "completedAt", width: 22 }
    );

    sheetData.columns = sheet2Columns;

    const hRow = sheetData.getRow(1);
    hRow.height = 28;
    hRow.eachCell((cell, colNum) => {
      let bg = "FF1E293B"; // Slate
      if (colNum >= 5 && colNum <= 14) bg = "FF0369A1"; // Sky (Questions)
      if (colNum > 14) bg = "FF4338CA"; // Indigo

      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    completedRespondents.forEach((u, idx) => {
      const ev = evalMap.get(u.id)!;
      let sum = 0;

      const rowObj: any = {
        no: idx + 1,
        userId: u.id,
        nama: u.nama,
        status: "Lengkap",
      };

      EVALUATION_QUESTIONS.forEach((q) => {
        const qKey = `q${q.orderNumber}` as keyof typeof ev;
        const score = (ev[qKey] as number) || 0;
        sum += score;
        rowObj[`q_${q.orderNumber}`] = score;
      });

      rowObj.avgScore = Number((sum / 10).toFixed(2));
      rowObj.completedAt = ev.completedAt ? new Date(ev.completedAt).toLocaleString("id-ID") : "—";

      const row = sheetData.addRow(rowObj);
      row.height = 20;

      row.eachCell((cell, colNum) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };
        if (colNum !== 3) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }

        if (colNum === 4) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          cell.font = { bold: true, color: { argb: "FF166534" } };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const safeDate = new Date().toISOString().slice(0, 10);
    const filename = `Laporan_Evaluasi_Simulasi_${safeDate}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting evaluation data to Excel:", error);
    return NextResponse.json(
      { error: "Gagal mengekspor data evaluasi ke Excel." },
      { status: 500 }
    );
  }
}
