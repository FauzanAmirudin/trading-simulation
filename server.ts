import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { db } from "./src/db/connect";
import {
  users, stocks, rounds, roundStocks, predictions,
  orderBook, transactionsHistory, portfolios, experimentalConfig,
} from "./src/db/schema";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  PERIOD_MATRIX, getPeriodConfig, DURATIONS,
  InterventionType, PhaseType, PeriodDef, getInterventionLabel,
} from "./src/lib/experimental-matrix";

// ============================================================
// SERVER SETUP
// ============================================================
let io: import("socket.io").Server;
const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// ============================================================
// TYPES
// ============================================================
type OrderType = {
  id: number; userId: number; stockId: number;
  tipe: string; harga: number; jumlah: number;
};
type StockRow = {
  id: number; kodeSaham: string; namaSaham: string; basePrice: string;
};

// ============================================================
// IN-MEMORY EXPERIMENT STATE
// ============================================================

// ─── Period / Session / Round position ───────────────────────
let activePeriod: 1 | 2 | 3 | null = null;
let activeSessionIdx: number | null = null;  // index into period.sessions[]
let activeRoundIdx: number | null = null;    // index into session.rounds[]

// ─── Phase & Intervention ────────────────────────────────────
let currentPhase: PhaseType = "IDLE";
let currentIntervention: InterventionType = "NONE";
let currentInterventionTitle = "";
let currentInterventionContent = "";

// ─── Control flags ───────────────────────────────────────────
let isPaused = false;
let periodAborted = false;

// ─── Active round ────────────────────────────────────────────
let activeRoundDbId: number | null = null;
let activeStocks: StockRow[] = [];
let activeOrderBooks: Record<number, { bids: OrderType[]; asks: OrderType[] }> = {};
let activePredictions: Record<number, { userId: number; predictedPrice: number }[]> = {};
let activeOpeningPrices: Record<number, number> = {};

// ─── Timer ───────────────────────────────────────────────────
let currentTimeLeft = 0;
let currentTimerInterval: NodeJS.Timeout | null = null;
let resolveCountdown: (() => void) | null = null;

// ─── Matching engine ─────────────────────────────────────────
let matchingInterval: NodeJS.Timeout | null = null;

// ─── Intervention content cache ──────────────────────────────
let interventionCache: Record<string, { title: string; content: string }> = {};

// ─── Persistent Period States ────────────────────────────────
export type PeriodStateType = "idle" | "running" | "paused" | "completed";
let periodStates: Record<number, PeriodStateType> = { 1: "idle", 2: "idle", 3: "idle" };

async function loadPeriodStates() {
  try {
    for (let i = 1; i <= 3; i++) {
      const key = `period_${i}_status`;
      const [row] = await db.select().from(experimentalConfig).where(eq(experimentalConfig.key, key)).limit(1);
      if (row) {
        periodStates[i] = row.content as PeriodStateType;
      } else {
        await db.insert(experimentalConfig).values({ key, title: `Status Period ${i}`, content: "idle" });
        periodStates[i] = "idle";
      }
    }
  } catch (err) {
    console.error("[Scheduler] Error loading period states:", err);
  }
}

async function setPeriodState(periodNumber: number, state: PeriodStateType) {
  try {
    periodStates[periodNumber] = state;
    await db.update(experimentalConfig)
      .set({ content: state })
      .where(eq(experimentalConfig.key, `period_${periodNumber}_status`));
    io.emit("period-state-changed", periodStates);
  } catch (err) {
    console.error("[Scheduler] Error setting period state:", err);
  }
}

// ============================================================
// TIMER — pauseable, abortable countdown
// ============================================================

function emitTimerTick() {
  const sessionGroup =
    activePeriod !== null && activeSessionIdx !== null
      ? getPeriodConfig(activePeriod).sessions[activeSessionIdx].sessionNumber
      : null;
  // Optimasi 4: Hanya emit ke semua client saat state berubah (pause/resume)
  // Tick per detik hanya dikirim saat diperlukan sinkronisasi
  io.emit("timer-tick", {
    phase: currentPhase,
    timeLeft: currentTimeLeft,
    periodNumber: activePeriod,
    sessionGroup,
    roundIndex: activeRoundIdx,
  });
}

// Optimasi 4: Emit tick hanya ke satu socket (saat connect), bukan broadcast
function emitTimerTickToSocket(socket: import("socket.io").Socket) {
  const sessionGroup =
    activePeriod !== null && activeSessionIdx !== null
      ? getPeriodConfig(activePeriod).sessions[activeSessionIdx].sessionNumber
      : null;
  socket.emit("timer-tick", {
    phase: currentPhase,
    timeLeft: currentTimeLeft,
    periodNumber: activePeriod,
    sessionGroup,
    roundIndex: activeRoundIdx,
  });
}

async function runCountdown(seconds: number): Promise<void> {
  currentTimeLeft = seconds;
  return new Promise<void>((resolve) => {
    resolveCountdown = resolve;
    if (currentTimerInterval) { clearInterval(currentTimerInterval); currentTimerInterval = null; }
    emitTimerTick(); // Sync awal ke semua client
    currentTimerInterval = setInterval(() => {
      if (periodAborted) {
        clearInterval(currentTimerInterval!); currentTimerInterval = null;
        if (resolveCountdown) { resolveCountdown(); resolveCountdown = null; }
        return;
      }
      if (isPaused) return; // freeze — do not decrement
      currentTimeLeft = Math.max(0, currentTimeLeft - 1);
      // Optimasi 4: Tidak broadcast timer-tick setiap detik ke semua client
      // Client melakukan countdown secara mandiri di sisi browser
      // Hanya sync setiap 10 detik untuk koreksi drift
      if (currentTimeLeft % 10 === 0) {
        emitTimerTick();
      }
      if (currentTimeLeft <= 0) {
        clearInterval(currentTimerInterval!); currentTimerInterval = null;
        if (resolveCountdown) { resolveCountdown(); resolveCountdown = null; }
      }
    }, 1000);
  });
}

// ============================================================
// HELPERS
// ============================================================

async function loadInterventionCache() {
  try {
    const rows = await db.select().from(experimentalConfig);
    rows.forEach(row => { interventionCache[row.key] = { title: row.title, content: row.content }; });
    console.log("[Scheduler] Intervention cache loaded:", Object.keys(interventionCache));
  } catch (err) {
    console.warn("[Scheduler] Could not load intervention cache:", err);
  }
}

