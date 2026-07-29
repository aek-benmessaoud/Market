CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"barcode" text NOT NULL,
	"internal_ref" text,
	"name" text,
	"price" numeric(10, 2) NOT NULL,
	"old_price" numeric(10, 2),
	"unit" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_email" text NOT NULL,
	"owner_phone" text,
	"password_hash" text NOT NULL,
	"version" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"role" text DEFAULT 'owner',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "stores_slug_unique" UNIQUE("slug"),
	CONSTRAINT "stores_owner_email_unique" UNIQUE("owner_email")
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_products_store_barcode" ON "products" USING btree ("store_id","barcode");