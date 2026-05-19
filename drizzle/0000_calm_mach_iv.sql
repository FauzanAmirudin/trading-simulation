-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "order_book" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stock_id" integer NOT NULL,
	"tipe" varchar(3) NOT NULL,
	"harga" numeric(15, 2) NOT NULL,
	"jumlah" integer NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"kode_saham" varchar(10) NOT NULL,
	"nama_saham" varchar(255) NOT NULL,
	"base_price" numeric(15, 2) NOT NULL,
	CONSTRAINT "stocks_kode_saham_unique" UNIQUE("kode_saham")
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stock_id" integer NOT NULL,
	"jumlah_lot" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stock_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"tebakan_harga" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"putaran_ke" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"start_time" timestamp,
	"end_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_buy_id" integer NOT NULL,
	"order_sell_id" integer NOT NULL,
	"stock_id" integer NOT NULL,
	"harga" numeric(15, 2) NOT NULL,
	"jumlah" integer NOT NULL,
	"total" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"nama" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'responden' NOT NULL,
	"saldo" numeric(15, 2) DEFAULT '100000000.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"password" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "order_book" ADD CONSTRAINT "order_book_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_book" ADD CONSTRAINT "order_book_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions_history" ADD CONSTRAINT "transactions_history_order_buy_id_order_book_id_fk" FOREIGN KEY ("order_buy_id") REFERENCES "public"."order_book"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions_history" ADD CONSTRAINT "transactions_history_order_sell_id_order_book_id_fk" FOREIGN KEY ("order_sell_id") REFERENCES "public"."order_book"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions_history" ADD CONSTRAINT "transactions_history_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE no action ON UPDATE no action;
*/