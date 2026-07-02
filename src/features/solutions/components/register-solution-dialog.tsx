"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
  registerSolutionSchema,
  slugify,
  type RegisterSolutionValues,
  type SolutionType,
} from "../schemas/solution";

/**
 * Register a solution (FR-ADM-S-02), proto 974-981. Scoped to name/type/
 * description only — `native` is intentionally absent (enum-only, hidden in
 * foundation). All type-specific config (bot UUID, chat endpoint, iframe
 * URL, theme, starters, …) is set afterwards in the Configure slide-over.
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
    },
  });

  const type = watch("type");
  function selectType(next: SolutionType) {
    setValue("type", next, { shouldDirty: true });
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      const created = await registerSolution.mutateAsync(data);
      toast({ tone: "success", description: `Created “${created.name}” as a draft.` });
      reset();
      onOpenChange(false);
      onCreated(created.id);
    } catch (e) {
      setError("root", {
        message: e instanceof Error ? e.message : "Couldn't create this solution.",
      });
    }
  });

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(next);
        else handleClose();
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Add new solution</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-5 pb-5">
            <FormError message={errors.root?.message} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-name">Name</Label>
              <Input id="reg-name" placeholder="e.g. Claims Status Bot" {...register("name")} />
              <FieldError message={errors.name?.message} />
              <p className="text-mono-xs text-[var(--ink3)]">
                URL slug: /s/{slugify(watch("name") || "solution")}
              </p>
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
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-desc">Description</Label>
              <Textarea
                id="reg-desc"
                rows={2}
                placeholder="One-line summary shown on the card"
                {...register("description")}
              />
              <FieldError message={errors.description?.message} />
            </div>

            <p className="text-mono-xs text-[var(--ink3)]">
              Type-specific settings (theme, endpoint…) become available from Configure once the
              solution is created.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create solution"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
