CREATE INDEX "group_member_user_id_group_id_idx" ON "group_member" USING btree ("user_id","group_id");--> statement-breakpoint
CREATE INDEX "group_solution_solution_id_group_id_idx" ON "group_solution" USING btree ("solution_id","group_id");--> statement-breakpoint
CREATE INDEX "recent_user_id_opened_at_idx" ON "recent" USING btree ("user_id","opened_at" desc);