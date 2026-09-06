import {
  pgTable,
  serial,
  varchar,
  decimal,
  timestamp,
  integer,
  text,
  jsonb,
  index,
  uniqueIndex,
  boolean,
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

// === ROUNDS — dynamic round tracking (created on-the-fly by state machine) ===
export const rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  roundNumber: integer("round_number"),
  period: integer("period").notNull().default(1),
  sessionGroup: integer("session_group").notNull().default(1),
  roundIndex: integer("round_index").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  subSessionStatus: varchar("sub_session_status", { length: 30 }).notNull().default("IDLE"),
  activeSubSession: integer("active_sub_session").notNull().default(1),
  activeIntervention: varchar("active_intervention", { length: 30 }).default("NONE"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  openingPrices: jsonb("opening_prices").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Optimasi 5: Index pada status — digunakan saat recovery server
  statusIdx: index("rounds_status_idx").on(table.status),
}));

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
  subSession: integer("sub_session").notNull(),
  tipe: varchar("tipe", { length: 3 }).notNull(),
  harga: decimal("harga", { precision: 15, scale: 2 }).notNull(),
  jumlah: integer("jumlah").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  activeIntervention: varchar("active_intervention", { length: 30 }).default("NONE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Optimasi 5: Composite index — digunakan oleh matching engine setiap 750ms
  roundStatusIdx: index("order_book_round_status_idx").on(table.roundId, table.status),
  // Index untuk validasi saldo saat place-order
  userRoundIdx: index("order_book_user_round_idx").on(table.userId, table.roundId),
}));

// === PORTFOLIOS ===
export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  jumlahLot: integer("jumlah_lot").notNull().default(0),
  averagePrice: decimal("average_price", { precision: 15, scale: 2 }).default("0"),
}, (table) => ({
  userStockIdx: uniqueIndex("portfolios_user_stock_idx").on(table.userId, table.stockId),
}));

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

// === QUESTIONS — Psychological questionnaire items (LA & EI) ===
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  instrument: varchar("instrument", { length: 10 }).notNull(), // 'LA' or 'EI'
  orderNumber: integer("order_number").notNull(),
  questionText: text("question_text").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  scaleMin: integer("scale_min").default(1).notNull(),
  scaleMax: integer("scale_max").default(5).notNull(),
  scaleMinLabel: varchar("scale_min_label", { length: 50 }).default("Sangat Tidak Setuju").notNull(),
  scaleMaxLabel: varchar("scale_max_label", { length: 50 }).default("Sangat Setuju").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  instrumentOrderIdx: index("questions_instrument_order_idx").on(table.instrument, table.orderNumber),
}));

// === QUESTIONNAIRE RESPONSES — Raw answers per respondent ===
export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  questionId: integer("question_id").references(() => questions.id).notNull(),
  instrument: varchar("instrument", { length: 10 }).notNull(), // 'LA' or 'EI'
  score: integer("score").notNull(), // 1 to 5
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userQuestionIdx: uniqueIndex("questionnaire_responses_user_question_idx").on(table.userId, table.questionId),
  userInstrumentIdx: index("questionnaire_responses_user_instrument_idx").on(table.userId, table.instrument),
}));

// === RESPONDENT PROFILES — Calculated scores, independent categories & 9-group combinations ===
export const respondentProfiles = pgTable("respondent_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  laRawScore: integer("la_raw_score").notNull().default(0),
  laAvgScore: decimal("la_avg_score", { precision: 5, scale: 2 }).notNull().default("0.00"),
  laCategory: varchar("la_category", { length: 10 }).notNull().default("S"), // 'T', 'S', 'R'
  eiRawScore: integer("ei_raw_score").notNull().default(0),
  eiAvgScore: decimal("ei_avg_score", { precision: 5, scale: 2 }).notNull().default("0.00"),
  eiCategory: varchar("ei_category", { length: 10 }).notNull().default("S"), // 'T', 'S', 'R'
  profileCode: varchar("profile_code", { length: 20 }).notNull().default("LASEIS"), // e.g. LATEIT, LASEIS, LAREIR
  profileLabel: varchar("profile_label", { length: 50 }).notNull().default("LA(S)+EI(S)"), // e.g. LA(T)+EI(S)
  profileGroup: varchar("profile_group", { length: 5 }).notNull().default("E"), // A, B, C, D, E, F, G, H, I
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userProfileIdx: index("respondent_profiles_user_idx").on(table.userId),
  profileGroupIdx: index("respondent_profiles_group_idx").on(table.profileGroup),
}));
