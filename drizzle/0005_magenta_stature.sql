CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solution_category" (
	"solution_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "solution_category_solution_id_pk" PRIMARY KEY("solution_id")
);
--> statement-breakpoint
ALTER TABLE "solution_category" ADD CONSTRAINT "solution_category_solution_id_solution_id_fk" FOREIGN KEY ("solution_id") REFERENCES "public"."solution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solution_category" ADD CONSTRAINT "solution_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "solution_category_category_id_idx" ON "solution_category" USING btree ("category_id");--> statement-breakpoint
INSERT INTO category (id, name, position) VALUES
  ('9f1a7c10-0000-4000-8000-000000000001', 'Financial', 0),
  ('9f1a7c10-0000-4000-8000-000000000002', 'Healthcare', 1),
  ('9f1a7c10-0000-4000-8000-000000000003', 'Legal', 2)
ON CONFLICT (id) DO NOTHING;