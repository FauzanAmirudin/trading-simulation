import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { db } from "./src/db/connect";
import {
  users,
  stocks,
  rounds,
  roundStocks,
  predictions,
  orderBook,
  transactionsHistory,
  portfolios,
  experimentalConfig,
} from "./src/db/schema";
import {
  eq,
  and,
  sql,
  inArray,
} from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  EXPERIMENTAL_MATRIX,
  getRoundConfig,
  getCurrentSessionConfig,
  InterventionType,
  SubSessionPhase,
  DURATIONS,
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
  id: number;
  userId: number;
  stockId: number;
  tipe: string;
  harga: number;
  jumlah: number;
};

// ============================================================
// IN-MEMORY STATE
// ============================================================

// --- Round-level state ---
let activeRound: number | null = null;
let activeSubSession: 1 | 2 | 3 | 4 = 1;
let currentIntervention: InterventionType = "NONE";
let isPaused = false;

// --- Scheduler timers ---
let schedulerTimeout: NodeJS.Timeout | null = null;
let tickInterval: NodeJS.Timeout | null = null;

// --- Intervention content cache (loaded from DB at startup) ---
let interventionCache: Record<string, { title: string; content: string }> = {};

// --- Per-round in-memory data ---
interface RoundData {
  roundId: number;
  stocks: { id: number; kodeSaham: string; namaSaham: string; basePrice: number }[];
  openingPrices: Record<number, number>; // stockId -> equilibrium price
  orderBooks: Record<number, { bids: OrderType[]; asks: OrderType[] }>;
  timer: number; // seconds remaining
  subSession: 1 | 2 | 3 | 4;
  phase: SubSessionPhase;
  pendingPredictions: Record<number, { userId: number; predictedPrice: number }[]>;
}

let roundData: Record<number, RoundData> = {};

// ============================================================
// INTERVENTION CACHE
// ============================================================
async function loadInterventionCache() {
  try {
    const rows = await db.select().from(experimentalConfig);
    rows.forEach(row => {
      interventionCache[row.key] = { title: row.title, content: row.content };
    });
    console.log("[Scheduler] Intervention cache loaded:", Object.keys(interventionCache));
  } catch (err) {
    console.warn("[Scheduler] Could not load intervention cache:", err);
  }
}

// ============================================================
// STATE MACHINE — CORE
// ============================================================

/**
 * Start a specific round. Initializes round data, loads stocks, and begins Sesi 1 (PRE_OPENING).
 */
async function startRound(roundNumber: number) {
  const config = getRoundConfig(roundNumber);

  // Check if intervention content is configured for Period II/III
  if (roundNumber >= 5) {
    const neededKeys = config.sessions
      .filter(s => s.intervention !== "NONE")
      .map(s => s.intervention);

    const missing = neededKeys.filter(k => !interventionCache[k]);
    if (missing.length > 0) {
      console.warn(`[Scheduler] Round ${roundNumber} needs interventions: ${missing.join(", ")} — not configured yet`);
    }
  }

  // Load round from DB
  const [roundRow] = await db
    .select()
    .from(rounds)
    .where(eq(rounds.roundNumber, roundNumber))
    .limit(1);

  if (!roundRow) {
    console.error(`[Scheduler] Round ${roundNumber} not found in DB`);
    return;
  }

  // Load stocks for this round
  const stockRows = await db
    .select({
      id: stocks.id,
      kodeSaham: stocks.kodeSaham,
      namaSaham: stocks.namaSaham,
      basePrice: stocks.basePrice,
    })
    .from(roundStocks)
    .innerJoin(stocks, eq(roundStocks.stockId, stocks.id))
    .where(eq(roundStocks.roundId, roundRow.id))
    .orderBy(roundStocks.slot);

  if (stockRows.length === 0) {
    console.error(`[Scheduler] No stocks configured for round ${roundNumber}`);
    return;
  }

  // Initialize in-memory round data
  activeRound = roundNumber;
  activeSubSession = 1;
  currentIntervention = "NONE";
  isPaused = false;

  roundData[roundNumber] = {
    roundId: roundRow.id,
    stocks: stockRows,
    openingPrices: {},
    orderBooks: Object.fromEntries(stockRows.map(s => [s.id, { bids: [], asks: [] }])),
    timer: DURATIONS.PRE_OPENING,
    subSession: 1,
    phase: "PRE_OPENING",
    pendingPredictions: Object.fromEntries(stockRows.map(s => [s.id, []])),
  };

  // Update DB
  await db
    .update(rounds)
    .set({
      status: "active",
      subSessionStatus: "PRE_OPENING",
      activeSubSession: 1,
      activeIntervention: "NONE",
      startTime: new Date(),
    })
    .where(eq(rounds.id, roundRow.id));

  // Start tick interval
  startTickInterval();

  // Emit round started to ALL connected clients
  io.emit("round-started", {
    roundNumber,
    period: config.period,
    periodLabel: config.periodLabel,
    stocks: stockRows.map(s => ({ id: s.id, kode: s.kodeSaham, nama: s.namaSaham })),
  });

  // Start Sesi 1: PRE_OPENING
  await startSubSession(roundNumber, 1);

  console.log(`[Scheduler] Round ${roundNumber} started — PRE_OPENING phase`);
}

