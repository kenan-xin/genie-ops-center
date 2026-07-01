"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

/**
 * Reveal-once surface for an admin-generated temporary password (FR-ADM-P-05).
 * Nothing persists this beyond the mutation response — closing the dialog
 * discards it from state, so it must be copied out here or not at all.
 */
export function TempPasswordDialog({
  name,
  tempPassword,
  onOpenChange,
}: {
  name: string;
  tempPassword: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  return (
    <Dialog open={tempPassword !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Temporary password for {name}</DialogTitle>
          <DialogDescription>
            Shown once. Share it with {name} through a secure channel — they&rsquo;ll be asked to
            set a new password on their next sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 px-5 pb-1">
          <Input readOnly value={tempPassword ?? ""} className="font-mono" />
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              if (!tempPassword) return;
              await navigator.clipboard.writeText(tempPassword);
              toast({ tone: "success", description: "Copied to clipboard." });
            }}
          >
            Copy
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
