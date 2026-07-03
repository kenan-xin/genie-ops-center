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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/provider";

import {
  editPersonSchema,
  ROLE_OPTIONS,
  type EditPersonValues,
  type Person,
} from "../schemas/person";
import { AccountActionDialog } from "./account-action-dialog";
import { TempPasswordDialog } from "./temp-password-dialog";

/** Edit person (FR-ADM-P-03/04/05/06). Proto 1029-1090 — "Add person" and
 * "Edit person" share one modal there; here they're split into
 * `InvitePersonDialog` (add) and this component (edit), each carrying only
 * the fields/actions relevant to its mode. */
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
  const [accountActionOpen, setAccountActionOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.users.list.queryKey() });

  const {
    control,
    register,
    handleSubmit,
    reset,
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
  const activate = useMutation(trpc.users.activate.mutationOptions());
  const forceSignOut = useMutation(trpc.users.forceSignOut.mutationOptions());
  const remove = useMutation(trpc.users.remove.mutationOptions());

  if (!person) return null;

  function handleClose() {
    reset({ id: person!.id, name: person!.name, email: person!.email, role: person!.role });
    onOpenChange(false);
  }

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
    activate.isPending ||
    forceSignOut.isPending ||
    remove.isPending;

  return (
    <>
      <SlideOver
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(next);
          else handleClose();
        }}
      >
        <SlideOverContent className="max-w-[440px]">
          <SlideOverHeader className="flex-row items-center justify-between">
            <SlideOverTitle>Edit person</SlideOverTitle>
            <SlideOverClose
              aria-label="Close"
              className="cursor-pointer text-title text-[var(--ink3)] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              ✕
            </SlideOverClose>
          </SlideOverHeader>

          <SlideOverBody className="flex flex-col gap-6">
            <form
              id="edit-person-form"
              onSubmit={onSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              <FormError message={errors.root?.message} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Full name</Label>
                <Input id="edit-name" autoComplete="name" {...register("name")} />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" autoComplete="email" {...register("email")} />
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
                      disabled={isSelf}
                    />
                  )}
                />
                {isSelf ? (
                  <p className="text-mono-xs text-[var(--ink3)]">
                    You can&rsquo;t change your own role.
                  </p>
                ) : null}
              </div>
            </form>

            {person.status === "pending" ? (
              <div className="flex flex-col gap-2 border border-[var(--warn)] bg-[var(--warntint)] p-3">
                <span className="font-mono text-mono-xs font-semibold tracking-[0.08em] text-[var(--warn)] uppercase">
                  ● Invite pending
                </span>
                <p className="text-small text-[var(--ink2)]">
                  An invitation was emailed. They become active once they accept and set a password.
                </p>
                <div className="flex flex-wrap gap-2">
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
                  <Button
                    variant="dark"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleActivate()}
                  >
                    Mark as active
                  </Button>
                </div>
              </div>
            ) : null}

            <section className="flex flex-col gap-2 border-t border-[var(--line2)] pt-5">
              <Label>Member of · {person.groups.length}</Label>
              {person.groups.length === 0 ? (
                <p className="text-small text-[var(--ink3)]">
                  Not in any group, so no access yet. Open a group on the{" "}
                  <b className="text-foreground">Groups</b> tab to add them.
                </p>
              ) : (
                <>
                  <div className="border border-[var(--line)]">
                    {person.groups.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-2.5 border-b border-[var(--line2)] px-3 py-2.5 last:border-b-0"
                      >
                        <span className="text-small font-semibold text-foreground">{g.name}</span>
                        <Link
                          href={`/admin/groups/${g.id}`}
                          className="text-mono-xs font-semibold whitespace-nowrap text-[var(--brandink)] hover:underline"
                        >
                          Edit in group →
                        </Link>
                      </div>
                    ))}
                  </div>
                  <p className="text-mono-xs text-[var(--ink3)]">
                    To change what this person can open, open one of their groups — access is set
                    there, not per person.
                  </p>
                </>
              )}
            </section>

            <section className="flex flex-col gap-3 border-t border-[var(--line2)] pt-5">
              <Label>Account actions</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setAccountActionOpen(true)}
                >
                  Reset password
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

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-small font-semibold text-foreground">Account active</span>
                  <span className="text-mono-xs text-[var(--ink3)]">
                    Disabled people can&rsquo;t sign in.
                  </span>
                </div>
                <Switch
                  checked={person.status !== "disabled"}
                  disabled={busy || isSelf}
                  title={isSelf ? "You can't disable your own account." : undefined}
                  onCheckedChange={(checked) =>
                    void (checked
                      ? withToast(
                          () => enable.mutateAsync({ id: person.id }),
                          "Person enabled.",
                          "Couldn't enable this person.",
                        )
                      : handleDisable())
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3 border border-[var(--line)] p-3">
                <div className="min-w-0">
                  <div className="text-small font-semibold text-foreground">Remove person</div>
                  <div className="text-mono-xs text-[var(--ink3)]">
                    Revokes access and removes them from all groups.
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy || isSelf}
                  title={isSelf ? "You can't remove your own account." : undefined}
                  onClick={() => void handleRemove()}
                >
                  Remove
                </Button>
              </div>
            </section>
          </SlideOverBody>

          <SlideOverFooter>
            <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="edit-person-form" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </SlideOverFooter>
        </SlideOverContent>
      </SlideOver>

      {/* Reveal-once temp password from "Mark as active" (FR-ADM-P-04) — the
          "Reset password" account action below owns its own reveal for the
          temp-password branch via AccountActionDialog. */}
      <TempPasswordDialog
        name={person.name}
        tempPassword={tempPassword}
        onOpenChange={(next) => {
          if (!next) setTempPassword(null);
        }}
      />

      <AccountActionDialog
        person={person}
        open={accountActionOpen}
        onOpenChange={setAccountActionOpen}
      />
    </>
  );
}