/**
 * Start a specific sub-session within the current active round.
 */
async function startSubSession(roundNumber: number, sessionNumber: 1 | 2 | 3 | 4) {
  const config = getCurrentSessionConfig(roundNumber, sessionNumber);

  // Update round data
  const rd = roundData[roundNumber];
  rd.subSession = sessionNumber;
  rd.phase = config.phase;
  rd.timer = config.durationSeconds;
  activeSubSession = sessionNumber;

  // Update DB
  const [roundRow] = await db
    .select()
    .from(rounds)
    .where(eq(rounds.roundNumber, roundNumber))
    .limit(1);

  await db
    .update(rounds)
    .set({
      subSessionStatus: config.phase,
      activeSubSession: sessionNumber,
      activeIntervention: config.intervention,
    })
    .where(eq(rounds.id, roundRow.id));

  // Broadcast session transition to all in this round
  io.emit("sub-session-started", {
    roundNumber,
    sessionNumber,
    phase: config.phase,
    duration: config.durationSeconds,
    intervention: config.intervention,
    label: config.label,
  });

  console.log(`[Scheduler] Round ${roundNumber} Sesi ${sessionNumber} started — ${config.phase} (intervention: ${config.intervention})`);

  // Trigger intervention if applicable (Sesi 2, 3, or 4 with non-NONE intervention)
  if (config.intervention !== "NONE") {
    await triggerIntervention(config.intervention, roundNumber);
  }
}

/**
 * Called when a sub-session timer expires. Advances to next sub-session or ends round.
 */
async function onSubSessionExpiry(roundNumber: number, sessionNumber: 1 | 2 | 3 | 4) {
  const config = getCurrentSessionConfig(roundNumber, sessionNumber);

  // Emit sub-session ended
  io.emit("sub-session-ended", { roundNumber, sessionNumber, phase: config.phase });

  console.log(`[Scheduler] Round ${roundNumber} Sesi ${sessionNumber} ended`);

  if (sessionNumber === 1) {
    // PRE_OPENING ended — calculate opening prices, then start TRADING_S2
    await calculateOpeningPrices(roundNumber);
    await startSubSession(roundNumber, 2);
  } else if (sessionNumber < 4) {
    // Close order book for current trading session, move to next
    await startSubSession(roundNumber, (sessionNumber + 1) as 2 | 3 | 4);
  } else {
    // Sesi 4 ended — end the round
    await endRound(roundNumber);
  }
}

/**
 * Trigger an intervention event to all clients.
 */
