"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SlideOver,
  SlideOverBody,
  SlideOverContent,
  SlideOverFooter,
  SlideOverHeader,
  SlideOverTitle,
} from "@/components/ui/slide-over";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { relativeTime } from "@/lib/relative-time";
import { useTRPC } from "@/trpc/provider";

import {
  editPersonSchema,
  STATUS_LABEL,
  type EditPersonValues,
  type Person,
  type PersonStatus,
} from "../schemas/person";
import { TempPasswordDialog } from "./temp-password-dialog";

const STATUS_TONE = { active: "success", pending: "warn", disabled: "neutral" } as const;
const DOTTED_STATUS = new Set<PersonStatus>(["active", "pending"]);

export function EditPersonSlideOver({
  person,
  open,
  onOpenChange,
}: {
  person: Person | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isSelf = Boolean(person && session?.user.id === person.id);

  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.users.list.queryKey() });

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditPersonValues>({
    resolver: zodResolver(editPersonSchema),
    values: person
      ? { id: person.id, name: person.name, email: person.email, role: person.role }
      : undefined,
  });

  const update = useMutation(trpc.users.update.mutationOptions());
  const disable = useMutation(trpc.users.disable.mutationOptions());
  const enable = useMutation(trpc.users.enable.mutationOptions());
  const sendResetLink = useMutation(trpc.users.sendResetLink.mutationOptions());
  const setTemp = useMutation(trpc.users.setTempPassword.mutationOptions());
  const activate = useMutation(trpc.users.activate.mutationOptions());
  const forceSignOut = useMutation(trpc.users.forceSignOut.mutationOptions());
  const remove = useMutation(trpc.users.remove.mutationOptions());

  if (!person) return null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "Couldn't save these changes.",
      });
      return;
    }
    await invalidate();
    toast({ tone: "success", description: "Person updated." });
  });

  async function withToast(action: () => Promise<unknown>, success: string, failure: string) {
    try {
      await action();
    } catch (error) {
      toast({ tone: "error", description: error instanceof Error ? error.message : failure });
      return;
    }
    await invalidate();
    toast({ tone: "success", description: success });
  }

  async function handleDisable() {
    const ok = await confirm({
      title: `Disable ${person!.name}?`,
      description:
        "They'll be signed out everywhere and won't be able to sign in until re-enabled.",
      confirmLabel: "Disable",
      tone: "danger",
    });
    if (ok)
      void withToast(
        () => disable.mutateAsync({ id: person!.id }),
        "Person disabled.",
        "Couldn't disable this person.",
      );
  }

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove ${person!.name}?`,
      description:
        "This can't be undone. They'll lose access and all group memberships immediately.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: person!.id });
    } catch (error) {
      toast({
        tone: "error",
        description: error instanceof Error ? error.message : "Couldn't remove this person.",
      });
      return;
    }
    await invalidate();
    toast({ tone: "success", description: "Person removed." });
    onOpenChange(false);
  }

  async function handleForceSignOut() {
    const ok = await confirm({
      title: `Sign out ${person!.name} everywhere?`,
      description: "Every active session for this person will be revoked immediately.",
      confirmLabel: "Sign out everywhere",
      tone: "danger",
    });
    if (ok) {
      void withToast(
        () => forceSignOut.mutateAsync({ id: person!.id }),
        "Signed out everywhere.",
        "Couldn't sign this person out.",
      );
    }
  }

  async function handleSetTempPassword() {
    try {
      const result = await setTemp.mutateAsync({ id: person!.id });
      setTempPassword(result.tempPassword);
    } catch (error) {
      toast({
        tone: "error",
        description: error instanceof Error ? error.message : "Couldn't set a temporary password.",
      });
      return;
    }
    await invalidate();
  }

  async function handleActivate() {
    try {
      const result = await activate.mutateAsync({ id: person!.id });
      setTempPassword(result.tempPassword);
    } catch (error) {
      toast({
        tone: "error",
        description: error instanceof Error ? error.message : "Couldn't activate this person.",
      });
      return;
    }
    await invalidate();
  }

  const busy =
    update.isPending ||
    disable.isPending ||
    enable.isPending ||
    sendResetLink.isPending ||
    setTemp.isPending ||
    activate.isPending ||
    forceSignOut.isPending ||
    remove.isPending;

  return (
    <>
      <SlideOver open={open} onOpenChange={onOpenChange}>
        <SlideOverContent>
          <SlideOverHeader>
            <div className="flex items-center gap-2">
              <SlideOverTitle>{person.name}</SlideOverTitle>
              <StatusBadge tone={STATUS_TONE[person.status]} dot={DOTTED_STATUS.has(person.status)}>
                {STATUS_LABEL[person.status]}
              </StatusBadge>
            </div>
            <span className="text-small text-[var(--ink2)]">{person.email}</span>
          </SlideOverHeader>

          <SlideOverBody className="flex flex-col gap-8">
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <FormError message={errors.root?.message} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" autoComplete="name" {...register("name")} />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" autoComplete="email" {...register("email")} />
                <FieldError message={errors.email?.message} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="edit-admin">Admin access</Label>
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <Switch
                      id="edit-admin"
                      name={field.name}
                      checked={field.value === "admin"}
                      onCheckedChange={(checked) => field.onChange(checked ? "admin" : "user")}
                      onBlur={field.onBlur}
                      disabled={isSelf}
                    />
                  )}
                />
              </div>
              <div className="flex">
                <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
                  {isSubmitting ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>

            <section className="flex flex-col gap-2">
              <Label>Groups</Label>
              {person.groups.length === 0 ? (
                <p className="text-small text-[var(--ink3)]">Not a member of any group yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {person.groups.map((g) => (
                    <Link key={g.id} href={`/admin/groups/${g.id}`}>
                      <StatusBadge tone="neutral" className="cursor-pointer hover:opacity-80">
                        {g.name}
                      </StatusBadge>
                    </Link>
                  ))}
                </div>
              )}
              <p className="text-mono-xs text-[var(--ink3)]">
                Last active: {person.lastActiveAt ? relativeTime(person.lastActiveAt) : "Never"}
              </p>
            </section>

            <section className="flex flex-col gap-2 border-t border-[var(--line2)] pt-5">
              <Label>Lifecycle</Label>
              {person.status === "pending" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleActivate()}
                  >
                    Activate now
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void withToast(
                        () => sendResetLink.mutateAsync({ id: person.id }),
                        "Invite resent.",
                        "Couldn't resend the invite.",
                      )
                    }
                  >
                    Resend invite
                  </Button>
                </div>
              ) : person.status === "disabled" ? (
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void withToast(
                        () => enable.mutateAsync({ id: person.id }),
                        "Person enabled.",
                        "Couldn't enable this person.",
                      )
                    }
                  >
                    Enable
                  </Button>
                </div>
              ) : (
                <div className="flex">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy || isSelf}
                    title={isSelf ? "You can't disable your own account." : undefined}
                    onClick={() => void handleDisable()}
                  >
                    Disable
                  </Button>
                </div>
              )}
            </section>

            {person.status !== "pending" ? (
              <section className="flex flex-col gap-2 border-t border-[var(--line2)] pt-5">
                <Label>Security</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void withToast(
                        () => sendResetLink.mutateAsync({ id: person.id }),
                        "Password reset link sent.",
                        "Couldn't send a reset link.",
                      )
                    }
                  >
                    Email reset link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleSetTempPassword()}
                  >
                    Set temporary password
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || isSelf}
                    title={isSelf ? "You can't force-sign-out your own account." : undefined}
                    onClick={() => void handleForceSignOut()}
                  >
                    Force sign-out
                  </Button>
                </div>
              </section>
            ) : null}

            <section className="flex flex-col gap-2 border-t border-[var(--line2)] pt-5">
              <Label>Danger zone</Label>
              <div className="flex">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy || isSelf}
                  title={isSelf ? "You can't remove your own account." : undefined}
                  onClick={() => void handleRemove()}
                >
                  Remove person
                </Button>
              </div>
            </section>
          </SlideOverBody>

          <SlideOverFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </SlideOverFooter>
        </SlideOverContent>
      </SlideOver>

      <TempPasswordDialog
        name={person.name}
        tempPassword={tempPassword}
        onOpenChange={(next) => {
          if (!next) setTempPassword(null);
        }}
      />
    </>
  );
}
