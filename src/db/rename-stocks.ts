import { db } from "./index";
import { stocks } from "./schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function run() {
  const allStocks = await db.select().from(stocks).orderBy(stocks.id);
  
  for (let i = 0; i < allStocks.length; i++) {
    const s = allStocks[i];
    const newKode = `S-${i + 1}`;
    const newNama = `Saham S-${i + 1}`;
    
    await db.update(stocks)
      .set({ kodeSaham: newKode, namaSaham: newNama })
      .where(eq(stocks.id, s.id));
    console.log(`Updated ${s.kodeSaham} to ${newKode} (${newNama})`);
  }

  // Rewrite seed.ts to match
  const seedPath = path.join(__dirname, "seed.ts");
  let content = fs.readFileSync(seedPath, "utf-8");
  
  const stockListRegex = /const stockList = \[([\s\S]*?)\];/;
  const match = content.match(stockListRegex);
  if (match) {
    const lines = match[1].split("\n").filter(l => l.trim().length > 0);
    const newLines = lines.map((line, i) => {
      let l = line.replace(/kode:\s*"[^"]+"/, `kode: "S-${i + 1}"`);
      l = l.replace(/nama:\s*"[^"]+"/, `nama: "Saham S-${i + 1}"`);
      return l;
    });
    const newStockList = `const stockList = [\n${newLines.join("\n")}\n];`;
    content = content.replace(stockListRegex, newStockList);
    fs.writeFileSync(seedPath, content, "utf-8");
    console.log("Rewrote seed.ts");
  }

  console.log("Done");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
