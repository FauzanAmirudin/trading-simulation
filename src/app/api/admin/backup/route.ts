import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/auth-server";
import { createFullBackup, listBackups } from "@/lib/backup-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const format = searchParams.get("format") || "excel";
  const filenameParam = searchParams.get("filename");

  const backupDir = path.join(process.cwd(), "backups");

  // 1. Action: List existing backups
  if (action === "list") {
    try {
      const backups = listBackups();
      return NextResponse.json({ backups });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengambil daftar backup";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // 2. Action: Download a specific existing backup file
  if (action === "download" && filenameParam) {
    const safeFilename = path.basename(filenameParam);
    const targetPath = path.join(backupDir, safeFilename);

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ error: "File backup tidak ditemukan." }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(targetPath);
    let contentType = "application/octet-stream";
    if (safeFilename.endsWith(".zip")) {
      contentType = "application/zip";
    } else if (safeFilename.endsWith(".xlsx")) {
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (safeFilename.endsWith(".json")) {
      contentType = "application/json; charset=utf-8";
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  }

  // 3. Action: Generate new backup on-the-fly and download
  try {
    const backup = await createFullBackup("manual-admin-export");

    if (format === "json") {
      const jsonContent = fs.readFileSync(backup.jsonPath, "utf8");
      return new NextResponse(jsonContent, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${backup.jsonFilename}"`,
        },
      });
    }
    // Default: Return ZIP bundle with all Excel files + JSON snapshot
    const buffer = backup.zipBuffer || fs.readFileSync(backup.zipPath);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${backup.zipFilename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err: unknown) {
    console.error("[Backup Route Error]:", err);
    const message = err instanceof Error ? err.message : "Gagal membuat cadangan data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const backup = await createFullBackup("admin-manual-trigger");
    return NextResponse.json({
      success: true,
      message: "Cadangan data berhasil dibuat",
      backup: {
        timestamp: backup.timestamp,
        zipFilename: backup.zipFilename,
        jsonFilename: backup.jsonFilename,
        filesIncluded: backup.filesIncluded,
        recordCounts: backup.recordCounts,
      },
    });
  } catch (err: unknown) {
    console.error("[Backup POST Error]:", err);
    const message = err instanceof Error ? err.message : "Gagal membuat cadangan data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "Nama file wajib disertakan." }, { status: 400 });
  }

  const safeFilename = path.basename(filename);
  const backupDir = path.join(process.cwd(), "backups");
  const targetPath = path.join(backupDir, safeFilename);

  if (!fs.existsSync(targetPath)) {
    return NextResponse.json({ error: "File backup tidak ditemukan." }, { status: 404 });
  }

  try {
    fs.unlinkSync(targetPath);
    return NextResponse.json({ success: true, message: `File ${safeFilename} berhasil dihapus.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus file backup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