// Optimasi 1: Batch insert — dari 12 query terpisah menjadi 2 query total
async function seedInitialPortfolios(roundId: number, stockRows: StockRow[], initialLot = 10) {
  const allUsers = await db.select().from(users).where(eq(users.role, "responden"));
  const toInsert = allUsers.flatMap(user =>
    stockRows.map(stock => ({
      userId: user.id,
      stockId: stock.id,
      roundId,
      jumlahLot: initialLot,
      averagePrice: String(stock.basePrice),
    }))
  );
  if (toInsert.length > 0) {
    await db.insert(portfolios).values(toInsert).onConflictDoNothing();
  }
  console.log(`[Scheduler] Portfolios seeded: ${allUsers.length} users × ${stockRows.length} stocks × ${initialLot} lot`);
}

async function resetAllBalances() {
  await db.update(users).set({ saldo: "100000000.00" }).where(eq(users.role, "responden"));
  const allUsers = await db.select().from(users).where(eq(users.role, "responden"));
  for (const user of allUsers) {
    io.to(`user:${user.id}`).emit("balance-update", { userId: user.id, balance: 100_000_000 });
  }
  console.log("[Scheduler] All respondent balances reset to 100,000,000");
}

async function resetSessionState() {
  await db.update(orderBook).set({ status: "cancelled" }).where(eq(orderBook.status, "open"));
  await resetAllBalances();
  console.log("[Scheduler] Session state reset: open orders cancelled, balances reset");
}

async function cleanupActiveRound() {
  stopMatchingEngine();
  if (activeRoundDbId) {
    await db.update(rounds)
      .set({ status: "closed", subSessionStatus: "CLOSED", endTime: new Date() })
      .where(eq(rounds.id, activeRoundDbId));
    await db.update(orderBook)
      .set({ status: "cancelled" })
      .where(and(eq(orderBook.roundId, activeRoundDbId), eq(orderBook.status, "open")));
  }
  activeRoundDbId = null;
  activeStocks = [];
  activeOrderBooks = {};
  activePredictions = {};
  activeOpeningPrices = {};
}

// ============================================================
// MATCHING ENGINE
// ============================================================

function stopMatchingEngine() {
  if (matchingInterval) { clearInterval(matchingInterval); matchingInterval = null; }
}

function startMatchingEngine() {
  if (matchingInterval) clearInterval(matchingInterval);
  matchingInterval = setInterval(async () => {
    if (currentPhase !== "TRADING" || isPaused || !activeRoundDbId) return;
    for (const stock of activeStocks) {
      const book = activeOrderBooks[stock.id];
      if (!book) continue;
      book.bids.sort((a, b) => b.harga - a.harga);
      book.asks.sort((a, b) => a.harga - b.harga);
      let changed = false;
      let i = 0;
      while (i < book.bids.length) {
        const bid = book.bids[i];
        const askIdx = book.asks.findIndex(a => a.harga === bid.harga);
        if (askIdx !== -1) {
          const ask = book.asks[askIdx];
          const initialBidId = bid.id;
          await executeTrade(stock.id, bid, ask, bid.harga, activeRoundDbId);
          changed = true;
          // If bid was completely filled, it gets spliced out of book.bids.
          // We only increment i if the bid wasn't removed AND there are no more matching asks.
          // But since the matching ask was removed (or this bid was removed), 
          // we can just let the loop re-evaluate index `i`.
          // If the bid is still at `i` and there are no more asks, the next iteration will hit the `else` block.
        } else {
          i++;
        }
      }
      if (changed) emitOrderBookUpdate(stock.id);
    }
  }, 750); // Optimasi 3: Naikkan dari 500ms ke 750ms — kurangi beban DB 33% tanpa dampak UX
}

function emitOrderBookUpdate(stockId: number) {
  const book = activeOrderBooks[stockId];
  if (!book) return;
  const bids = [...book.bids].sort((a, b) => b.harga - a.harga).slice(0, 10);
  const asks = [...book.asks].sort((a, b) => a.harga - b.harga).slice(0, 10);
  io.emit("order-book-update", {
    stockId,
    bids: bids.map(o => ({ id: o.id, harga: o.harga, jumlah: o.jumlah, userId: o.userId })),
    asks: asks.map(o => ({ id: o.id, harga: o.harga, jumlah: o.jumlah, userId: o.userId })),
  });
}

// Optimasi 2: Emit balance langsung dari nilai yang diketahui — tanpa SELECT DB
function emitBalanceUpdateDirect(userId: number, newBalance: number) {
  io.to(`user:${userId}`).emit("balance-update", { userId, balance: newBalance });
}

async function emitPortfolioUpdate(userId: number, stockId: number) {
  const query = activeRoundDbId
    ? await db.select().from(portfolios)
        .where(and(eq(portfolios.userId, userId), eq(portfolios.stockId, stockId), eq(portfolios.roundId, activeRoundDbId)))
        .limit(1)
    : [];
  const p = query[0];
  io.to(`user:${userId}`).emit("portfolio-update", { userId, stockId, jumlahLot: p ? p.jumlahLot : 0 });
}

