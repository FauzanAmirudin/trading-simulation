import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { db } from "./src/db/connect";
import { users, stocks, sessions, predictions, orderBook, transactionsHistory, portfolios } from "./src/db/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

let io: import("socket.io").Server;

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// In-memory stores for active session data
let activeSession: number | null = null;
let sessionPredictions: Record<number, Record<number, number[]>> = {};
let sessionStockPrices: Record<number, Record<number, number>> = {};
let orderBooks: Record<number, Record<number, { bids: OrderType[]; asks: OrderType[] }>> = {};
let sessionTimers: Record<number, number> = {};

// Types
type OrderType = {
  id: number;
  userId: number;
  stockId: number;
  tipe: string;
  harga: number;
  jumlah: number;
};

// Matching engine constants
const MATCHING_ENGINE_INTERVAL = 500; // ms
const PREDICTION_TIMEOUT = 30; // seconds for prediction phase
const TRADING_PHASE_DURATION = 120; // seconds for trading phase (2 minutes)

// Initialize default session data
function initializeSession(sessionId: number) {
  activeSession = sessionId;
  sessionPredictions[sessionId] = {};
  sessionStockPrices[sessionId] = {};
  orderBooks[sessionId] = {};
  sessionTimers[sessionId] = TRADING_PHASE_DURATION;
  
  // Initialize order books for all stocks
  db.select().from(stocks).then((stockRows) => {
    stockRows.forEach((stock) => {
      orderBooks[sessionId][stock.id] = {
        bids: [],
        asks: []
      };
    });
  });
}

// Calculate average prediction for a stock
function calculateOpeningPrice(sessionId: number, stockId: number) {
  const prices = sessionPredictions[sessionId][stockId] || [];
  if (prices.length === 0) return null;
  
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return Math.round(sum / prices.length);
}

// Execute a trade between bid and ask orders
async function executeTrade(sessionId: number, stockId: number, bidOrder: OrderType, askOrder: OrderType, price: number) {
  const quantity = Math.min(bidOrder.jumlah, askOrder.jumlah);
  
  if (quantity <= 0) return;
  
  // Update order quantities
  bidOrder.jumlah -= quantity;
  askOrder.jumlah -= quantity;
  
  // Remove fulfilled orders
  if (bidOrder.jumlah <= 0) {
    const bidIndex = orderBooks[sessionId][stockId].bids.findIndex(o => o.id === bidOrder.id);
    if (bidIndex !== -1) orderBooks[sessionId][stockId].bids.splice(bidIndex, 1);
  }
  
  if (askOrder.jumlah <= 0) {
    const askIndex = orderBooks[sessionId][stockId].asks.findIndex(o => o.id === askOrder.id);
    if (askIndex !== -1) orderBooks[sessionId][stockId].asks.splice(askIndex, 1);
  }
  
  // Update balances and portfolios
  const total = price * quantity * 100; // Price is per share, quantity is in lots (100 shares)
  
  try {
    // Start transaction
    await db.transaction(async (tx) => {
      // Update buyer (bidOrder user)
      await tx
        .update(users)
        .set({ saldo: sql`saldo - ${total}` })
        .where(eq(users.id, bidOrder.userId));
      
      // Update seller (askOrder user)
      await tx
        .update(users)
        .set({ saldo: sql`saldo + ${total}` })
        .where(eq(users.id, askOrder.userId));
      
      // Update buyer's portfolio
      const buyerPortfolio = await tx
        .select()
        .from(portfolios)
        .where(and(eq(portfolios.userId, bidOrder.userId), eq(portfolios.stockId, stockId)))
        .limit(1);
      
      if (buyerPortfolio.length > 0) {
        const current = buyerPortfolio[0];
        const newTotalLots = current.jumlahLot + quantity;
        const avgPrice = Number(current.averagePrice) || 0;
        const newAvgPrice = Math.round(((avgPrice * current.jumlahLot) + (price * quantity)) / newTotalLots);
        
        await tx
          .update(portfolios)
          .set({ jumlahLot: newTotalLots, averagePrice: String(newAvgPrice) })
          .where(eq(portfolios.id, current.id));
      } else {
        await tx.insert(portfolios).values({
          userId: bidOrder.userId,
          stockId: stockId,
          jumlahLot: quantity,
          averagePrice: String(price)
        });
      }
      
      // Update seller's portfolio
      const sellerPortfolio = await tx
        .select()
        .from(portfolios)
        .where(and(eq(portfolios.userId, askOrder.userId), eq(portfolios.stockId, stockId)))
        .limit(1);
      
      if (sellerPortfolio.length > 0) {
        const current = sellerPortfolio[0];
        const newTotalLots = current.jumlahLot - quantity;
        
        if (newTotalLots === 0) {
          await tx
            .delete(portfolios)
            .where(eq(portfolios.id, current.id));
        } else {
          await tx
            .update(portfolios)
            .set({ jumlahLot: newTotalLots })
            .where(eq(portfolios.id, current.id));
        }
      }
      
      // Record transaction
      await tx.insert(transactionsHistory).values({
        orderBuyId: bidOrder.id,
        orderSellId: askOrder.id,
        stockId: stockId,
        harga: String(price),
        jumlah: quantity,
        total: String(total)
      });
    });
    
    // Emit trade execution to clients in this session
    io.to(`session:${sessionId}`).emit("trade-executed", {
      stockId,
      price,
      quantity,
      buyerId: bidOrder.userId,
      sellerId: askOrder.userId,
      timestamp: new Date().toISOString()
    });
    
    // Emit updated order book
    emitOrderBookUpdate(sessionId, stockId);
    
    // Emit updated balances
    emitBalanceUpdate(sessionId, bidOrder.userId);
    emitBalanceUpdate(sessionId, askOrder.userId);
    
  } catch (error) {
    console.error("Trade execution error:", error);
  }
}

