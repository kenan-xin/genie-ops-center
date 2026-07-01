"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useTRPC } from "@/trpc/provider";

import { invitePersonSchema, type InvitePersonValues } from "../schemas/person";

/** Invite (FR-ADM-P-02): name + email + role → pending person, reset-link email. */
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a person</DialogTitle>
          <DialogDescription>
            They&rsquo;ll get an email to set their own password. The account stays pending until
            they do.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 px-5 pb-1" noValidate>
          <FormError message={errors.root?.message} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-name">Name</Label>
            <Input id="invite-name" autoComplete="name" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" autoComplete="email" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[var(--line2)] pt-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="invite-admin">Grant admin access</Label>
              <span className="text-small text-[var(--ink2)]">
                Admins get the Admin Portal on top of normal access.
              </span>
            </div>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Switch
                  id="invite-admin"
                  name={field.name}
                  checked={field.value === "admin"}
                  onCheckedChange={(checked) => field.onChange(checked ? "admin" : "user")}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => void onSubmit()} disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
