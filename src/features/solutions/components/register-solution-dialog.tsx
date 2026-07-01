"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

import { useRegisterSolution } from "../api/solutions";
import {
  chatConfigSchema,
  embeddedConfigSchema,
  registerSolutionSchema,
  slugify,
  type RegisterSolutionValues,
  type SolutionType,
} from "../schemas/solution";

/**
 * Register a solution (FR-ADM-S-02). Type is picked here (chat/embedded) —
 * `native` is intentionally absent (enum-only, hidden in foundation). The full
 * per-type config (botUuid/welcome/starters/feedback for chat; https iframeUrl
 * for embedded) is set after registration, in the editor slide-over.
 */
export function RegisterSolutionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const registerSolution = useRegisterSolution();

  const [type, setType] = useState<SolutionType>("chat");

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterSolutionValues>({
    resolver: zodResolver(registerSolutionSchema),
    defaultValues: {
      name: "",
      description: undefined,
      type: "chat",
      // minimal valid per-type config so registration always succeeds; the
      // editor is where the real values get filled in.
      config: { botUuid: "", welcomeMessage: "", feedbackEnabled: true },
    },
  });

  // Keep the union field and the segmented control in sync.
  watch("type");
  function selectType(next: SolutionType) {
    setType(next);
    setValue("type", next, { shouldDirty: true });
    setValue(
      "config",
      next === "chat"
        ? { botUuid: "", welcomeMessage: "", feedbackEnabled: true }
        : { iframeUrl: "https://" },
      { shouldDirty: true },
    );
  }

  const onSubmit = handleSubmit(async (data) => {
    // The form-level union re-check guards against the type/config mismatch
    // the segmented control + nested config can produce on rapid toggling.
    const configCheck =
      data.type === "chat"
        ? chatConfigSchema.safeParse(data.config)
        : embeddedConfigSchema.safeParse(data.config);
    if (!configCheck.success) {
      setError("config", { message: "Configuration doesn't match the selected type." });
      return;
    }
    try {
      const created = await registerSolution.mutateAsync({
        name: data.name,
        description: data.description,
        type: data.type,
        config: configCheck.data,
      });
      toast({ tone: "success", description: `Registered “${created.name}” as a draft.` });
      reset();
      onOpenChange(false);
      onCreated(created.id);
    } catch (e) {
      setError("root", {
        message: e instanceof Error ? e.message : "Couldn't register this solution.",
      });
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Register solution</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-5 pb-5">
            <FormError message={errors.root?.message} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-name">Name</Label>
              <Input id="reg-name" placeholder="e.g. Support Assistant" {...register("name")} />
              <FieldError message={errors.name?.message} />
              <p className="text-mono-xs text-[var(--ink3)]">
                URL slug: /s/{slugify(watch("name") || "solution")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-desc">Description</Label>
              <Textarea
                id="reg-desc"
                rows={2}
                placeholder="What this solution is for"
                {...register("description")}
              />
              <FieldError message={errors.description?.message} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <SegmentedControl
                options={[
                  { value: "chat", label: "Chat" },
                  { value: "embedded", label: "Embedded" },
                ]}
                value={type}
                onValueChange={(v) => selectType(v as SolutionType)}
              />
              <p className="text-mono-xs text-[var(--ink3)]">
                {type === "chat"
                  ? "Connects to a Genie bot. Configure the bot UUID, welcome message, and theme after registering."
                  : "Embeds an external HTTPS page in an iframe. Set the iframe URL after registering."}
              </p>
            </div>

            {type === "chat" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-bot">Bot UUID</Label>
                <Input
                  id="reg-bot"
                  placeholder="The Genie bot id this solution talks to"
                  {...register("config.botUuid")}
                />
                <FieldError
                  message={(errors.config as { botUuid?: { message?: string } })?.botUuid?.message}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-iframe">iframe URL</Label>
                <Input
                  id="reg-iframe"
                  placeholder="https://example.com/app"
                  {...register("config.iframeUrl")}
                />
                <FieldError
                  message={
                    (errors.config as { iframeUrl?: { message?: string } })?.iframeUrl?.message
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registering…" : "Register as draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
