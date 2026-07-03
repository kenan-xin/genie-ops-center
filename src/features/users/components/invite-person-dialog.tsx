"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented";
import {
  SlideOver,
  SlideOverBody,
  SlideOverClose,
  SlideOverContent,
  SlideOverFooter,
  SlideOverHeader,
  SlideOverTitle,
} from "@/components/ui/slide-over";
import { useToast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/provider";

import { invitePersonSchema, ROLE_OPTIONS, type InvitePersonValues } from "../schemas/person";

/** Add a person (FR-ADM-P-02): name + email + role → pending person, reset-link email. Proto 1037-1090. */
export function InvitePersonDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InvitePersonValues>({
    resolver: zodResolver(invitePersonSchema),
    defaultValues: { name: "", email: "", role: "user" },
  });

  const invite = useMutation(trpc.users.invite.mutationOptions());

  const onSubmit = handleSubmit(async (values) => {
    try {
      await invite.mutateAsync(values);
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "Couldn't send the invite.",
      });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: trpc.users.list.queryKey() });
    toast({ tone: "success", description: `Invite sent to ${values.email}.` });
    reset();
    onOpenChange(false);
  });

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  return (
    <SlideOver
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(next);
        else handleClose();
      }}
    >
      <SlideOverContent className="max-w-[440px]">
        <SlideOverHeader className="flex-row items-center justify-between">
          <SlideOverTitle>Add person</SlideOverTitle>
          <SlideOverClose
            aria-label="Close"
            className="cursor-pointer text-title text-[var(--ink3)] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            ✕
          </SlideOverClose>
        </SlideOverHeader>

        <SlideOverBody>
          <form
            id="invite-person-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
            noValidate
          >
            <FormError message={errors.root?.message} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-name">Full name</Label>
              <Input
                id="invite-name"
                autoComplete="name"
                placeholder="Alex Morgan"
                {...register("name")}
              />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                placeholder="alex@company.com"
                {...register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <SegmentedControl
                    options={ROLE_OPTIONS}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            </div>
            <p className="text-mono-xs text-[var(--ink3)]">
              New people start with no solution access. Add them to a group on the{" "}
              <b className="text-foreground">Groups</b> tab to grant solutions.
            </p>
            <p className="text-small text-[var(--ink2)]">
              They&rsquo;ll get an email to set their own password. The account stays pending until
              they do.
            </p>
          </form>
        </SlideOverBody>

        <SlideOverFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="invite-person-form" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create person"}
          </Button>
        </SlideOverFooter>
      </SlideOverContent>
    </SlideOver>
  );
}
