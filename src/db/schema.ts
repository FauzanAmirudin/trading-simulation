import {
  pgTable,
  serial,
  varchar,
  decimal,
  timestamp,
  integer,
  text,
  jsonb,
} from "drizzle-orm/pg-core";

// === EXPERIMENTAL CONFIG — researcher-defined intervention content ===
export const experimentalConfig = pgTable("experimental_config", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === ROUNDS — structured round tracking (12 rounds per experiment) ===
export const rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  roundNumber: integer("round_number").notNull().unique(),
  period: integer("period").notNull(), // 1 | 2 | 3
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  // Sub-session states: PENDING | PRE_OPENING | TRADING_S2 | TRADING_S3 | TRADING_S4 | CLOSED
  subSessionStatus: varchar("sub_session_status", { length: 30 }).notNull().default("PENDING"),
  activeSubSession: integer("active_sub_session").notNull().default(1),
  activeIntervention: varchar("active_intervention", { length: 30 }).default("NONE"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  openingPrices: jsonb("opening_prices").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === STOCKS ===
export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  kodeSaham: varchar("kode_saham", { length: 10 }).notNull().unique(),
  namaSaham: varchar("nama_saham", { length: 255 }).notNull(),
  basePrice: decimal("base_price", { precision: 15, scale: 2 }).notNull(),
});

// === ROUND STOCKS — which 3 stocks are active per round ===
export const roundStocks = pgTable("round_stocks", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").references(() => rounds.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  slot: integer("slot").notNull(), // 1, 2, or 3
});

// === USERS ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  nama: varchar("nama", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull().default("responden"),
  saldo: decimal("saldo", { precision: 15, scale: 2 }).default("100000000.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === PREDICTIONS — pre-market price predictions (Sesi 1) ===
export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  roundId: integer("round_id").references(() => rounds.id).notNull(),
  tebakanHarga: decimal("tebakan_harga", { precision: 15, scale: 2 }).notNull(),
  accuracyScore: decimal("accuracy_score", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === ORDER BOOK — bid/ask orders with intervention tracking ===
export const orderBook = pgTable("order_book", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  roundId: integer("round_id").references(() => rounds.id).notNull(),
  subSession: integer("sub_session").notNull(), // 2 | 3 | 4 (trading sessions)
  tipe: varchar("tipe", { length: 3 }).notNull(), // BID | ASK
  harga: decimal("harga", { precision: 15, scale: 2 }).notNull(),
  jumlah: integer("jumlah").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  activeIntervention: varchar("active_intervention", { length: 30 }).default("NONE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === PORTFOLIOS ===
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  roundId: integer("round_id").references(() => rounds.id).notNull(),
  jumlahLot: integer("jumlah_lot").notNull().default(0),
  averagePrice: decimal("average_price", { precision: 15, scale: 2 }).default("0"),
});

// === TRANSACTIONS HISTORY — matched trades with intervention tracking ===
export const transactionsHistory = pgTable("transactions_history", {
  id: serial("id").primaryKey(),
  orderBuyId: integer("order_buy_id").references(() => orderBook.id).notNull(),
  orderSellId: integer("order_sell_id").references(() => orderBook.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  roundId: integer("round_id").references(() => rounds.id).notNull(),
  subSession: integer("sub_session").notNull(),
  harga: decimal("harga", { precision: 15, scale: 2 }).notNull(),
  jumlah: integer("jumlah").notNull(),
  total: decimal("total", { precision: 15, scale: 2 }).notNull(),
  activeIntervention: varchar("active_intervention", { length: 30 }).default("NONE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === SESSIONS (legacy — kept for backwards compatibility) ===
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  putaranKe: integer("putaran_ke").notNull(),
  periodeKe: integer("periode_ke").notNull().default(1),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === SESSION STOCKS (legacy — kept for backwards compatibility) ===
export const sessionStocks = pgTable("session_stocks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => sessions.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
});
