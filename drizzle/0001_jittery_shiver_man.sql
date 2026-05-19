CREATE TABLE "session_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"stock_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "average_price" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "session_stocks" ADD CONSTRAINT "session_stocks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_stocks" ADD CONSTRAINT "session_stocks_stock_id_stocks_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stocks"("id") ON DELETE no action ON UPDATE no action;