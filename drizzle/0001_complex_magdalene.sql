ALTER TABLE "chat_session_handle" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "chat_session_handle" ADD COLUMN "lease_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "solution" ADD COLUMN "chat_config_version" integer DEFAULT 0 NOT NULL;