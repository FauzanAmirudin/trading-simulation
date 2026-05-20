import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { experimentalConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(experimentalConfig);
    const config: Record<string, { title: string; content: string }> = {};
    rows.forEach(row => {
      config[row.key] = { title: row.title, content: row.content };
    });
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load intervention config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, title, content } = body;

    if (!key || !title || content === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: key, title, content" },
        { status: 400 }
      );
    }

    const validKeys = ["BERITA_BAIK", "BERITA_BURUK", "TMNP_1", "TMNP_2"];
    if (!validKeys.includes(key)) {
      return NextResponse.json(
        { error: `Invalid key. Must be one of: ${validKeys.join(", ")}` },
        { status: 400 }
      );
    }

    // Upsert — update if exists, insert if not
    const existing = await db
      .select()
      .from(experimentalConfig)
      .where(eq(experimentalConfig.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(experimentalConfig)
        .set({ title, content, updatedAt: new Date() })
        .where(eq(experimentalConfig.key, key));
    } else {
      await db.insert(experimentalConfig).values({ key, title, content });
    }

    return NextResponse.json({ success: true, key, title, content });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save intervention config" }, { status: 500 });
  }
}