async function executeTrade(
  stockId: number, bidOrder: OrderType, askOrder: OrderType,
  price: number, roundId: number,
) {
  const quantity = Math.min(bidOrder.jumlah, askOrder.jumlah);
  if (quantity <= 0) return;

  const book = activeOrderBooks[stockId];
  if (book) {
    bidOrder.jumlah -= quantity;
    askOrder.jumlah -= quantity;
    if (bidOrder.jumlah <= 0) { const i = book.bids.findIndex(o => o.id === bidOrder.id); if (i !== -1) book.bids.splice(i, 1); }
    if (askOrder.jumlah <= 0) { const i = book.asks.findIndex(o => o.id === askOrder.id); if (i !== -1) book.asks.splice(i, 1); }
  }

  const total = price * quantity * 100;
  const subSession = currentPhase === "TRADING" ? 2 : 1;

  try {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ saldo: sql`saldo - ${total}` }).where(eq(users.id, bidOrder.userId));
      await tx.update(users).set({ saldo: sql`saldo + ${total}` }).where(eq(users.id, askOrder.userId));

      // Buyer portfolio — scoped to current roundId
      const [bp] = await tx.select().from(portfolios)
        .where(and(eq(portfolios.userId, bidOrder.userId), eq(portfolios.stockId, stockId), eq(portfolios.roundId, roundId)))
        .limit(1);
      if (bp) {
        const newLots = bp.jumlahLot + quantity;
        const newAvg = Math.round(((Number(bp.averagePrice) * bp.jumlahLot) + (price * quantity)) / newLots);
        await tx.update(portfolios).set({ jumlahLot: newLots, averagePrice: String(newAvg) }).where(eq(portfolios.id, bp.id));
      } else {
        await tx.insert(portfolios).values({ userId: bidOrder.userId, stockId, roundId, jumlahLot: quantity, averagePrice: String(price) });
      }

      // Seller portfolio — scoped to current roundId
      const [sp] = await tx.select().from(portfolios)
        .where(and(eq(portfolios.userId, askOrder.userId), eq(portfolios.stockId, stockId), eq(portfolios.roundId, roundId)))
        .limit(1);
      if (sp) {
        const newLots = sp.jumlahLot - quantity;
        if (newLots === 0) await tx.delete(portfolios).where(eq(portfolios.id, sp.id));
        else await tx.update(portfolios).set({ jumlahLot: newLots }).where(eq(portfolios.id, sp.id));
      }

      await tx.insert(transactionsHistory).values({
        orderBuyId: bidOrder.id, orderSellId: askOrder.id,
        stockId, roundId, subSession,
        harga: String(price), jumlah: quantity, total: String(total),
        activeIntervention: currentIntervention,
      });
    });

    const stockInfo = activeStocks.find(s => s.id === stockId);
    io.emit("trade-executed", {
      stockId, price, quantity,
      stockCode: stockInfo?.kodeSaham ?? `#${stockId}`,
      buyerId: bidOrder.userId, sellerId: askOrder.userId,
      activeIntervention: currentIntervention,
      timestamp: new Date().toISOString(),
    });

    // Optimasi 2: Hitung saldo baru di memori, emit langsung tanpa SELECT DB
    // Perlu baca saldo saat ini dari DB hanya 1x di awal transaksi
    const [bidUser] = await db.select({ saldo: users.saldo }).from(users).where(eq(users.id, bidOrder.userId)).limit(1);
    const [askUser] = await db.select({ saldo: users.saldo }).from(users).where(eq(users.id, askOrder.userId)).limit(1);
    if (bidUser) emitBalanceUpdateDirect(bidOrder.userId, Number(bidUser.saldo) - total);
    if (askUser) emitBalanceUpdateDirect(askOrder.userId, Number(askUser.saldo) + total);
    await emitPortfolioUpdate(bidOrder.userId, stockId);
    await emitPortfolioUpdate(askOrder.userId, stockId);

  } catch (err) {
    console.error("[MatchingEngine] Trade execution error:", err);
  }
}

// ============================================================
// OPENING PRICES
// ============================================================

