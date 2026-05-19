import {
  pgTable,
  serial,
  varchar,
  decimal,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  nama: varchar("nama", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull().default("responden"), // admin | responden
  saldo: decimal("saldo", { precision: 15, scale: 2 }).default("100000000.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  kodeSaham: varchar("kode_saham", { length: 10 }).notNull().unique(),
  namaSaham: varchar("nama_saham", { length: 255 }).notNull(),
  basePrice: decimal("base_price", { precision: 15, scale: 2 }).notNull(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  putaranKe: integer("putaran_ke").notNull(),
  periodeKe: integer("periode_ke").notNull().default(1),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessionStocks = pgTable("session_stocks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => sessions.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
});

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  sessionId: integer("session_id").references(() => sessions.id).notNull(),
  tebakanHarga: decimal("tebakan_harga", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderBook = pgTable("order_book", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  tipe: varchar("tipe", { length: 3 }).notNull(), // BID | ASK
  harga: decimal("harga", { precision: 15, scale: 2 }).notNull(),
  jumlah: integer("jumlah").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"), // open | matched | cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const portfolios = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  jumlahLot: integer("jumlah_lot").notNull().default(0),
  averagePrice: decimal("average_price", { precision: 15, scale: 2 }).default("0"),
});

export const transactionsHistory = pgTable("transactions_history", {
  id: serial("id").primaryKey(),
  orderBuyId: integer("order_buy_id").references(() => orderBook.id).notNull(),
  orderSellId: integer("order_sell_id").references(() => orderBook.id).notNull(),
  stockId: integer("stock_id").references(() => stocks.id).notNull(),
  harga: decimal("harga", { precision: 15, scale: 2 }).notNull(),
  jumlah: integer("jumlah").notNull(),
  total: decimal("total", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