// Matching engine main loop
function runMatchingEngine() {
  setInterval(async () => {
    if (!activeSession) return;
    
    // Check if session is still active
    const sessionData = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, activeSession))
      .limit(1);
    
    if (sessionData.length === 0 || sessionData[0].status !== "active") {
      return;
    }
    
    // Get all stocks
    const allStocks = await db.select().from(stocks);

    // For each stock, check for matches
    for (const stock of allStocks) {
      const book = orderBooks[activeSession][stock.id];
      if (!book) continue;
      
      // Sort bids descending (highest price first), asks ascending (lowest price first)
      book.bids.sort((a, b) => b.harga - a.harga);
      book.asks.sort((a, b) => a.harga - b.harga);
      
      // Check for matches
      let changed = false;
      while (book.bids.length > 0 && book.asks.length > 0) {
        const highestBid = book.bids[0];
        const lowestAsk = book.asks[0];
        
        if (highestBid.harga >= lowestAsk.harga) {
          // Match found!
          const matchPrice = lowestAsk.harga;
          await executeTrade(activeSession, stock.id, highestBid, lowestAsk, matchPrice);
          changed = true;
        } else {
          break; // No more matches possible
        }
      }
      
      if (changed) {
        emitOrderBookUpdate(activeSession, stock.id);
      }
    }
  }, MATCHING_ENGINE_INTERVAL);
}

// Emit order book update to session clients
function emitOrderBookUpdate(sessionId: number, stockId: number) {
  const book = orderBooks[sessionId][stockId];
  if (!book) return;
  
  const bids = [...book.bids].sort((a, b) => b.harga - a.harga).slice(0, 10); // Top 10 bids
  const asks = [...book.asks].sort((a, b) => a.harga - b.harga).slice(0, 10); // Top 10 asks
  
  io.to(`session:${sessionId}`).emit("order-book-update", {
    stockId,
    bids: bids.map(o => ({
      id: o.id,
      harga: o.harga,
      jumlah: o.jumlah,
      userId: o.userId
    })),
    asks: asks.map(o => ({
      id: o.id,
      harga: o.harga,
      jumlah: o.jumlah,
      userId: o.userId
    }))
  });
}

