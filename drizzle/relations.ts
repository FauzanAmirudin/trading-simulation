import { relations } from "drizzle-orm/relations";
import { users, orderBook, stocks, portfolios, predictions, sessions, transactionsHistory } from "./schema";

export const orderBookRelations = relations(orderBook, ({one, many}) => ({
	user: one(users, {
		fields: [orderBook.userId],
		references: [users.id]
	}),
	stock: one(stocks, {
		fields: [orderBook.stockId],
		references: [stocks.id]
	}),
	transactionsHistories_orderBuyId: many(transactionsHistory, {
		relationName: "transactionsHistory_orderBuyId_orderBook_id"
	}),
	transactionsHistories_orderSellId: many(transactionsHistory, {
		relationName: "transactionsHistory_orderSellId_orderBook_id"
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	orderBooks: many(orderBook),
	portfolios: many(portfolios),
	predictions: many(predictions),
}));

export const stocksRelations = relations(stocks, ({many}) => ({
	orderBooks: many(orderBook),
	portfolios: many(portfolios),
	predictions: many(predictions),
	transactionsHistories: many(transactionsHistory),
}));

export const portfoliosRelations = relations(portfolios, ({one}) => ({
	user: one(users, {
		fields: [portfolios.userId],
		references: [users.id]
	}),
	stock: one(stocks, {
		fields: [portfolios.stockId],
		references: [stocks.id]
	}),
}));

export const predictionsRelations = relations(predictions, ({one}) => ({
	user: one(users, {
		fields: [predictions.userId],
		references: [users.id]
	}),
	stock: one(stocks, {
		fields: [predictions.stockId],
		references: [stocks.id]
	}),
	session: one(sessions, {
		fields: [predictions.sessionId],
		references: [sessions.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({many}) => ({
	predictions: many(predictions),
}));

export const transactionsHistoryRelations = relations(transactionsHistory, ({one}) => ({
	orderBook_orderBuyId: one(orderBook, {
		fields: [transactionsHistory.orderBuyId],
		references: [orderBook.id],
		relationName: "transactionsHistory_orderBuyId_orderBook_id"
	}),
	orderBook_orderSellId: one(orderBook, {
		fields: [transactionsHistory.orderSellId],
		references: [orderBook.id],
		relationName: "transactionsHistory_orderSellId_orderBook_id"
	}),
	stock: one(stocks, {
		fields: [transactionsHistory.stockId],
		references: [stocks.id]
	}),
}));