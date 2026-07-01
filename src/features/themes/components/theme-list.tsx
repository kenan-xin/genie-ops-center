"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

import { useCreateTheme, useDeleteTheme, useThemesQuery } from "../api/themes";
import { createThemeInputSchema } from "../schemas/theme";

/** Chat theme management (FR-ADM-T-01): list, create, select (open editor), delete. */
export function ThemeList() {
  const { data: themes, isPending, isError, error } = useThemesQuery();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-sans text-display font-extrabold tracking-[-0.02em]">Themes</h1>
          <p className="text-small text-[var(--ink2)]">
            Chat presentation — header colour, bubbles, corner radius, font, and custom CSS.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New theme</Button>
      </header>

      {isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-small text-[var(--error)]">{(error as { message: string }).message}</p>
      ) : themes.length === 0 ? (
        <EmptyState
          title="No themes yet"
          description="Create a theme to style the chat header, bubbles, and font for your solutions."
          action={<Button onClick={() => setCreateOpen(true)}>New theme</Button>}
        />
      ) : (
        <ThemeTable themes={themes} />
      )}

      <CreateThemeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ThemeTable({
  themes,
}: {
  themes: { id: string; name: string; updatedAt: Date | string }[];
}) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const deleteTheme = useDeleteTheme();

  async function handleDelete(theme: { id: string; name: string }) {
    const ok = await confirm({
      title: `Delete "${theme.name}"?`,
      description:
        "This permanently deletes the theme. If it's assigned to a chat solution, deletion is blocked until the solution uses a different theme.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteTheme.mutateAsync({ id: theme.id });
      toast({ tone: "success", description: `Deleted "${theme.name}".` });
    } catch (e) {
      toast({ tone: "error", description: (e as { message: string }).message });
    }
  }

  return (
    <TableScroll>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {themes.map((theme) => (
            <TableRow key={theme.id}>
              <TableCell>
                <Link
                  href={`/admin/themes/${theme.id}`}
                  className="font-semibold text-foreground hover:underline"
                >
                  {theme.name}
                </Link>
              </TableCell>
              <TableCell className="text-[var(--ink2)]">
                {new Date(theme.updatedAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteTheme.isPending}
                  onClick={() => void handleDelete(theme)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableScroll>
  );
}

function CreateThemeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const createTheme = useCreateTheme();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(createThemeInputSchema), defaultValues: { name: "" } });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const created = await createTheme.mutateAsync(data);
      reset();
      onOpenChange(false);
      router.push(`/admin/themes/${created.id}`);
    } catch (e) {
      setError("name", { message: (e as { message: string }).message });
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
            <DialogTitle>New theme</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 px-5 pb-5">
            <Label htmlFor="theme-name">Name</Label>
            <Input id="theme-name" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create theme"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
