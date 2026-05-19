import { pgTable, foreignKey, serial, integer, varchar, numeric, timestamp, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const orderBook = pgTable("order_book", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	stockId: integer("stock_id").notNull(),
	tipe: varchar({ length: 3 }).notNull(),
	harga: numeric({ precision: 15, scale:  2 }).notNull(),
	jumlah: integer().notNull(),
	status: varchar({ length: 20 }).default('open').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "order_book_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.stockId],
			foreignColumns: [stocks.id],
			name: "order_book_stock_id_stocks_id_fk"
		}),
]);

export const stocks = pgTable("stocks", {
	id: serial().primaryKey().notNull(),
	kodeSaham: varchar("kode_saham", { length: 10 }).notNull(),
	namaSaham: varchar("nama_saham", { length: 255 }).notNull(),
	basePrice: numeric("base_price", { precision: 15, scale:  2 }).notNull(),
}, (table) => [
	unique("stocks_kode_saham_unique").on(table.kodeSaham),
]);

export const portfolios = pgTable("portfolios", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	stockId: integer("stock_id").notNull(),
	jumlahLot: integer("jumlah_lot").default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "portfolios_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.stockId],
			foreignColumns: [stocks.id],
			name: "portfolios_stock_id_stocks_id_fk"
		}),
]);

export const predictions = pgTable("predictions", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	stockId: integer("stock_id").notNull(),
	sessionId: integer("session_id").notNull(),
	tebakanHarga: numeric("tebakan_harga", { precision: 15, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "predictions_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.stockId],
			foreignColumns: [stocks.id],
			name: "predictions_stock_id_stocks_id_fk"
		}),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [sessions.id],
			name: "predictions_session_id_sessions_id_fk"
		}),
]);

export const sessions = pgTable("sessions", {
	id: serial().primaryKey().notNull(),
	putaranKe: integer("putaran_ke").notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	startTime: timestamp("start_time", { mode: 'string' }),
	endTime: timestamp("end_time", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const transactionsHistory = pgTable("transactions_history", {
	id: serial().primaryKey().notNull(),
	orderBuyId: integer("order_buy_id").notNull(),
	orderSellId: integer("order_sell_id").notNull(),
	stockId: integer("stock_id").notNull(),
	harga: numeric({ precision: 15, scale:  2 }).notNull(),
	jumlah: integer().notNull(),
	total: numeric({ precision: 15, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderBuyId],
			foreignColumns: [orderBook.id],
			name: "transactions_history_order_buy_id_order_book_id_fk"
		}),
	foreignKey({
			columns: [table.orderSellId],
			foreignColumns: [orderBook.id],
			name: "transactions_history_order_sell_id_order_book_id_fk"
		}),
	foreignKey({
			columns: [table.stockId],
			foreignColumns: [stocks.id],
			name: "transactions_history_stock_id_stocks_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	nama: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 20 }).default('responden').notNull(),
	saldo: numeric({ precision: 15, scale:  2 }).default('100000000.00').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	password: varchar({ length: 255 }),
});