// Emit balance update to specific user in session
async function emitBalanceUpdate(sessionId: number, userId: number) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (user.length > 0) {
    io.to(`user:${userId}`).emit("balance-update", {
      userId: user[0].id,
      balance: Number(user[0].saldo)
    });
  }
}

// Emit portfolio update to specific user in session
async function emitPortfolioUpdate(sessionId: number, userId: number, stockId: number) {
  const portfolio = await db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.userId, userId), eq(portfolios.stockId, stockId)))
    .limit(1);
    
  if (portfolio.length > 0) {
    io.to(`user:${userId}`).emit("portfolio-update", {
      userId,
      stockId,
      jumlahLot: portfolio[0].jumlahLot,
      averagePrice: portfolio[0].averagePrice
    });
  }
}

// Handle incoming socket connections
app.prepare().then(() => {
  const httpServer = createServer(handler);
  io = new Server(httpServer, {
    cors: {
      origin: dev ? "http://localhost:3000" : "https://yourdomain.com",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Authentication
    socket.on("authenticate", async (data) => {
      const { nama, password, userId } = data;

      try {
        let user;

        if (userId) {
          const result = await db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          if (result.length === 0) {
            socket.emit("auth-error", { message: "User not found" });
            return;
          }
          user = result[0];
        } else if (nama && password) {
          const result = await db
            .select()
            .from(users)
            .where(eq(users.nama, nama))
            .limit(1);

          if (result.length === 0) {
            socket.emit("auth-error", { message: "User not found" });
            return;
          }

          user = result[0];
          if (!user.password) {
            socket.emit("auth-error", { message: "Invalid password" });
            return;
          }
          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            socket.emit("auth-error", { message: "Invalid password" });
            return;
          }
        } else {
          socket.emit("auth-error", { message: "Missing credentials" });
          return;
        }
        
        // Join user-specific room
        socket.join(`user:${user.id}`);
        
        // Send initial data
        socket.emit("auth-success", {
          user: {
            id: user.id,
            nama: user.nama,
            role: user.role,
            saldo: Number(user.saldo)
          }
        });
        
        // If there's an active session, join session room
        if (activeSession) {
          socket.join(`session:${activeSession}`);
          // Send current session state
          const sessionData = await db
            .select()
            .from(sessions)
            .where(eq(sessions.id, activeSession))
            .limit(1);
            
          if (sessionData.length > 0) {
            socket.emit("session-state", {
              sessionId: activeSession,
              status: sessionData[0].status,
              timeLeft: sessionTimers[activeSession] || 0
            });
            
            // Send order books for all stocks
            const sid = activeSession;
            const stockRows = await db.select().from(stocks);
            stockRows.forEach((stock) => {
              emitOrderBookUpdate(sid, stock.id);
            });
          }
        }
      } catch (error) {
        console.error("Authentication error:", error);
        socket.emit("auth-error", { message: "Authentication failed" });
      }
    });

    // Join stock room for real-time price updates
    socket.on("join-stock", (stockSymbol) => {
      // Find stock ID by symbol
      db.select()
        .from(stocks)
        .where(eq(stocks.kodeSaham, stockSymbol))
        .limit(1)
        .then((result) => {
          if (result.length > 0) {
            const stockId = result[0].id;
            if (activeSession) {
              socket.join(`stock:${stockId}`);
              // Send current order book for this stock
              emitOrderBookUpdate(activeSession, stockId);
            }
          }
        });
    });

    // Leave stock room
    socket.on("leave-stock", (stockSymbol) => {
      db.select()
        .from(stocks)
        .where(eq(stocks.kodeSaham, stockSymbol))
        .limit(1)
        .then((result) => {
          if (result.length > 0) {
            const stockId = result[0].id;
            socket.leave(`stock:${stockId}`);
          }
        });
    });

    // Submit prediction (pre-market phase)
    socket.on("submit-prediction", async (data) => {
      const { stockId, predictedPrice } = data;
      
      // Get user ID from socket (we'd need to store this on connection)
      // For simplicity, we'll get it from the data - in production, verify via session
      const { userId } = data;
      
      if (!activeSession) {
        socket.emit("prediction-error", { message: "No active session" });
        return;
      }
      const sessId = activeSession;
      
      if (sessId) {
        // Store prediction
        if (!sessionPredictions[sessId]) {
          sessionPredictions[sessId] = {};
        }
        if (!sessionPredictions[sessId][stockId]) {
          sessionPredictions[sessId][stockId] = [];
        }
        
        sessionPredictions[sessId][stockId].push(predictedPrice);
        
        // Save to database
        try {
          await db.insert(predictions).values({
            userId,
            stockId,
            sessionId: sessId,
            tebakanHarga: String(predictedPrice)
          });
          
          socket.emit("prediction-saved", { stockId, predictedPrice });
          
          // Check if we have enough predictions (for demo, we'll use a simple threshold)
          // In real implementation, we'd wait for all respondents or timeout
          const stock = await db
            .select()
            .from(stocks)
            .where(eq(stocks.id, stockId))
            .limit(1);
            
          if (stock.length > 0) {
            // For demo, if we have 3 predictions, calculate opening price
            if (sessionPredictions[sessId][stockId].length >= 3) {
              const openingPrice = calculateOpeningPrice(sessId, stockId);
              if (openingPrice !== null) {
                sessionStockPrices[sessId][stockId] = openingPrice;
                
                // Notify client
                socket.emit("opening-price-calculated", {
                  stockId,
                  openingPrice
                });
                
                // Check if all stocks have opening prices
                const allStocks = await db.select().from(stocks);
                const allPricesReady = allStocks.every(s => 
                  sessionStockPrices[sessId] && 
                  sessionStockPrices[sessId][s.id] !== undefined
                );
                
                if (allPricesReady) {
                  // All stocks have opening prices, start trading phase
                  await db
                    .update(sessions)
                    .set({ status: "active", startTime: new Date() })
                    .where(eq(sessions.id, sessId));
                    
                  // Notify all clients in session
                  io.to(`session:${sessId}`).emit("trading-phase-started", {
                    sessionId: sessId,
                    openingPrices: sessionStockPrices[sessId]
                  });
                  
                  // Start session timer
                  sessionTimers[sessId] = TRADING_PHASE_DURATION;
                }
              }
            }
          }
        } catch (error) {
          console.error("Prediction error:", error);
          socket.emit("prediction-error", { message: "Failed to save prediction" });
        }
      }
    });

    // Place order (trading phase)
    socket.on("place-order", async (data) => {
      const { stockId, tipe, harga, jumlah } = data;
      const { userId } = data; // In production, get from authenticated socket
      
      if (!activeSession) {
        socket.emit("order-error", { message: "No active session" });
        return;
      }
      const sessId = activeSession;
      
      const sessionData = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessId))
        .limit(1);
      
      if (sessionData.length === 0 || sessionData[0].status !== "active") {
        socket.emit("order-error", { message: "Session not active" });
        return;
      }
      
      // Validate user has sufficient balance/portfolio
      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
          
        if (user.length === 0) {
          socket.emit("order-error", { message: "User not found" });
          return;
        }
        
        const totalCost = harga * jumlah * 100; // Price per share, quantity in lots
        
        const saldo = Number(user[0].saldo) || 0;
        if (tipe === "BID" && saldo < totalCost) {
          socket.emit("order-error", { message: "Insufficient balance" });
          return;
        }
        
        if (tipe === "ASK") {
          const portfolio = await db
            .select()
            .from(portfolios)
            .where(and(eq(portfolios.userId, userId), eq(portfolios.stockId, stockId)))
            .limit(1);
            
          if (portfolio.length === 0 || portfolio[0].jumlahLot < jumlah) {
            socket.emit("order-error", { message: "Insufficient stock lots" });
            return;
          }
        }
        
        // Add order to order book
        const [order] = await db.insert(orderBook).values({
          userId,
          stockId,
          tipe,
          harga: String(harga),
          jumlah,
          status: "open"
        }).returning();
        
        // Add to in-memory order book
        if (!orderBooks[sessId]) {
          orderBooks[sessId] = {};
        }
        if (!orderBooks[sessId][stockId]) {
          orderBooks[sessId][stockId] = { bids: [], asks: [] };
        }
        
        const orderObj: OrderType = {
          id: order.id,
          userId: order.userId,
          stockId: order.stockId,
          tipe: order.tipe,
          harga: Number(order.harga),
          jumlah: order.jumlah
        };
        
        if (order.tipe === "BID") {
          orderBooks[sessId][stockId].bids.push(orderObj);
        } else {
          orderBooks[sessId][stockId].asks.push(orderObj);
        }
        
        socket.emit("order-placed", { orderId: order.id });
        
        // Emit updated order book
        emitOrderBookUpdate(sessId, stockId);
        
      } catch (error) {
        console.error("Order placement error:", error);
        socket.emit("order-error", { message: "Failed to place order" });
      }
    });

    // Cancel order
    socket.on("cancel-order", async (data) => {
      const { orderId } = data;
      const { userId } = data;
      
      try {
        // Verify order belongs to user
        const order = await db
          .select()
          .from(orderBook)
          .where(and(eq(orderBook.id, orderId), eq(orderBook.userId, userId)))
          .limit(1);
          
        if (order.length === 0) {
          socket.emit("order-error", { message: "Order not found or unauthorized" });
          return;
        }
        
        // Remove from database
        await db
          .delete(orderBook)
          .where(eq(orderBook.id, orderId));
        
        // Remove from in-memory order book
        if (activeSession && orderBooks[activeSession]) {
          const stockId = order[0].stockId;
          const book = orderBooks[activeSession][stockId];
          if (book) {
            if (order[0].tipe === "BID") {
              const index = book.bids.findIndex(o => o.id === orderId);
              if (index !== -1) book.bids.splice(index, 1);
            } else {
              const index = book.asks.findIndex(o => o.id === orderId);
              if (index !== -1) book.asks.splice(index, 1);
            }
            
            emitOrderBookUpdate(activeSession, stockId);
          }
        }
        
        socket.emit("order-cancelled", { orderId });
        
      } catch (error) {
        console.error("Order cancellation error:", error);
        socket.emit("order-error", { message: "Failed to cancel order" });
      }
    });

    // Get user portfolio
    socket.on("get-portfolio", async (data) => {
      const { userId } = data;
      
      try {
        const portfolio = await db
          .select()
          .from(portfolios)
          .where(eq(portfolios.userId, userId))
          .leftJoin(stocks, eq(portfolios.stockId, stocks.id))
          .then((results) => {
            return results
              .filter(row => row.stocks)
              .map(row => ({
              stockId: row.portfolios.stockId,
              stockCode: row.stocks!.kodeSaham,
              stockName: row.stocks!.namaSaham,
              jumlahLot: row.portfolios.jumlahLot,
              averagePrice: row.portfolios.averagePrice,
              currentValue: row.portfolios.jumlahLot * 100 * Number(row.stocks!.basePrice || 0)
            }));
          });
          
        socket.emit("portfolio-data", { portfolio });
      } catch (error) {
        console.error("Portfolio fetch error:", error);
        socket.emit("portfolio-error", { message: "Failed to fetch portfolio" });
      }
    });

    // Get current session info
    socket.on("get-session-info", async () => {
      if (!activeSession) {
        socket.emit("session-info", { sessionId: null, status: null, timeLeft: 0 });
        return;
      }
      
      try {
        const session = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, activeSession))
          .limit(1);
          
        if (session.length > 0) {
          socket.emit("session-info", {
            sessionId: activeSession,
            status: session[0].status,
            timeLeft: sessionTimers[activeSession] || 0
          });
        }
      } catch (error) {
        console.error("Session info error:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      // Cleanup would go here in production
    });
  });

  // Start matching engine
  runMatchingEngine();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
