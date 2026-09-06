import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, respondentProfiles, questions, questionnaireResponses } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import ExcelJS from "exceljs";
import { PROFILE_MATRIX, ProfileGroup } from "@/lib/questionnaire-logic";
import { requireAdmin } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
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

    // 5. Create Workbook
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
    // ── SHEET 1: Profil & Kuesioner Responden (Semua Data) ──
    // ─────────────────────────────────────────────────────────────
    const sheet1 = workbook.addWorksheet("Profil & Kuesioner", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    });

    const sheet1Columns: any[] = [
      { header: "No", key: "no", width: 6 },
      { header: "User ID", key: "userId", width: 10 },
      { header: "Nama Responden", key: "nama", width: 22 },
      { header: "Status", key: "status", width: 14 },
    ];

    // Kolom Kuesioner LA (Nomor 1 s/d 15)
    laQuestions.forEach((q) => {
      sheet1Columns.push({
        header: `LA ${q.orderNumber}`,
        key: `la_${q.id}`,
        width: 6,
      });
    });

    sheet1Columns.push(
      { header: "Total LA", key: "laRaw", width: 12 },
      { header: "Rerata LA", key: "laAvg", width: 12 },
      { header: "Kategori LA", key: "laCat", width: 14 }
    );

    // Kolom Kuesioner EI (Nomor 1 s/d 15)
    eiQuestions.forEach((q) => {
      sheet1Columns.push({
        header: `EI ${q.orderNumber}`,
        key: `ei_${q.id}`,
        width: 6,
      });
    });

    sheet1Columns.push(
      { header: "Total EI", key: "eiRaw", width: 12 },
      { header: "Rerata EI", key: "eiAvg", width: 12 },
      { header: "Kategori EI", key: "eiCat", width: 14 },
      { header: "String Profil", key: "profileLabel", width: 16 },
      { header: "Kode Profil", key: "profileCode", width: 14 },
      { header: "Kelompok", key: "profileGroup", width: 14 },
      { header: "Karakteristik Perilaku", key: "groupDesc", width: 45 },
      { header: "Waktu Selesai", key: "completedAt", width: 22 }
    );

    sheet1.columns = sheet1Columns;

    // Header Styling Sheet 1
    const headerRow1 = sheet1.getRow(1);
    headerRow1.height = 28;
    const laStartIndex = 5;
    const laEndIndex = laStartIndex + laQuestions.length - 1;
    const eiStartIndex = laEndIndex + 4;
    const eiEndIndex = eiStartIndex + eiQuestions.length - 1;

    headerRow1.eachCell((cell, colNumber) => {
      let bgColor = "FF1E293B"; // Slate 800 (Default)
      if (colNumber >= laStartIndex && colNumber <= laEndIndex) {
        bgColor = "FF0F766E"; // Teal 700 (LA Butir 1-15)
      } else if (colNumber > laEndIndex && colNumber < eiStartIndex) {
        bgColor = "FF115E59"; // Darker Teal (LA Summary)
      } else if (colNumber >= eiStartIndex && colNumber <= eiEndIndex) {
        bgColor = "FF4338CA"; // Indigo 700 (EI Butir 1-15)
      } else if (colNumber > eiEndIndex && colNumber <= eiEndIndex + 3) {
        bgColor = "FF3730A3"; // Darker Indigo (EI Summary)
      }

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgColor },
      };
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    // Populate Sheet 1 Rows
    allRespondents.forEach((u, index) => {
      const p = profileMap.get(u.id);
      const isCompleted = Boolean(p?.isCompleted);
      const groupKey = (p?.profileGroup || "E") as ProfileGroup;
      const groupDef = PROFILE_MATRIX[groupKey] || PROFILE_MATRIX.E;

      const rowData: any = {
        no: index + 1,
        userId: u.id,
        nama: u.nama,
        status: isCompleted ? "Lengkap" : "Belum Mengisi",
      };

      // Jawaban butir LA
      laQuestions.forEach((q) => {
        const val = responseMatrix.get(`${u.id}_${q.id}`);
        rowData[`la_${q.id}`] = val !== undefined ? val : "—";
      });

      rowData.laRaw = p ? p.laRawScore : "—";
      rowData.laAvg = p ? Number(p.laAvgScore) : "—";
      rowData.laCat = p
        ? p.laCategory === "T"
          ? "Tinggi (T)"
          : p.laCategory === "S"
          ? "Sedang (S)"
          : "Rendah (R)"
        : "—";

      // Jawaban butir EI
      eiQuestions.forEach((q) => {
        const val = responseMatrix.get(`${u.id}_${q.id}`);
        rowData[`ei_${q.id}`] = val !== undefined ? val : "—";
      });

      rowData.eiRaw = p ? p.eiRawScore : "—";
      rowData.eiAvg = p ? Number(p.eiAvgScore) : "—";
      rowData.eiCat = p
        ? p.eiCategory === "T"
          ? "Tinggi (T)"
          : p.eiCategory === "S"
          ? "Sedang (S)"
          : "Rendah (R)"
        : "—";

      rowData.profileLabel = p ? p.profileLabel : "—";
      rowData.profileCode = p ? p.profileCode : "—";
      rowData.profileGroup = p ? `Kelompok ${p.profileGroup}` : "—";
      rowData.groupDesc = p ? groupDef.description : "—";
      rowData.completedAt = p?.completedAt
        ? new Date(p.completedAt).toLocaleString("id-ID")
        : "—";

      const row = sheet1.addRow(rowData);
      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };
        // Center-align everything except Name & Description
        if (colNumber !== 3 && colNumber !== sheet1Columns.length - 1) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }
      });
    });

    // ─────────────────────────────────────────────────────────────
    // ── SHEET 2: Matriks Jawaban Mentah (Nomor 1-15 LA & EI) ──
    // ─────────────────────────────────────────────────────────────
    const sheet2 = workbook.addWorksheet("Matriks Jawaban Kuesioner", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    });

    const sheet2Columns: any[] = [
      { header: "No", key: "no", width: 6 },
      { header: "User ID", key: "userId", width: 10 },
      { header: "Nama Responden", key: "nama", width: 22 },
    ];

    // Append LA columns (Hanya Nomor 1..15)
    laQuestions.forEach((q) => {
      sheet2Columns.push({
        header: `${q.orderNumber}`,
        key: `la_${q.id}`,
        width: 5,
      });
    });
    sheet2Columns.push(
      { header: "Total LA", key: "total_la", width: 11 },
      { header: "Kat. LA", key: "cat_la", width: 10 }
    );

    // Append EI columns (Hanya Nomor 1..15)
    eiQuestions.forEach((q) => {
      sheet2Columns.push({
        header: `${q.orderNumber}`,
        key: `ei_${q.id}`,
        width: 5,
      });
    });
    sheet2Columns.push(
      { header: "Total EI", key: "total_ei", width: 11 },
      { header: "Kat. EI", key: "cat_ei", width: 10 },
      { header: "Kelompok", key: "group", width: 12 },
      { header: "String Profil", key: "label", width: 16 }
    );

    sheet2.columns = sheet2Columns;

    // Style Header Sheet 2
    const headerRow2 = sheet2.getRow(1);
    headerRow2.height = 28;
    const s2LaEnd = 3 + laQuestions.length;
    const s2EiStart = s2LaEnd + 3;
    const s2EiEnd = s2EiStart + eiQuestions.length - 1;

    headerRow2.eachCell((cell, colNumber) => {
      let bgColor = "FF1E293B"; // Slate 800
      if (colNumber > 3 && colNumber <= s2LaEnd + 2) {
        bgColor = "FF0F766E"; // Teal 700 (LA)
      } else if (colNumber >= s2EiStart && colNumber <= s2EiEnd + 2) {
        bgColor = "FF4338CA"; // Indigo 700 (EI)
      }

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: bgColor },
      };
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    allRespondents.forEach((u, index) => {
      const p = profileMap.get(u.id);
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
      rowData.cat_ei = p?.eiCategory || "—";
      rowData.group = p ? `Kel. ${p.profileGroup}` : "—";
      rowData.label = p ? p.profileLabel : "—";

      const row = sheet2.addRow(rowData);
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
    // ── SHEET 3: Daftar Butir Pertanyaan (Codebook Referensi) ──
    // ─────────────────────────────────────────────────────────────
    const sheet3 = workbook.addWorksheet("Daftar Butir Pertanyaan", {
      views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
    });

    sheet3.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Instrumen", key: "instrument", width: 26 },
      { header: "Nomor Butir", key: "orderNumber", width: 14 },
      { header: "Kode Kolom", key: "code", width: 14 },
      { header: "Pernyataan Kuesioner", key: "questionText", width: 75 },
      { header: "Skala Penilaian", key: "scale", width: 35 },
    ];

    const headerRow3 = sheet3.getRow(1);
    headerRow3.height = 28;
    headerRow3.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" },
      };
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = borderStyle;
    });

    allQuestions.forEach((q, idx) => {
      const isLA = q.instrument === "LA";
      const row = sheet3.addRow({
        no: idx + 1,
        instrument: isLA
          ? "Loss Aversion (LA)"
          : "Emotional Intelligence (EI)",
        orderNumber: `Butir ${q.orderNumber}`,
        code: `${q.instrument} ${q.orderNumber}`,
        questionText: q.questionText,
        scale: "1 (Sangat Tidak Setuju) s/d 5 (Sangat Setuju)",
      });

      row.height = 24;
      row.eachCell((cell, colNumber) => {
        cell.border = borderStyle;
        cell.alignment = { vertical: "middle" };
        if (colNumber <= 4) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        }
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Laporan_Profil_Psikologis_Responden_${new Date().toISOString().slice(0, 10)}.xlsx`;

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
