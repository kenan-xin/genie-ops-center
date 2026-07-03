"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/provider";

type ResetMethod = "link" | "temp";

/**
 * 2-step "Reset password" account action (AP-00, prototype
 * `.dc.html:1142-1190`). Step 1 lets the admin choose email-link vs.
 * temporary-password and, for the temp branch, whether to require a change
 * at next sign-in (`requireChange`, FR-ADM-P-05). Continue calls the chosen
 * `trpc.users.*` mutation lazily — nothing is pre-generated — and step 2
 * reflects the real result, including the reveal-once temporary password.
 */
export function AccountActionDialog({
  person,
  open,
  onOpenChange,
}: {
  person: { id: string; name: string; email: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [method, setMethod] = useState<ResetMethod>("link");
  const [requireChange, setRequireChange] = useState(true);
  const [tempPassword, setTempPasswordResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const sendResetLink = useMutation(trpc.users.sendResetLink.mutationOptions());
  const setTempPassword = useMutation(trpc.users.setTempPassword.mutationOptions());
  const pending = sendResetLink.isPending || setTempPassword.isPending;

  function resetState() {
    setStep(1);
    setMethod("link");
    setRequireChange(true);
    setTempPasswordResult(null);
    setCopied(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  async function handleContinue() {
    if (!person) return;
    try {
      if (method === "link") {
        await sendResetLink.mutateAsync({ id: person.id });
      } else {
        const result = await setTempPassword.mutateAsync({ id: person.id, requireChange });
        setTempPasswordResult(result.tempPassword);
      }
    } catch (error) {
      toast({
        tone: "error",
        description: error instanceof Error ? error.message : "Couldn't complete this action.",
      });
      return;
    }
    // The action itself already succeeded — advance regardless of whether this
    // (best-effort) list refresh works. Notably, resetting the signed-in
    // admin's own password invalidates their session, which makes the
    // refetch below 403; that must not strand step 2's real result.
    setStep(2);
    void queryClient.invalidateQueries({ queryKey: trpc.users.list.queryKey() }).catch(() => {});
  }

  async function handleCopy() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    toast({ tone: "success", description: "Copied to clipboard." });
  }

  if (!person) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[430px]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-5 pb-4">
          <div className="min-w-0">
            <div className="font-mono text-mono-sm font-semibold tracking-[0.08em] text-[var(--brandink)] uppercase">
              Account action
            </div>
            <div className="mt-[3px] font-heading text-title font-extrabold text-foreground">
              Reset password
            </div>
            <div className="mt-px truncate text-small text-[var(--ink3)]">
              {person.name} · {person.email}
            </div>
          </div>
          <DialogClose
            aria-label="Close"
            className="shrink-0 cursor-pointer text-title text-[var(--ink3)] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            ✕
          </DialogClose>
        </div>

        <div className="p-5">
          {step === 1 ? (
            <>
              <p className="mb-3.5 text-body text-[var(--ink2)]">
                Choose how {person.name} regains access.
              </p>
              <div className="flex flex-col gap-2.5">
                <RadioCard
                  name="reset-method"
                  selected={method === "link"}
                  onSelect={() => setMethod("link")}
                  label="Email a reset link"
                  tag="RECOMMENDED"
                  description="A secure link is sent to their email; they set their own password."
                />
                <RadioCard
                  name="reset-method"
                  selected={method === "temp"}
                  onSelect={() => setMethod("temp")}
                  label="Set a temporary password"
                  description="Generate a one-time password to share over a secure channel."
                />
              </div>

              {method === "temp" ? (
                <div className="mt-3.5 flex items-center justify-between gap-2.5 border-t border-[var(--line2)] pt-3.5">
                  <span className="text-small text-foreground">
                    Require password change at next sign-in
                  </span>
                  <Switch checked={requireChange} onCheckedChange={setRequireChange} />
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 py-1.5 text-center">
              <span
                aria-hidden
                className="flex h-[38px] w-[38px] items-center justify-center border-[1.5px] border-[var(--success)] bg-[var(--successtint)] font-heading text-title font-extrabold text-[var(--success)]"
              >
                ✓
              </span>
              {method === "link" ? (
                <>
                  <div className="mt-2.5 font-heading text-title font-extrabold text-foreground">
                    Reset link sent
                  </div>
                  <p className="mt-1.5 text-small leading-relaxed text-[var(--ink2)]">
                    We emailed a secure reset link to{" "}
                    <b className="text-foreground">{person.email}</b>. It expires in 60 minutes.
                  </p>
                </>
              ) : (
                <>
                  <div className="mt-2.5 font-heading text-title font-extrabold text-foreground">
                    Temporary password set
                  </div>
                  <p className="mt-1.5 text-small leading-relaxed text-[var(--ink2)]">
                    Share this with {person.name} over a secure channel.
                  </p>
                  <div className="mt-3.5 flex w-full items-center gap-2 border border-[var(--line)] bg-[var(--panel)] p-3">
                    <span className="flex-1 truncate text-left font-mono text-title font-semibold tracking-[0.06em] text-foreground">
                      {tempPassword}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleCopy()}
                    >
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={pending} onClick={() => void handleContinue()}>
                {pending ? (method === "link" ? "Sending…" : "Generating…") : "Continue"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RadioCard({
  name,
  selected,
  onSelect,
  label,
  tag,
  description,
}: {
  name: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  tag?: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 border p-3 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        selected
          ? "border-[var(--brand)] bg-[var(--brandtint)]"
          : "border-[var(--line)] bg-transparent hover:bg-[var(--panel)]",
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-[16px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
          selected ? "border-[var(--brand)]" : "border-[var(--line)]",
        )}
      >
        {selected ? <span className="size-[8px] rounded-full bg-[var(--brand)]" /> : null}
      </span>
      <span className="flex-1">
        <span className="text-body font-bold text-foreground">
          {label}
          {tag ? (
            <span className="ml-1.5 bg-[var(--successtint)] px-[6px] py-[2px] font-mono text-mono-xs font-semibold text-[var(--success)] align-middle">
              {tag}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-small leading-relaxed text-[var(--ink3)]">
          {description}
        </span>
      </span>
    </label>
  );
}