async function triggerIntervention(type: InterventionType, roundNumber: number) {
  if (type === "NONE") return;

  currentIntervention = type;

  // Update DB intervention on all open orders
  const rd = roundData[roundNumber];
  if (rd) {
    const [roundRow] = await db
      .select()
      .from(rounds)
      .where(eq(rounds.roundNumber, roundNumber))
      .limit(1);

    await db
      .update(orderBook)
      .set({ activeIntervention: type })
      .where(
        and(
          eq(orderBook.roundId, roundRow.id),
          eq(orderBook.subSession, rd.subSession),
          eq(orderBook.status, "open")
        )
      );
  }

  const content = interventionCache[type] || {
    title: type.replace("_", " "),
    content: `Intervensi ${type} sedang aktif.`,
  };

  // Emit to ALL clients (everyone in the experiment)
  io.emit("intervention-triggered", {
    type,
    title: content.title,
    content: content.content,
    roundNumber,
    sessionNumber: rd?.subSession,
    timestamp: new Date().toISOString(),
  });

  console.log(`[Scheduler] INTERVENTION TRIGGERED: ${type} (Round ${roundNumber}, Sesi ${rd?.subSession})`);
}

/**
 * End a round, emit results, and schedule the next round or experiment end.
 */
async function endRound(roundNumber: number) {
  activeRound = null;
  activeSubSession = 1;
  currentIntervention = "NONE";

  stopTickInterval();

  // Update DB
  const [roundRow] = await db
    .select()
    .from(rounds)
    .where(eq(rounds.roundNumber, roundNumber))
    .limit(1);

  await db
    .update(rounds)
    .set({
      status: "closed",
      subSessionStatus: "CLOSED",
      endTime: new Date(),
    })
    .where(eq(rounds.id, roundRow.id));

  // Clear order books
  await db
    .update(orderBook)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(orderBook.roundId, roundRow.id),
        eq(orderBook.status, "open")
      )
    );

  // Emit round ended
  io.emit("round-ended", {
    roundNumber,
    openingPrices: roundData[roundNumber]?.openingPrices || {},
  });

  // Clean up in-memory data
  delete roundData[roundNumber];

  console.log(`[Scheduler] Round ${roundNumber} ended`);

  if (roundNumber < 12) {
    // Schedule next round after cooldown
    console.log(`[Scheduler] Next round in ${DURATIONS.ROUND_COOLDOWN}s...`);
    io.emit("round-cooldown-started", {
      nextRound: roundNumber + 1,
      cooldownSeconds: DURATIONS.ROUND_COOLDOWN,
    });

    schedulerTimeout = setTimeout(() => {
      startRound(roundNumber + 1);
    }, DURATIONS.ROUND_COOLDOWN * 1000);
  } else {
    // Experiment complete
    io.emit("experiment-ended", {});
    console.log("[Scheduler] EXPERIMENT COMPLETE — All 12 rounds finished");
  }
}

/**
 * Calculate equilibrium opening price per stock from predictions (median).
 */