async function calculateOpeningPrices(roundId: number, stockRows: StockRow[]) {
  const openingPrices: Record<number, number> = {};
  for (const stock of stockRows) {
    const preds = activePredictions[stock.id] || [];
    if (preds.length === 0) {
      openingPrices[stock.id] = Number(stock.basePrice);
    } else {
      const sorted = preds.map(p => p.predictedPrice).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      openingPrices[stock.id] = sorted.length % 2 !== 0
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
  }
  activeOpeningPrices = openingPrices;

  await db.update(rounds)
    .set({ openingPrices: JSON.parse(JSON.stringify(openingPrices)) })
    .where(eq(rounds.id, roundId));

  for (const stock of stockRows) {
    const eqPrice = openingPrices[stock.id];
    if (!eqPrice) continue;
    const preds = await db.select().from(predictions)
      .where(and(eq(predictions.roundId, roundId), eq(predictions.stockId, stock.id)));
    for (const pred of preds) {
      const accuracy = Math.max(0, 1 - Math.abs(Number(pred.tebakanHarga) - eqPrice) / eqPrice);
      await db.update(predictions).set({ accuracyScore: String(accuracy.toFixed(4)) }).where(eq(predictions.id, pred.id));
    }
  }

  io.emit("opening-prices-calculated", {
    prices: stockRows.map(s => ({ stockId: s.id, kode: s.kodeSaham, price: openingPrices[s.id] })),
  });
  console.log("[Scheduler] Opening prices:", openingPrices);
}

// ============================================================
// STATE MACHINE — CORE
// ============================================================

async function runRound(
  periodConfig: PeriodDef, sessionIdx: number, roundIdx: number,
  initialPhase: PhaseType | null = null, initialTimeLeft: number | null = null
) {
  const session = periodConfig.sessions[sessionIdx];
  const roundDef = session.rounds[roundIdx];
  const periodNumber = periodConfig.periodNumber;

  // Load stocks in defined order
  const rows = await db.select({ id: stocks.id, kodeSaham: stocks.kodeSaham, namaSaham: stocks.namaSaham, basePrice: stocks.basePrice })
    .from(stocks).where(inArray(stocks.kodeSaham, roundDef.stockCodes));
  const orderedStocks = roundDef.stockCodes
    .map(code => rows.find(s => s.kodeSaham === code))
    .filter(Boolean) as StockRow[];

  if (orderedStocks.length === 0) {
    console.error(`[Scheduler] Stocks not found: ${roundDef.stockCodes.join(", ")} — skipping`);
    return;
  }

  // If recovering, we already have activeRoundDbId set. Otherwise, create new DB record.
  if (initialPhase === null) {
    const [roundRow] = await db.insert(rounds).values({
      period: periodNumber,
      sessionGroup: session.sessionNumber,
      roundIndex: roundIdx,
      status: "active",
      subSessionStatus: "PRE_MARKET",
      activeSubSession: 1,
      activeIntervention: session.intervention,
      startTime: new Date(),
    }).returning();
    
    activeRoundDbId = roundRow.id;
    activeStocks = orderedStocks;
    activeOrderBooks = Object.fromEntries(orderedStocks.map(s => [s.id, { bids: [], asks: [] }]));
    activePredictions = Object.fromEntries(orderedStocks.map(s => [s.id, []]));
    activeOpeningPrices = {};
    currentIntervention = session.intervention;

    for (let i = 0; i < orderedStocks.length; i++) {
      await db.insert(roundStocks).values({ roundId: roundRow.id, stockId: orderedStocks[i].id, slot: i + 1 });
    }
    await seedInitialPortfolios(roundRow.id, orderedStocks);
  }



  const roundLabel = `P${periodNumber}-S${session.sessionNumber}-R${roundIdx + 1}`;
  console.log(`[Scheduler] ${roundLabel}: ${orderedStocks.map(s => s.kodeSaham).join(", ")}`);

  // Broadcast round start
  io.emit("round-started", {
    roundNumber: roundIdx + 1,
    period: periodNumber,
    periodLabel: periodConfig.label,
    sessionNumber: session.sessionNumber,
    sessionLabel: session.label,
    stocks: orderedStocks.map(s => ({
      id: s.id, kodeSaham: s.kodeSaham, namaSaham: s.namaSaham, basePrice: Number(s.basePrice),
    })),
  });

  // ── PRE_MARKET PHASE ──────────────────────────────────────
  if (initialPhase === null || initialPhase === "PRE_MARKET") {
    currentPhase = "PRE_MARKET";
    io.emit("sub-session-started", {
      roundNumber: roundIdx + 1,
      sessionNumber: 1,
      phase: "PRE_MARKET",
      duration: initialPhase === "PRE_MARKET" && initialTimeLeft !== null ? initialTimeLeft : DURATIONS.PRE_MARKET,
      intervention: session.intervention,
      label: "Pra-Perdagangan",
    });

  if (session.intervention !== "NONE") {
    const DUMMY_GOOD_NEWS = [
      "Laporan kuartal terakhir menunjukkan peningkatan laba perusahaan secara signifikan melebihi ekspektasi pasar.",
      "Pemerintah baru saja mengumumkan insentif pajak baru untuk sektor industri ini, mendorong sentimen positif.",
      "Perusahaan berhasil menandatangani kontrak eksklusif bernilai tinggi dengan mitra internasional.",
      "Analyst terkemuka menaikkan target harga saham karena kinerja penjualan yang sangat memuaskan bulan ini.",
      "Inovasi produk terbaru yang diluncurkan mendapatkan respons sangat antusias dari konsumen global."
    ];
    
    const DUMMY_BAD_NEWS = [
      "Terjadi masalah operasional internal, memicu kepanikan pasar dan aksi jual massal.",
      "Kenaikan suku bunga acuan secara mendadak membuat biaya operasional perusahaan diprediksi membengkak.",
      "Laporan terbaru menunjukkan penurunan penjualan secara beruntun akibat turunnya daya beli masyarakat.",
      "Regulasi ketat dari pemerintah terkait pembatasan industri berdampak langsung pada proyeksi pendapatan.",
      "Terjadi kelangkaan bahan baku utama di pasar global yang mengancam kelancaran rantai pasok perusahaan."
    ];

    let dummyText = `Intervensi ${session.intervention} aktif.`;
    if (session.intervention === "BERITA_BAIK") {
      dummyText = orderedStocks.map(stock => {
        const news = DUMMY_GOOD_NEWS[Math.floor(Math.random() * DUMMY_GOOD_NEWS.length)];
        return `[ ${stock.kodeSaham} ] ${news}`;
      }).join("   ✦   ");
    }
    if (session.intervention === "BERITA_BURUK") {
      dummyText = orderedStocks.map(stock => {
        const news = DUMMY_BAD_NEWS[Math.floor(Math.random() * DUMMY_BAD_NEWS.length)];
        return `[ ${stock.kodeSaham} ] ${news}`;
      }).join("   ✦   ");
    }

    // Gunakan teks dari admin jika ada dan merupakan berita nyata (bukan label/key intervensi)
    const cached = interventionCache[session.intervention];
    const cachedContent = cached?.content?.trim() ?? "";
    const isRealNews = cachedContent.length > 20 && cachedContent !== session.intervention;
    const finalContent = isRealNews ? cachedContent : dummyText;
      
    const cachedTitle = cached?.title?.trim() ?? "";
    const isRealTitle = cachedTitle.length > 0 && cachedTitle !== session.intervention;
    const finalTitle = isRealTitle ? cachedTitle : getInterventionLabel(session.intervention);

    currentInterventionTitle = finalTitle;
    currentInterventionContent = finalContent;

    io.emit("intervention-triggered", {
      type: session.intervention,
      title: finalTitle,
      content: finalContent,
      roundNumber: roundIdx + 1,
    });
    console.log(`[Scheduler] Running text ACTIVE: ${session.intervention} - ${finalContent}`);
  }

    await runCountdown(initialPhase === "PRE_MARKET" && initialTimeLeft !== null ? initialTimeLeft : DURATIONS.PRE_MARKET);
    if (periodAborted) { await cleanupActiveRound(); return; }

    await calculateOpeningPrices(activeRoundDbId!, orderedStocks);
    io.emit("sub-session-ended", { roundNumber: roundIdx + 1, sessionNumber: 1, phase: "PRE_MARKET" });
  }

  // Period 1 — NO TRADING
  if (!session.hasTrading) {
    await db.update(rounds)
      .set({ status: "closed", subSessionStatus: "CLOSED", endTime: new Date() })
      .where(eq(rounds.id, activeRoundDbId!));
    io.emit("round-ended", {
      roundNumber: roundIdx + 1, periodNumber,
      sessionNumber: session.sessionNumber,
      openingPrices: activeOpeningPrices,
    });
    activeRoundDbId = null; activeStocks = []; activeOrderBooks = {};
    return;
  }

  // ── TRADING PHASE ─────────────────────────────────────────
  if (initialPhase === null || initialPhase === "PRE_MARKET" || initialPhase === "TRADING") {
    currentPhase = "TRADING";
  // Do NOT reset intervention here; let the running text continue.

    await db.update(rounds)
      .set({ subSessionStatus: "TRADING", activeSubSession: 2, activeIntervention: session.intervention })
      .where(eq(rounds.id, activeRoundDbId!));

    io.emit("sub-session-started", {
      roundNumber: roundIdx + 1,
      sessionNumber: 2,
      phase: "TRADING",
      duration: initialPhase === "TRADING" && initialTimeLeft !== null ? initialTimeLeft : DURATIONS.TRADING,
      intervention: "NONE",
      label: "Perdagangan",
    });

    startMatchingEngine();
    await runCountdown(initialPhase === "TRADING" && initialTimeLeft !== null ? initialTimeLeft : DURATIONS.TRADING);
    stopMatchingEngine();

    if (periodAborted) { await cleanupActiveRound(); return; }

    await db.update(rounds)
      .set({ status: "closed", subSessionStatus: "CLOSED", endTime: new Date() })
      .where(eq(rounds.id, activeRoundDbId!));
    await db.update(orderBook)
      .set({ status: "cancelled" })
      .where(and(eq(orderBook.roundId, activeRoundDbId!), eq(orderBook.status, "open")));

    io.emit("sub-session-ended", { roundNumber: roundIdx + 1, sessionNumber: 2, phase: "TRADING" });
    io.emit("intervention-ended", { roundNumber: roundIdx + 1 }); // hide running text at the end of the round
    io.emit("round-ended", {
      roundNumber: roundIdx + 1, periodNumber,
      sessionNumber: session.sessionNumber,
      openingPrices: activeOpeningPrices,
    });
  }

  activeRoundDbId = null; activeStocks = []; activeOrderBooks = {}; currentIntervention = "NONE";
  console.log(`[Scheduler] ${roundLabel} DONE`);
}

async function startPeriod(
  periodNumber: 1 | 2 | 3,
  startFromSessionIdx = 0,
  startFromRoundIdx = 0,
  initialPhase: PhaseType | null = null,
  initialTimeLeft: number | null = null
) {
  if (activePeriod !== null && activePeriod !== periodNumber) {
    io.emit("admin-error", { message: `Periode ${activePeriod} masih berjalan. Hentikan dahulu sebelum memulai periode baru.` });
    return;
  }

  const periodConfig = getPeriodConfig(periodNumber);
  activePeriod = periodNumber;
  periodAborted = false;
  currentPhase = initialPhase !== null ? initialPhase : "IDLE";

  console.log(`[Scheduler] ===== PERIOD ${periodNumber} STARTED =====`);
  await setPeriodState(periodNumber, "running");
  io.emit("period-started", {
    periodNumber, label: periodConfig.label,
    totalSessions: periodConfig.sessions.length,
  });

  await resetAllBalances();

  for (let si = startFromSessionIdx; si < periodConfig.sessions.length; si++) {
    if (periodAborted) break;
    const session = periodConfig.sessions[si];
    activeSessionIdx = si;

    if (si > 0 && !(si === startFromSessionIdx && initialPhase !== null)) {
      // Reset session state for the new session
      await resetSessionState();
      // Cooldown between sessions
      currentPhase = "COOLDOWN";
      io.emit("cooldown-started", {
        duration: DURATIONS.COOLDOWN, reason: "between-sessions",
        periodNumber, sessionGroup: session.sessionNumber,
      });
      console.log(`[Scheduler] Cooldown between sessions (${DURATIONS.COOLDOWN}s)...`);
      await runCountdown(DURATIONS.COOLDOWN);
      if (periodAborted) break;
    }

    currentPhase = "IDLE";
    console.log(`[Scheduler] --- Session ${session.sessionNumber}: ${session.label} ---`);
    io.emit("session-group-started", {
      periodNumber,
      sessionNumber: session.sessionNumber,
      sessionIdx: si,
      label: session.label,
      intervention: session.intervention,
      hasTrading: session.hasTrading,
      totalRounds: session.rounds.length,
    });

    const startRi = (si === startFromSessionIdx) ? startFromRoundIdx : 0;
    for (let ri = startRi; ri < session.rounds.length; ri++) {
      if (periodAborted) break;
      activeRoundIdx = ri;

      const isFirstRecoveredRound = (si === startFromSessionIdx && ri === startFromRoundIdx && initialPhase !== null);
      // Removed round-transition cooldown as requested; rounds now proceed back-to-back within a session.

      const passPhase = isFirstRecoveredRound ? initialPhase : null;
      const passTime = isFirstRecoveredRound ? initialTimeLeft : null;
      
      await runRound(periodConfig, si, ri, passPhase, passTime);
    }
  }

  activePeriod = null; activeSessionIdx = null; activeRoundIdx = null;
  currentPhase = "IDLE"; currentIntervention = "NONE";

  if (!periodAborted) {
    console.log(`[Scheduler] ===== PERIOD ${periodNumber} COMPLETE =====`);
    await setPeriodState(periodNumber, "completed");
    io.emit("period-ended", { periodNumber });
  } else {
    console.log(`[Scheduler] ===== PERIOD ${periodNumber} ABORTED =====`);
    await cleanupActiveRound();
    await setPeriodState(periodNumber, "completed");
    io.emit("period-aborted", { periodNumber });
  }
}

// ============================================================
// SOCKET.IO CONNECTION HANDLER
// ============================================================
app.prepare().then(async () => {
  const httpServer = createServer(handler);
  io = new Server(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : "*",
      methods: ["GET", "POST"],
    },
  });

  async function recoverActiveSession() {
    try {
      const [activeRound] = await db.select().from(rounds).where(eq(rounds.status, "active")).orderBy(desc(rounds.startTime)).limit(1);
      if (!activeRound) return;

      const periodNumber = activeRound.period as 1 | 2 | 3;

      // Only recover if the period was actually in "running" state when server went down.
      // If period state is "completed", "idle", or "paused", the round is stale — close it.
      const periodState = periodStates[periodNumber];
      if (periodState !== "running") {
        console.log(`[Scheduler] Found stale active round ${activeRound.id} but period ${periodNumber} state is "${periodState}" — closing stale round.`);
        await db.update(rounds)
          .set({ status: "closed", subSessionStatus: "CLOSED", endTime: new Date() })
          .where(eq(rounds.id, activeRound.id));
        await db.update(orderBook)
          .set({ status: "cancelled" })
          .where(and(eq(orderBook.roundId, activeRound.id), eq(orderBook.status, "open")));
        return;
      }

      const pc = getPeriodConfig(periodNumber);
      const sessionIdx = pc.sessions.findIndex(s => s.sessionNumber === activeRound.sessionGroup);
      const roundIdx = activeRound.roundIndex;
      const phase = activeRound.subSessionStatus as PhaseType;

      console.log(`[Scheduler] RECOVERING active round ${activeRound.id} (Period ${periodNumber}, Session ${activeRound.sessionGroup}, Round ${roundIdx + 1})`);

      // Set global active DB ID
      activeRoundDbId = activeRound.id;

      // Restore activeStocks
      const rs = await db.select().from(roundStocks).where(eq(roundStocks.roundId, activeRoundDbId));
      const sRows = await db.select().from(stocks).where(inArray(stocks.id, rs.map(r => r.stockId)));
      activeStocks = rs.map(r => sRows.find(s => s.id === r.stockId)).filter(Boolean) as StockRow[];

      // Restore order books
      activeOrderBooks = Object.fromEntries(activeStocks.map(s => [s.id, { bids: [], asks: [] }]));
      const openOrders = await db.select().from(orderBook).where(and(eq(orderBook.roundId, activeRoundDbId), eq(orderBook.status, "open")));
      for (const order of openOrders) {
        if (activeOrderBooks[order.stockId]) {
          const formatted = { id: order.id, userId: order.userId, stockId: order.stockId, tipe: order.tipe, harga: Number(order.harga), jumlah: order.jumlah };
          if (order.tipe === "buy") activeOrderBooks[order.stockId].bids.push(formatted);
          else activeOrderBooks[order.stockId].asks.push(formatted);
        }
      }

      // Restore predictions
      activePredictions = Object.fromEntries(activeStocks.map(s => [s.id, []]));
      const preds = await db.select().from(predictions).where(eq(predictions.roundId, activeRoundDbId));
      for (const pred of preds) {
        if (activePredictions[pred.stockId]) {
          activePredictions[pred.stockId].push({ userId: pred.userId, predictedPrice: Number(pred.tebakanHarga) });
        }
      }
      
      // Attempt to calculate opening prices if in TRADING phase
      activeOpeningPrices = {};
      if (phase === "TRADING") {
         await calculateOpeningPrices(activeRoundDbId, activeStocks);
      }

      isPaused = true;
      console.log("[Scheduler] Session recovered and PAUSED. Awaiting admin resume.");

      // Calculate time left (default to max for phase if exact calculation is tricky)
      const timeLeft = phase === "PRE_MARKET" ? DURATIONS.PRE_MARKET : phase === "TRADING" ? DURATIONS.TRADING : DURATIONS.COOLDOWN;

      // Start the period asynchronously
      startPeriod(periodNumber, sessionIdx, roundIdx, phase, timeLeft).catch(err => {
        console.error("[Scheduler] Error resuming period:", err);
      });
    } catch (err) {
      console.error("[Scheduler] Error recovering session:", err);
    }
  }

  await loadInterventionCache();
  await loadPeriodStates();
  console.log("[Scheduler] State machine ready — PERIOD_MATRIX loaded");
  await recoverActiveSession();

  io.on("connection", (socket) => {
    console.log("[Socket] Connected:", socket.id);

    // ── Inline auth helper ────────────────────────────────────
    function isAdmin() { return socket.data.userRole === "admin"; }

    // ── Authentication ────────────────────────────────────────
    socket.on("authenticate", async (data: { nama?: string; password?: string; userId?: number }) => {
      const { nama, password, userId } = data;
      try {
        let user: { id: number; nama: string; role: string; saldo: string } | undefined;
        if (userId) {
          const [r] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          user = r;
        } else if (nama && password) {
          const [r] = await db.select().from(users).where(eq(users.nama, nama)).limit(1);
          if (r?.password && await bcrypt.compare(password, r.password)) user = r;
        }
        if (!user) { socket.emit("auth-error", { message: "Invalid credentials" }); return; }

        socket.data.userId = user.id;
        socket.data.userRole = user.role;
        socket.join(`user:${user.id}`);
        socket.emit("auth-success", { user: { id: user.id, nama: user.nama, role: user.role, saldo: Number(user.saldo) } });
        socket.emit("period-state-changed", periodStates);

        // Sync current experiment state to newly connected client
        if (activePeriod !== null) {
          const pc = getPeriodConfig(activePeriod);
          socket.emit("period-started", { periodNumber: activePeriod, label: pc.label, totalSessions: pc.sessions.length });

          if (activeSessionIdx !== null) {
            const session = pc.sessions[activeSessionIdx];
            socket.emit("session-group-started", {
              periodNumber: activePeriod,
              sessionNumber: session.sessionNumber,
              sessionIdx: activeSessionIdx,
              label: session.label,
              intervention: session.intervention,
              hasTrading: session.hasTrading,
              totalRounds: session.rounds.length,
            });

            if (activeRoundDbId !== null && activeStocks.length > 0) {
              socket.join(`session:${activeRoundDbId}`);
              socket.emit("round-started", {
                roundNumber: (activeRoundIdx ?? 0) + 1,
                period: activePeriod,
                periodLabel: pc.label,
                sessionNumber: session.sessionNumber,
                sessionLabel: session.label,
                stocks: activeStocks.map(s => ({ id: s.id, kodeSaham: s.kodeSaham, namaSaham: s.namaSaham, basePrice: Number(s.basePrice) })),
              });
              socket.emit("sub-session-started", {
                roundNumber: (activeRoundIdx ?? 0) + 1,
                sessionNumber: currentPhase === "PRE_MARKET" ? 1 : 2,
                phase: currentPhase,
                duration: currentTimeLeft,
                intervention: currentPhase === "PRE_MARKET" ? currentIntervention : "NONE",
                label: currentPhase === "PRE_MARKET" ? "Pra-Perdagangan" : "Perdagangan",
              });
              if (Object.keys(activeOpeningPrices).length > 0) {
                socket.emit("opening-prices-calculated", {
                  prices: activeStocks.map(s => ({ stockId: s.id, kode: s.kodeSaham, price: activeOpeningPrices[s.id] })),
                });
              }
              if (currentPhase === "TRADING") {
                // Send current order books
                for (const s of activeStocks) {
                  const book = activeOrderBooks[s.id];
                  if (book) {
                    const bids = [...book.bids].sort((a, b) => b.harga - a.harga).slice(0, 10);
                    const asks = [...book.asks].sort((a, b) => a.harga - b.harga).slice(0, 10);
                    socket.emit("order-book-update", {
                      stockId: s.id,
                      bids: bids.map(o => ({ id: o.id, harga: o.harga, jumlah: o.jumlah, userId: o.userId })),
                      asks: asks.map(o => ({ id: o.id, harga: o.harga, jumlah: o.jumlah, userId: o.userId })),
                    });
                  }
                }
              }
              if (currentIntervention !== "NONE") {
                const content = interventionCache[currentIntervention] || { title: currentIntervention, content: "" };
                socket.emit("intervention-triggered", { type: currentIntervention, title: content.title, content: content.content });
              }
            } else if (currentPhase === "COOLDOWN") {
              socket.emit("cooldown-started", { duration: currentTimeLeft, reason: "unknown", periodNumber: activePeriod });
            }
          }
          socket.emit("timer-tick", {
            phase: currentPhase, timeLeft: currentTimeLeft, periodNumber: activePeriod,
            sessionGroup: activeSessionIdx !== null ? pc.sessions[activeSessionIdx].sessionNumber : null,
            roundIndex: activeRoundIdx,
          });
        }
        socket.emit("intervention-cache-loaded", interventionCache);
      } catch (err) {
        console.error("[Socket] Auth error:", err);
        socket.emit("auth-error", { message: "Authentication failed" });
      }
    });

    // ── Admin: Start Period ───────────────────────────────────
    socket.on("admin-start-period", async (data: { periodNumber: number; userId?: number }) => {
      // Inline auth fallback
      if (!isAdmin() && data.userId) {
        const [u] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
        if (u?.role === "admin") { socket.data.userId = u.id; socket.data.userRole = u.role; }
      }
      if (!isAdmin()) { socket.emit("admin-error", { message: "Unauthorized" }); return; }

      const { periodNumber } = data;
      if (periodNumber < 1 || periodNumber > 3) {
        socket.emit("admin-error", { message: "Periode harus 1, 2, atau 3" }); return;
      }
      console.log(`[Admin] Period ${periodNumber} started by admin ${socket.data.userId}`);
      // Run async — do not await (allows socket to respond immediately)
      startPeriod(periodNumber as 1 | 2 | 3).catch(err => {
        console.error("[Admin] startPeriod error:", err);
        io.emit("admin-error", { message: `Error: ${err.message}` });
      });
    });

    // ── Admin: Pause ──────────────────────────────────────────
    socket.on("admin-pause", async (data?: { userId?: number }) => {
      if (!isAdmin() && data?.userId) {
        const [u] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
        if (u?.role === "admin") { socket.data.userId = u.id; socket.data.userRole = u.role; }
      }
      if (!isAdmin()) { socket.emit("admin-error", { message: "Unauthorized" }); return; }
      isPaused = true;
      if (activePeriod !== null) await setPeriodState(activePeriod, "paused");
      io.emit("experiment-paused", { timeLeft: currentTimeLeft, phase: currentPhase });
      console.log("[Scheduler] PAUSED");
    });

    // ── Admin: Resume ─────────────────────────────────────────
    socket.on("admin-resume", async (data?: { userId?: number }) => {
      if (!isAdmin() && data?.userId) {
        const [u] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
        if (u?.role === "admin") { socket.data.userId = u.id; socket.data.userRole = u.role; }
      }
      if (!isAdmin()) { socket.emit("admin-error", { message: "Unauthorized" }); return; }
      isPaused = false;
      if (activePeriod !== null) await setPeriodState(activePeriod, "running");
      io.emit("experiment-resumed", { phase: currentPhase });
      console.log("[Scheduler] RESUMED");
    });

    // ── Admin: Stop Period ────────────────────────────────────
    socket.on("admin-stop-period", async (data?: { userId?: number }) => {
      if (!isAdmin() && data?.userId) {
        const [u] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);
        if (u?.role === "admin") { socket.data.userId = u.id; socket.data.userRole = u.role; }
      }
      if (!isAdmin()) { socket.emit("admin-error", { message: "Unauthorized" }); return; }
      periodAborted = true;
      isPaused = false;
      if (currentTimerInterval) { clearInterval(currentTimerInterval); currentTimerInterval = null; }
      if (resolveCountdown) { resolveCountdown(); resolveCountdown = null; }
      stopMatchingEngine();
      console.log("[Scheduler] Period ABORTED by admin");
    });

    // ── Admin: Reset Experiment ───────────────────────────────
    socket.on("admin-reset-experiment", async () => {
      if (!isAdmin()) return;
      periodAborted = true;
      isPaused = false;
      if (currentTimerInterval) { clearInterval(currentTimerInterval); currentTimerInterval = null; }
      if (resolveCountdown) { resolveCountdown(); resolveCountdown = null; }
      stopMatchingEngine();
      await db.update(orderBook).set({ status: "cancelled" }).where(eq(orderBook.status, "open"));
      activePeriod = null; activeSessionIdx = null; activeRoundIdx = null;
      currentPhase = "IDLE"; currentIntervention = "NONE";
      activeRoundDbId = null; activeStocks = []; activeOrderBooks = {};
      for (let i = 1; i <= 3; i++) await setPeriodState(i, "idle");
      io.emit("experiment-reset", {});
      console.log("[Scheduler] Experiment RESET by admin");
    });

    // Legacy aliases
    socket.on("admin-stop-experiment", async () => {
      socket.emit("admin-stop-period", {});
      if (!isAdmin()) return;
      periodAborted = true;
      isPaused = false;
      if (currentTimerInterval) { clearInterval(currentTimerInterval); currentTimerInterval = null; }
      if (resolveCountdown) { resolveCountdown(); resolveCountdown = null; }
    });

    // ── Admin: Reload Intervention Cache ─────────────────────
    socket.on("reload-intervention-cache", async () => {
      if (!isAdmin()) return;
      await loadInterventionCache();
      io.emit("intervention-cache-loaded", interventionCache);
      console.log("[Scheduler] Intervention cache reloaded");
    });

    // ── Admin: Force Intervention ────────────────────────────
    socket.on("admin-force-intervention", async (data: { type: InterventionType }) => {
      if (!isAdmin()) return;
      const content = interventionCache[data.type] || { title: getInterventionLabel(data.type), content: "" };
      currentIntervention = data.type;
      io.emit("intervention-triggered", { type: data.type, title: content.title, content: content.content });
    });

    // ── Get Scheduler State ──────────────────────────────────
    socket.on("get-scheduler-state", async () => {
      const sessionGroup = activePeriod !== null && activeSessionIdx !== null
        ? getPeriodConfig(activePeriod).sessions[activeSessionIdx].sessionNumber
        : null;

      const state = {
        activePeriod, activeSessionIdx, activeRoundIdx,
        currentPhase, currentIntervention, isPaused,
        timeLeft: currentTimeLeft, sessionGroup,
        stocks: activeStocks.map(s => ({ id: s.id, kodeSaham: s.kodeSaham, namaSaham: s.namaSaham, basePrice: Number(s.basePrice) })),
        openingPrices: activeOpeningPrices,
        interventionCache,
        periodStates,
        // Legacy fields
        activeRound: activeRoundIdx !== null ? activeRoundIdx + 1 : null,
        activeSubSession: currentPhase === "PRE_MARKET" ? 1 : 2,
        phase: currentPhase,   // alias for currentPhase — used by client
        interventionTitle: currentInterventionTitle,
        interventionContent: currentInterventionContent,
      };
      socket.emit("scheduler-state", state);
    });

    // ── Submit Prediction ────────────────────────────────────
    socket.on("submit-prediction", async (data: { stockId: number; predictedPrice: number; userId: number }) => {
      const { stockId, predictedPrice, userId } = data;
      if (!activeRoundDbId || currentPhase !== "PRE_MARKET") {
        socket.emit("prediction-error", { message: "Bukan fase prediksi saat ini" }); return;
      }
      const stock = activeStocks.find(s => s.id === stockId);
      if (!stock) { socket.emit("prediction-error", { message: "Saham tidak valid" }); return; }

      if (!activePredictions[stockId]) activePredictions[stockId] = [];
      activePredictions[stockId].push({ userId, predictedPrice });

      await db.insert(predictions).values({
        userId, stockId, roundId: activeRoundDbId, tebakanHarga: String(predictedPrice),
      });
      socket.emit("prediction-saved", { stockId, predictedPrice, count: activePredictions[stockId].length });
    });

    // ── Place Order ──────────────────────────────────────────
    socket.on("place-order", async (data: { stockId: number; tipe: "BID" | "ASK"; harga: number; jumlah: number; userId: number }) => {
      const { stockId, tipe, harga, jumlah, userId } = data;

      if (!activeRoundDbId) { socket.emit("order-error", { message: "Tidak ada ronde aktif" }); return; }
      if (currentPhase !== "TRADING") {
        socket.emit("order-error", { message: "Perdagangan belum dibuka. Tunggu fase Perdagangan." }); return;
      }
      const stock = activeStocks.find(s => s.id === stockId);
      if (!stock) { socket.emit("order-error", { message: "Saham tidak valid untuk ronde ini" }); return; }

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) { socket.emit("order-error", { message: "User tidak ditemukan" }); return; }

      const totalCost = harga * jumlah * 100;
      const saldo = Number(user.saldo) || 0;

      if (tipe === "BID") {
        const openBids = await db.select().from(orderBook)
          .where(and(eq(orderBook.userId, userId), eq(orderBook.roundId, activeRoundDbId), eq(orderBook.status, "open"), eq(orderBook.tipe, "BID")));
        const locked = openBids.reduce((s, o) => s + Number(o.harga) * o.jumlah * 100, 0);
        if (saldo - locked < totalCost) {
          socket.emit("order-error", { message: `Saldo tidak mencukupi. Tersedia: Rp ${(saldo - locked).toLocaleString("id-ID")}, dibutuhkan: Rp ${totalCost.toLocaleString("id-ID")}` });
          return;
        }
      }

      if (tipe === "ASK") {
        const [portfolio] = await db.select().from(portfolios)
          .where(and(eq(portfolios.userId, userId), eq(portfolios.stockId, stockId), eq(portfolios.roundId, activeRoundDbId))).limit(1);
        const owned = portfolio ? portfolio.jumlahLot : 0;
        const openAsks = await db.select().from(orderBook)
          .where(and(eq(orderBook.userId, userId), eq(orderBook.roundId, activeRoundDbId), eq(orderBook.stockId, stockId), eq(orderBook.status, "open"), eq(orderBook.tipe, "ASK")));
        const lockedLots = openAsks.reduce((s, o) => s + o.jumlah, 0);
        if (owned - lockedLots < jumlah) {
          socket.emit("order-error", { message: `Lot tidak mencukupi. Tersedia: ${owned - lockedLots} lot, dibutuhkan: ${jumlah} lot` });
          return;
        }
      }

      const [order] = await db.insert(orderBook).values({
        userId, stockId, roundId: activeRoundDbId,
        subSession: currentPhase === "TRADING" ? 2 : 1,
        tipe, harga: String(harga), jumlah, status: "open",
        activeIntervention: currentIntervention,
      }).returning();

      const orderObj: OrderType = { id: order.id, userId, stockId, tipe, harga, jumlah };
      if (!activeOrderBooks[stockId]) activeOrderBooks[stockId] = { bids: [], asks: [] };
      if (tipe === "BID") activeOrderBooks[stockId].bids.push(orderObj);
      else activeOrderBooks[stockId].asks.push(orderObj);

      socket.emit("order-placed", { orderId: order.id, stockId, tipe, harga, jumlah });
      emitOrderBookUpdate(stockId);
    });

    // ── Cancel Order ──────────────────────────────────────────
    socket.on("cancel-order", async (data: { orderId: number; userId: number }) => {
      const { orderId, userId } = data;
      const [order] = await db.select().from(orderBook)
        .where(and(eq(orderBook.id, orderId), eq(orderBook.userId, userId))).limit(1);
      if (!order || order.status !== "open") {
        socket.emit("order-error", { message: "Order tidak ditemukan atau sudah ditutup" }); return;
      }
      await db.delete(orderBook).where(eq(orderBook.id, orderId));
      const book = activeOrderBooks[order.stockId];
      if (book) {
        if (order.tipe === "BID") { const i = book.bids.findIndex(o => o.id === orderId); if (i !== -1) book.bids.splice(i, 1); }
        else { const i = book.asks.findIndex(o => o.id === orderId); if (i !== -1) book.asks.splice(i, 1); }
        emitOrderBookUpdate(order.stockId);
      }
      socket.emit("order-cancelled", { orderId });
    });

    // ── Get Portfolio ─────────────────────────────────────────
    socket.on("get-portfolio", async (data: { userId: number }) => {
      const portfolio = await db.select({
        stockId: portfolios.stockId, kode: stocks.kodeSaham,
        nama: stocks.namaSaham, jumlahLot: portfolios.jumlahLot,
        avgPrice: portfolios.averagePrice,
      }).from(portfolios).innerJoin(stocks, eq(portfolios.stockId, stocks.id))
        .where(eq(portfolios.userId, data.userId));
      socket.emit("portfolio-data", {
        portfolio: portfolio.map(p => ({ stockId: p.stockId, stockCode: p.kode, namaSaham: p.nama, jumlahLot: p.jumlahLot, currentValue: Number(p.avgPrice) * p.jumlahLot * 100 })),
      });
    });

    // ── Get Stock Portfolio ───────────────────────────────────
    socket.on("get-stock-portfolio", async (data: { userId: number; stockId: number }) => {
      await emitPortfolioUpdate(data.userId, data.stockId);
    });

    // ── Get Trade History ─────────────────────────────────────
    socket.on("get-trade-history", async (data: { stockId: number }) => {
      const { stockId } = data;
      if (!activeRoundDbId) { socket.emit("trade-history", { stockId, trades: [] }); return; }
      try {
        const trades = await db.select({ id: transactionsHistory.id, harga: transactionsHistory.harga, jumlah: transactionsHistory.jumlah, createdAt: transactionsHistory.createdAt })
          .from(transactionsHistory)
          .where(and(eq(transactionsHistory.stockId, stockId), eq(transactionsHistory.roundId, activeRoundDbId)))
          .orderBy(transactionsHistory.createdAt);
        socket.emit("trade-history", {
          stockId,
          trades: trades.map(t => ({
            time: new Date(t.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            price: Number(t.harga), quantity: t.jumlah,
          })),
          openingPrice: activeOpeningPrices[stockId] ?? null,
        });
      } catch (err) {
        socket.emit("trade-history", { stockId, trades: [] });
      }
    });

    // ── Join Round Room ───────────────────────────────────────
    socket.on("join-round", (roundNumber: number) => {
      if (activeRoundDbId) socket.join(`session:${activeRoundDbId}`);
    });

    // ── Disconnect ────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log("[Scheduler] Experimental State Machine v2 — 3 Periods loaded");
    PERIOD_MATRIX.forEach(p => {
      console.log(`  Period ${p.periodNumber}: ${p.sessions.length} session(s), ${p.sessions.reduce((acc, s) => acc + s.rounds.length, 0)} total rounds`);
    });
  });
});
