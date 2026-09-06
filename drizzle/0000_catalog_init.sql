CREATE TYPE "public"."aspiration" AS ENUM('natural', 'turbo', 'twin_turbo', 'supercharged');--> statement-breakpoint
CREATE TYPE "public"."body_type" AS ENUM('suv', 'pickup', 'van', 'bus', 'truck', 'sedan', 'hatchback', 'wagon', 'coupe', 'convertible');--> statement-breakpoint
CREATE TYPE "public"."vehicle_condition" AS ENUM('new', 'used');--> statement-breakpoint
CREATE TYPE "public"."defect_severity" AS ENUM('none', 'minor', 'moderate', 'major');--> statement-breakpoint
CREATE TYPE "public"."drive_type" AS ENUM('fwd', 'rwd', 'awd', '4wd', '2wd');--> statement-breakpoint
CREATE TYPE "public"."fuel_type" AS ENUM('petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric', 'lpg');--> statement-breakpoint
CREATE TYPE "public"."history_event_type" AS ENUM('manufactured', 'first_registration', 'ownership_change', 'odometer_reading', 'service', 'accident', 'inspection', 'auction_sale', 'import', 'export', 'deregistration');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'active', 'reserved', 'sold', 'archived');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('photo', 'spin_frame', 'video', 'document');--> statement-breakpoint
CREATE TYPE "public"."media_tier" AS ENUM('a', 'b', 'c');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('fixed', 'negotiable', 'on_request', 'auction');--> statement-breakpoint
CREATE TYPE "public"."steering" AS ENUM('left', 'right');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('manual', 'automatic', 'cvt', 'amt', 'dct');--> statement-breakpoint
CREATE TABLE "auction_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"auction_house" text NOT NULL,
	"auction_site" text,
	"lot_number" text,
	"auction_date" date,
	"grade_overall" text,
	"grade_exterior" text,
	"grade_interior" text,
	"odometer_km" integer,
	"starting_price_minor" bigint,
	"sold_price_minor" bigint,
	"price_currency" char(3),
	"sheet_image_url" text,
	"inspector_notes" text,
	"translated_notes" text,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auction_sheets_prices_need_currency" CHECK (("auction_sheets"."starting_price_minor" is null and "auction_sheets"."sold_price_minor" is null)
          or "auction_sheets"."price_currency" is not null)
);
--> statement-breakpoint
CREATE TABLE "condition_report_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"area" text NOT NULL,
	"defect_type" text,
	"severity" "defect_severity" DEFAULT 'minor' NOT NULL,
	"note" text,
	"photo_url" text
);
--> statement-breakpoint
CREATE TABLE "condition_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"inspected_by" text,
	"inspected_at" timestamp with time zone NOT NULL,
	"overall_score" smallint,
	"exterior_score" smallint,
	"interior_score" smallint,
	"mechanical_score" smallint,
	"has_accident_history" boolean,
	"has_structural_damage" boolean,
	"has_flood_damage" boolean,
	"summary" text,
	"document_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condition_reports_scores_range" CHECK (("condition_reports"."overall_score" is null or "condition_reports"."overall_score" between 1 and 5)
          and ("condition_reports"."exterior_score" is null or "condition_reports"."exterior_score" between 1 and 5)
          and ("condition_reports"."interior_score" is null or "condition_reports"."interior_score" between 1 and 5)
          and ("condition_reports"."mechanical_score" is null or "condition_reports"."mechanical_score" between 1 and 5))
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "makes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country_code" char(2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"make_id" uuid NOT NULL,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"slug" text NOT NULL,
	"default_body_type" "body_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_engines" (
	"vehicle_id" uuid PRIMARY KEY NOT NULL,
	"engine_code" text,
	"displacement_cc" integer,
	"cylinders" smallint,
	"aspiration" "aspiration",
	"power_hp" integer,
	"torque_nm" integer,
	"emission_standard" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_features" (
	"vehicle_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	CONSTRAINT "vehicle_features_vehicle_id_feature_id_pk" PRIMARY KEY("vehicle_id","feature_id")
);
--> statement-breakpoint
CREATE TABLE "vehicle_history_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"event_type" "history_event_type" NOT NULL,
	"occurred_on" date,
	"odometer_km" integer,
	"country_code" char(2),
	"description" text,
	"source" text,
	"document_url" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_history_odometer_nonneg" CHECK ("vehicle_history_events"."odometer_km" is null or "vehicle_history_events"."odometer_km" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vehicle_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" "media_kind" DEFAULT 'photo' NOT NULL,
	"url" text NOT NULL,
	"alt" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"tier" "media_tier",
	"spin_index" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_media_spin_index_only_on_frames" CHECK (("vehicle_media"."kind" = 'spin_frame') = ("vehicle_media"."spin_index" is not null))
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"make_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"title" text NOT NULL,
	"model_year" smallint NOT NULL,
	"chassis_number" text,
	"vin" char(17),
	"engine_number" text,
	"registration_number" text,
	"body_type" "body_type",
	"condition" "vehicle_condition" DEFAULT 'used' NOT NULL,
	"steering" "steering" DEFAULT 'right' NOT NULL,
	"transmission" "transmission",
	"drive_type" "drive_type",
	"fuel_type" "fuel_type",
	"mileage_km" integer,
	"mileage_verified" boolean DEFAULT false NOT NULL,
	"exterior_color" text,
	"interior_color" text,
	"doors" smallint,
	"seats" smallint,
	"price_minor" bigint,
	"price_currency" char(3),
	"pricing_type" "pricing_type" DEFAULT 'on_request' NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_auction" boolean DEFAULT false NOT NULL,
	"description" text,
	"extra" jsonb,
	"published_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_document" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || model_year::text || ' ' || coalesce(chassis_number, '') || ' ' || coalesce(vin, ''))) STORED,
	CONSTRAINT "vehicles_vin_format" CHECK ("vehicles"."vin" is null or "vehicles"."vin" ~ '^[A-HJ-NPR-Z0-9]{17}$'),
	CONSTRAINT "vehicles_mileage_nonneg" CHECK ("vehicles"."mileage_km" is null or "vehicles"."mileage_km" >= 0),
	CONSTRAINT "vehicles_price_nonneg" CHECK ("vehicles"."price_minor" is null or "vehicles"."price_minor" >= 0),
	CONSTRAINT "vehicles_price_currency_paired" CHECK (("vehicles"."price_minor" is null) = ("vehicles"."price_currency" is null)),
	CONSTRAINT "vehicles_model_year_sane" CHECK ("vehicles"."model_year" between 1950 and 2100)
);
--> statement-breakpoint
ALTER TABLE "auction_sheets" ADD CONSTRAINT "auction_sheets_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_report_items" ADD CONSTRAINT "condition_report_items_report_id_condition_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."condition_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_reports" ADD CONSTRAINT "condition_reports_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "models" ADD CONSTRAINT "models_make_id_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."makes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_engines" ADD CONSTRAINT "vehicle_engines_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_features" ADD CONSTRAINT "vehicle_features_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_features" ADD CONSTRAINT "vehicle_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_history_events" ADD CONSTRAINT "vehicle_history_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_media" ADD CONSTRAINT "vehicle_media_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_make_id_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."makes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_sheets_vehicle_idx" ON "auction_sheets" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_sheets_lot_key" ON "auction_sheets" USING btree ("auction_house","lot_number","auction_date") WHERE "auction_sheets"."lot_number" is not null and "auction_sheets"."auction_date" is not null;--> statement-breakpoint
CREATE INDEX "condition_report_items_report_idx" ON "condition_report_items" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "condition_reports_vehicle_idx" ON "condition_reports" USING btree ("vehicle_id","inspected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "features_slug_key" ON "features" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "makes_slug_key" ON "makes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "models_make_slug_key" ON "models" USING btree ("make_id","slug");--> statement-breakpoint
CREATE INDEX "models_family_idx" ON "models" USING btree ("make_id","family");--> statement-breakpoint
CREATE INDEX "vehicle_features_feature_idx" ON "vehicle_features" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "vehicle_history_timeline_idx" ON "vehicle_history_events" USING btree ("vehicle_id","occurred_on");--> statement-breakpoint
CREATE INDEX "vehicle_media_order_idx" ON "vehicle_media" USING btree ("vehicle_id","kind","position");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_media_one_cover" ON "vehicle_media" USING btree ("vehicle_id") WHERE "vehicle_media"."is_cover";--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_media_spin_frame_key" ON "vehicle_media" USING btree ("vehicle_id","spin_index") WHERE "vehicle_media"."spin_index" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_slug_key" ON "vehicles" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles" USING btree ("vin") WHERE "vehicles"."vin" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_chassis_key" ON "vehicles" USING btree ("chassis_number") WHERE "vehicles"."chassis_number" is not null;--> statement-breakpoint
CREATE INDEX "vehicles_browse_idx" ON "vehicles" USING btree ("status","model_year" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "vehicles_make_model_idx" ON "vehicles" USING btree ("make_id","model_id");--> statement-breakpoint
CREATE INDEX "vehicles_body_type_idx" ON "vehicles" USING btree ("body_type");--> statement-breakpoint
CREATE INDEX "vehicles_search_idx" ON "vehicles" USING gin ("search_document");