async function calculateOpeningPrices(roundNumber: number) {
  const rd = roundData[roundNumber];
  if (!rd) return;

  const [roundRow] = await db
    .select()
    .from(rounds)
    .where(eq(rounds.roundNumber, roundNumber))
    .limit(1);

  const openingPrices: Record<number, number> = {};

  for (const stock of rd.stocks) {
    const preds = rd.pendingPredictions[stock.id] || [];
    if (preds.length === 0) {
      // Fallback: use base price
      openingPrices[stock.id] = Number(stock.basePrice);
    } else {
      // Median equilibrium price
      const sorted = preds.map(p => p.predictedPrice).sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      openingPrices[stock.id] =
        sorted.length % 2 !== 0
          ? sorted[mid]
          : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
  }

  rd.openingPrices = openingPrices;

  // Save to DB
  await db
    .update(rounds)
    .set({ openingPrices: JSON.parse(JSON.stringify(openingPrices)) })
    .where(eq(rounds.id, roundRow.id));

  // Emit opening prices
  io.emit("opening-prices-calculated", {
    roundNumber,
    prices: rd.stocks.map(s => ({
      stockId: s.id,
      kode: s.kodeSaham,
      price: openingPrices[s.id],
    })),
  });

  console.log(`[Scheduler] Opening prices calculated:`, openingPrices);
}

// ============================================================
// SERVER-SIDE TICK — runs every second
// ============================================================
function startTickInterval() {
  if (tickInterval) clearInterval(tickInterval);

  tickInterval = setInterval(() => {
    if (activeRound === null || isPaused) return;

    const rd = roundData[activeRound];
    if (!rd) return;

    rd.timer = Math.max(0, rd.timer - 1);

    // Broadcast timer update
    io.emit("timer-tick", {
      roundNumber: activeRound,
      sessionNumber: rd.subSession,
      timeLeft: rd.timer,
    });

    if (rd.timer <= 0) {
      // Sub-session expired — advance state
      const currentSession = rd.subSession;
      stopTickInterval();
      // Use setImmediate to avoid calling startSubSession inside the tick interval
      setImmediate(() => {
        onSubSessionExpiry(activeRound!, currentSession);
      });
    }
  }, 1000);
}

function stopTickInterval() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

// ============================================================
// MATCHING ENGINE — processes BID/ASK matches every 500ms
// ============================================================
const MATCHING_ENGINE_INTERVAL = 500;

async function runMatchingEngine() {
  setInterval(async () => {
    if (activeRound === null || isPaused) return;

    const rd = roundData[activeRound];
    if (!rd) return;
    if (rd.phase === "PRE_OPENING") return; // No trading during prediction phase

    const [roundRow] = await db
      .select()
      .from(rounds)
      .where(eq(rounds.roundNumber, activeRound))
      .limit(1);

    if (!roundRow || rd.phase === "PENDING" || rd.phase === "CLOSED") return;

    for (const stock of rd.stocks) {
      const book = rd.orderBooks[stock.id];
      if (!book) continue;

      // Sort bids descending (highest first), asks ascending (lowest first)
      book.bids.sort((a, b) => b.harga - a.harga);
      book.asks.sort((a, b) => a.harga - b.harga);

      let changed = false;
      while (book.bids.length > 0 && book.asks.length > 0) {
        const highestBid = book.bids[0];
        const lowestAsk = book.asks[0];

        if (highestBid.harga >= lowestAsk.harga) {
          const matchPrice = lowestAsk.harga;
          await executeTrade(activeRound, rd.subSession, stock.id, highestBid, lowestAsk, matchPrice, roundRow.id);
          changed = true;
        } else {
          break;
        }
      }

      if (changed) {
        emitOrderBookUpdate(activeRound, stock.id);
      }
    }
  }, MATCHING_ENGINE_INTERVAL);
}

async function executeTrade(
  roundNumber: number,
  subSession: 1 | 2 | 3 | 4,
  stockId: number,
  bidOrder: OrderType,
  askOrder: OrderType,
  price: number,
  roundId: number
) {
  const quantity = Math.min(bidOrder.jumlah, askOrder.jumlah);
  if (quantity <= 0) return;

  // Update in-memory order book
  const rd = roundData[roundNumber];
  const book = rd?.orderBooks[stockId];
  if (book) {
    bidOrder.jumlah -= quantity;
    askOrder.jumlah -= quantity;

    if (bidOrder.jumlah <= 0) {
      const i = book.bids.findIndex(o => o.id === bidOrder.id);
      if (i !== -1) book.bids.splice(i, 1);
    }
    if (askOrder.jumlah <= 0) {
      const i = book.asks.findIndex(o => o.id === askOrder.id);
      if (i !== -1) book.asks.splice(i, 1);
    }
  }

  const total = price * quantity * 100;

  try {
    await db.transaction(async (tx) => {
      // Deduct from buyer, credit to seller
      await tx
        .update(users)
        .set({ saldo: sql`saldo - ${total}` })
        .where(eq(users.id, bidOrder.userId));

      await tx
        .update(users)
        .set({ saldo: sql`saldo + ${total}` })
        .where(eq(users.id, askOrder.userId));

      // Update buyer portfolio
      const [buyerPortfolio] = await tx
        .select()
        .from(portfolios)
        .where(and(eq(portfolios.userId, bidOrder.userId), eq(portfolios.stockId, stockId)))
        .limit(1);

      if (buyerPortfolio) {
        const newLots = buyerPortfolio.jumlahLot + quantity;
        const avgPrice = Number(buyerPortfolio.averagePrice) || 0;
        const newAvg = Math.round(((avgPrice * buyerPortfolio.jumlahLot) + (price * quantity)) / newLots);
        await tx
          .update(portfolios)
          .set({ jumlahLot: newLots, averagePrice: String(newAvg) })
          .where(eq(portfolios.id, buyerPortfolio.id));
      } else {
        await tx.insert(portfolios).values({
          userId: bidOrder.userId,
          stockId,
          roundId,
          jumlahLot: quantity,
          averagePrice: String(price),
        });
      }

      // Update seller portfolio
      const [sellerPortfolio] = await tx
        .select()
        .from(portfolios)
        .where(and(eq(portfolios.userId, askOrder.userId), eq(portfolios.stockId, stockId)))
        .limit(1);

      if (sellerPortfolio) {
        const newLots = sellerPortfolio.jumlahLot - quantity;
        if (newLots === 0) {
          await tx.delete(portfolios).where(eq(portfolios.id, sellerPortfolio.id));
        } else {
          await tx
            .update(portfolios)
            .set({ jumlahLot: newLots })
            .where(eq(portfolios.id, sellerPortfolio.id));
        }
      }

      // Record transaction — IMPORTANT: tag with active intervention
      await tx.insert(transactionsHistory).values({
        orderBuyId: bidOrder.id,
        orderSellId: askOrder.id,
        stockId,
        roundId,
        subSession,
        harga: String(price),
        jumlah: quantity,
        total: String(total),
        activeIntervention: currentIntervention,
      });
    });

    // Emit trade to all clients
    io.to(`session:${roundNumber}`).emit("trade-executed", {
      roundNumber,
      subSession,
      stockId,
      price,
      quantity,
      buyerId: bidOrder.userId,
      sellerId: askOrder.userId,
      activeIntervention: currentIntervention,
      timestamp: new Date().toISOString(),
    });

    // Emit updated balances
    await emitBalanceUpdate(bidOrder.userId);
    await emitBalanceUpdate(askOrder.userId);

  } catch (error) {
    console.error("[MatchingEngine] Trade execution error:", error);
  }
}

function emitOrderBookUpdate(roundNumber: number, stockId: number) {
  const rd = roundData[roundNumber];
  if (!rd) return;

  const book = rd.orderBooks[stockId];
  if (!book) return;

  const bids = [...book.bids].sort((a, b) => b.harga - a.harga).slice(0, 10);
  const asks = [...book.asks].sort((a, b) => a.harga - b.harga).slice(0, 10);

  io.emit("order-book-update", {
    roundNumber,
    stockId,
    bids: bids.map(o => ({ id: o.id, harga: o.harga, jumlah: o.jumlah, userId: o.userId })),
    asks: asks.map(o => ({ id: o.id, harga: o.harga, jumlah: o.jumlah, userId: o.userId })),
  });
}

async function emitBalanceUpdate(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user) {
    io.to(`user:${userId}`).emit("balance-update", {
      userId: user.id,
      balance: Number(user.saldo),
    });
  }
}

// ============================================================
// SOCKET.IO CONNECTION HANDLER
// ============================================================
app.prepare().then(() => {
  const httpServer = createServer(handler);
  io = new Server(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : "https://yourdomain.com",
      methods: ["GET", "POST"],
    },
  });

  // Load intervention cache at startup
  loadInterventionCache();

  io.on("connection", (socket) => {
    console.log("[Socket] Client connected:", socket.id);

    // ── Authentication ─────────────────────────────────────
    socket.on("authenticate", async (data: { nama?: string; password?: string; userId?: number }) => {
      const { nama, password, userId } = data;

      try {
        let user: { id: number; nama: string; role: string; saldo: string } | undefined;

        if (userId) {
          const [result] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          user = result;
        } else if (nama && password) {
          const [result] = await db.select().from(users).where(eq(users.nama, nama)).limit(1);
          if (result && result.password) {
            const valid = await bcrypt.compare(password, result.password);
            if (valid) user = result;
          }
        }

        if (!user) {
          socket.emit("auth-error", { message: "Invalid credentials" });
          return;
        }

        socket.data.userId = user.id;
        socket.data.userRole = user.role;
        socket.join(`user:${user.id}`);

        socket.emit("auth-success", {
          user: { id: user.id, nama: user.nama, role: user.role, saldo: Number(user.saldo) },
        });

        // If a round is active, join the session room
        if (activeRound !== null) {
          socket.join(`session:${activeRound}`);
          const rd = roundData[activeRound];
          if (rd) {
            socket.emit("round-started", {
              roundNumber: activeRound,
              period: Math.ceil(activeRound / 4),
              stocks: rd.stocks.map(s => ({ id: s.id, kode: s.kodeSaham, nama: s.namaSaham })),
            });
            socket.emit("sub-session-started", {
              roundNumber: activeRound,
              sessionNumber: rd.subSession,
              phase: rd.phase,
              duration: rd.timer,
              intervention: currentIntervention,
            });
            socket.emit("timer-tick", {
              roundNumber: activeRound,
              sessionNumber: rd.subSession,
              timeLeft: rd.timer,
            });
            if (rd.openingPrices && Object.keys(rd.openingPrices).length > 0) {
              socket.emit("opening-prices-calculated", {
                roundNumber: activeRound,
                prices: rd.stocks.map(s => ({
                  stockId: s.id,
                  kode: s.kodeSaham,
                  price: rd.openingPrices[s.id],
                })),
              });
            }
          }
        }

        // Send intervention cache to client for display
        socket.emit("intervention-cache-loaded", interventionCache);

      } catch (error) {
        console.error("[Socket] Auth error:", error);
        socket.emit("auth-error", { message: "Authentication failed" });
      }
    });

    // ── Admin: Start Round ──────────────────────────────────
    socket.on("admin-start-round", async (data: { roundNumber: number; stockIds: number[] }) => {
      if (socket.data.userRole !== "admin") {
        socket.emit("admin-error", { message: "Unauthorized" });
        return;
      }

      const { roundNumber, stockIds } = data;

      // Validate round number
      if (roundNumber < 1 || roundNumber > 12) {
        socket.emit("admin-error", { message: "Invalid round number" });
        return;
      }

      // Assign stocks to round in DB (3 stocks required)
      if (stockIds && stockIds.length > 0) {
        const [roundRow] = await db
          .select()
          .from(rounds)
          .where(eq(rounds.roundNumber, roundNumber))
          .limit(1);

        if (roundRow) {
          // Remove existing stock assignments
          await db.delete(roundStocks).where(eq(roundStocks.roundId, roundRow.id));

          // Assign new stocks
          for (let i = 0; i < Math.min(stockIds.length, 3); i++) {
            await db.insert(roundStocks).values({
              roundId: roundRow.id,
              stockId: stockIds[i],
              slot: i + 1,
            });
          }
        }
      }

      await startRound(roundNumber);
    });

    // ── Admin: Pause ───────────────────────────────────────
    socket.on("admin-pause", async () => {
      if (socket.data.userRole !== "admin") return;
      isPaused = true;
      io.emit("experiment-paused", {});
      console.log("[Scheduler] Experiment paused");
    });

    // ── Admin: Resume ─────────────────────────────────────
    socket.on("admin-resume", async () => {
      if (socket.data.userRole !== "admin") return;
      isPaused = false;
      io.emit("experiment-resumed", {});
      console.log("[Scheduler] Experiment resumed");
    });

    // ── Admin: Force Intervention (override) ─────────────
    socket.on("admin-force-intervention", async (data: { type: InterventionType }) => {
      if (socket.data.userRole !== "admin") return;
      if (activeRound === null) return;
      await triggerIntervention(data.type, activeRound);
    });

    // ── Admin: Get Scheduler State ────────────────────────
    socket.on("get-scheduler-state", async () => {
      if (socket.data.userRole !== "admin") return;

      const rd = activeRound !== null ? roundData[activeRound] : null;
      const [activeRoundRow] = activeRound !== null
        ? await db.select().from(rounds).where(eq(rounds.roundNumber, activeRound)).limit(1)
        : [null];

      socket.emit("scheduler-state", {
        activeRound,
        activeSubSession: rd?.subSession || null,
        phase: rd?.phase || null,
        timeLeft: rd?.timer || 0,
        currentIntervention,
        isPaused,
        openingPrices: rd?.openingPrices || {},
        stocks: rd?.stocks || [],
        interventionCache,
      });
    });

    // ── Submit Prediction (PRE_OPENING phase) ─────────────
    socket.on("submit-prediction", async (data: {
      stockId: number;
      predictedPrice: number;
      userId: number;
    }) => {
      const { stockId, predictedPrice, userId } = data;

      if (activeRound === null) {
        socket.emit("prediction-error", { message: "No active round" });
        return;
      }

      const rd = roundData[activeRound];
      if (rd.phase !== "PRE_OPENING") {
        socket.emit("prediction-error", { message: "Prediction phase has ended" });
        return;
      }

      const stock = rd.stocks.find(s => s.id === stockId);
      if (!stock) {
        socket.emit("prediction-error", { message: "Invalid stock" });
        return;
      }

      // Store in memory
      if (!rd.pendingPredictions[stockId]) {
        rd.pendingPredictions[stockId] = [];
      }
      rd.pendingPredictions[stockId].push({ userId, predictedPrice });

      // Persist to DB
      const [roundRow] = await db
        .select()
        .from(rounds)
        .where(eq(rounds.roundNumber, activeRound))
        .limit(1);

      await db.insert(predictions).values({
        userId,
        stockId,
        roundId: roundRow.id,
        tebakanHarga: String(predictedPrice),
      });

      socket.emit("prediction-saved", {
        stockId,
        predictedPrice,
        count: rd.pendingPredictions[stockId].length,
      });

      // Notify admin of prediction count
      io.to("admin").emit("prediction-count-update", {
        roundNumber: activeRound,
        stockId,
        count: rd.pendingPredictions[stockId].length,
      });
    });

    // ── Place Order (TRADING phases) ───────────────────────
    socket.on("place-order", async (data: {
      stockId: number;
      tipe: "BID" | "ASK";
      harga: number;
      jumlah: number;
      userId: number;
    }) => {
      const { stockId, tipe, harga, jumlah, userId } = data;

      if (activeRound === null) {
        socket.emit("order-error", { message: "No active round" });
        return;
      }

      const rd = roundData[activeRound];
      if (!["TRADING_S2", "TRADING_S3", "TRADING_S4"].includes(rd.phase)) {
        socket.emit("order-error", { message: "Trading is not open" });
        return;
      }

      const stock = rd.stocks.find(s => s.id === stockId);
      if (!stock) {
        socket.emit("order-error", { message: "Invalid stock for this round" });
        return;
      }

      // Validate balance / holdings
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        socket.emit("order-error", { message: "User not found" });
        return;
      }

      const totalCost = harga * jumlah * 100;
      const saldo = Number(user.saldo) || 0;

      if (tipe === "BID" && saldo < totalCost) {
        socket.emit("order-error", { message: "Insufficient balance" });
        return;
      }

      if (tipe === "ASK") {
        const [portfolio] = await db
          .select()
          .from(portfolios)
          .where(and(eq(portfolios.userId, userId), eq(portfolios.stockId, stockId)))
          .limit(1);
        if (!portfolio || portfolio.jumlahLot < jumlah) {
          socket.emit("order-error", { message: "Insufficient stock holdings" });
          return;
        }
      }

      // Persist order
      const [roundRow] = await db
        .select()
        .from(rounds)
        .where(eq(rounds.roundNumber, activeRound))
        .limit(1);

      const [order] = await db.insert(orderBook).values({
        userId,
        stockId,
        roundId: roundRow.id,
        subSession: rd.subSession,
        tipe,
        harga: String(harga),
        jumlah,
        status: "open",
        activeIntervention: currentIntervention,
      }).returning();

      // Add to in-memory order book
      const orderObj: OrderType = {
        id: order.id,
        userId: order.userId,
        stockId: order.stockId,
        tipe: order.tipe,
        harga: Number(order.harga),
        jumlah: order.jumlah,
      };

      if (!rd.orderBooks[stockId]) rd.orderBooks[stockId] = { bids: [], asks: [] };
      if (tipe === "BID") {
        rd.orderBooks[stockId].bids.push(orderObj);
      } else {
        rd.orderBooks[stockId].asks.push(orderObj);
      }

      socket.emit("order-placed", { orderId: order.id, stockId, tipe, harga, jumlah });
      emitOrderBookUpdate(activeRound, stockId);
    });

    // ── Cancel Order ───────────────────────────────────────
    socket.on("cancel-order", async (data: { orderId: number; userId: number }) => {
      const { orderId, userId } = data;

      const [order] = await db
        .select()
        .from(orderBook)
        .where(and(eq(orderBook.id, orderId), eq(orderBook.userId, userId)))
        .limit(1);

      if (!order || order.status !== "open") {
        socket.emit("order-error", { message: "Order not found or already closed" });
        return;
      }

      await db.delete(orderBook).where(eq(orderBook.id, orderId));

      if (activeRound !== null) {
        const rd = roundData[activeRound];
        if (rd?.orderBooks[order.stockId]) {
          const book = rd.orderBooks[order.stockId];
          if (order.tipe === "BID") {
            const i = book.bids.findIndex(o => o.id === orderId);
            if (i !== -1) book.bids.splice(i, 1);
          } else {
            const i = book.asks.findIndex(o => o.id === orderId);
            if (i !== -1) book.asks.splice(i, 1);
          }
          emitOrderBookUpdate(activeRound, order.stockId);
        }
      }

      socket.emit("order-cancelled", { orderId });
    });

    // ── Get Portfolio ─────────────────────────────────────
    socket.on("get-portfolio", async (data: { userId: number }) => {
      const { userId } = data;
      const portfolio = await db
        .select({
          stockId: portfolios.stockId,
          kode: stocks.kodeSaham,
          nama: stocks.namaSaham,
          jumlahLot: portfolios.jumlahLot,
          avgPrice: portfolios.averagePrice,
        })
        .from(portfolios)
        .innerJoin(stocks, eq(portfolios.stockId, stocks.id))
        .where(eq(portfolios.userId, userId));

      socket.emit("portfolio-data", {
        portfolio: portfolio.map(p => ({
          stockId: p.stockId,
          kode: p.kode,
          nama: p.nama,
          jumlahLot: p.jumlahLot,
          avgPrice: p.avgPrice,
        })),
      });
    });

    // ── Join Round Room ───────────────────────────────────
    socket.on("join-round", (roundNumber: number) => {
      socket.join(`session:${roundNumber}`);
    });

    // ── Disconnect ────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log("[Socket] Client disconnected:", socket.id);
    });
  });

  // Start matching engine
  runMatchingEngine();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log("[Scheduler] Experimental Design Matrix loaded — 12 rounds, 3 periods");
  });
});
