"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { css } from "@codemirror/lang-css";
import CodeMirror, { EditorView, Prec } from "@uiw/react-codemirror";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { useCreateTheme, useDeleteTheme, useThemesQuery, useUpdateTheme } from "../api/themes";
import {
  BUBBLE_SWATCHES,
  FONT_OPTIONS,
  HEADER_SWATCHES,
  RADIUS_PRESETS,
  THEME_PRESETS,
  themeConfigSchema,
  type ThemeConfig,
} from "../schemas/theme";
import { ThemePreview } from "./theme-preview";

const editorSchema = z.object({
  name: z.string().trim().min(1, "Enter a theme name").max(80, "Keep it under 80 characters"),
  config: themeConfigSchema,
});
type EditorValues = z.infer<typeof editorSchema>;

// Dark theme for the Custom CSS editor, matching the prototype's plain dark
// block (#0f1319 bg, IBM Plex Mono) — chrome only; token colors come from the
// `theme="dark"` base passed to <CodeMirror>. Must be applied via
// `Prec.highest` at the call site: @uiw/react-codemirror mounts the built-in
// oneDark stylesheet (from `theme="dark"`) AFTER extensions passed in the
// `extensions` prop, so on the equal-specificity `&` selector oneDark's
// #282c34 background wins the cascade unless this is given higher precedence.
const cssEditorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "#0f1319",
      color: "#cdd6e3",
      fontSize: "13px",
      border: "1px solid var(--line)",
    },
    ".cm-content": { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", padding: "10px 0" },
    ".cm-gutters": { backgroundColor: "#0f1319", color: "#4a5568", border: "none" },
    "&.cm-focused": { outline: "2px solid var(--brand)", outlineOffset: "-1px" },
    ".cm-cursor": { borderLeftColor: "#cdd6e3" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  },
  { dark: true },
);

const FONT_ITEMS = FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }));
const RADIUS_ITEMS = RADIUS_PRESETS.map((r) => ({ value: String(r.value), label: r.label }));

type ThemeRow = { id: string; name: string; config: ThemeConfig };

/**
 * Theme Builder (FR-ADM-T), proto 893-976: a SAVED THEMES swatch-chip strip
 * plus an inline editor below it — one screen, not a list page + edit page.
 * `selectedId` comes from the route (`/admin/themes` vs `/admin/themes/[id]`);
 * the index route auto-lands on the first saved theme once themes load.
 */
export function ThemeBuilder({ selectedId }: { selectedId: string | null }) {
  const router = useRouter();
  const { data: themes, isPending, isError, error } = useThemesQuery();
  const createTheme = useCreateTheme();
  const { toast } = useToast();

  const selected = themes?.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && themes && themes.length > 0) {
      router.replace(`/admin/themes/${themes[0]!.id}`);
    }
  }, [selectedId, themes, router]);

  async function handleNewTheme() {
    try {
      const created = await createTheme.mutateAsync({ name: "New theme" });
      router.push(`/admin/themes/${created.id}`);
    } catch (e) {
      toast({
        tone: "error",
        description: e instanceof Error ? e.message : "Couldn't create this theme.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-sans text-title font-extrabold tracking-[-0.02em]">Theme Builder</h1>
        <p className="text-small text-[var(--ink2)]">
          Build reusable themes, then apply one to any chat solution from Configure.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line2)] pb-5">
        <span className="mr-1 font-mono text-mono-xs font-semibold tracking-[0.07em] text-[var(--ink3)] uppercase">
          Saved themes
        </span>
        {isPending ? (
          <Skeleton className="h-8 w-56" />
        ) : (
          (themes ?? []).map((t) => (
            <ThemeChip
              key={t.id}
              theme={t}
              active={t.id === selectedId}
              onSelect={() => router.push(`/admin/themes/${t.id}`)}
            />
          ))
        )}
        <button
          type="button"
          onClick={() => void handleNewTheme()}
          disabled={createTheme.isPending}
          className="border border-dashed border-[var(--line)] px-2.5 py-1.5 font-sans text-small font-semibold text-[var(--brandink)] outline-none transition-colors hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          + New theme
        </button>
      </div>

      {isError ? (
        <p className="text-small text-[var(--error)]">
          {(error as { message?: string })?.message ?? "Couldn't load themes."}
        </p>
      ) : isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : selected ? (
        <ThemeBuilderEditor key={selected.id} theme={selected} allThemes={themes ?? []} />
      ) : (
        <EmptyState
          title="No themes yet"
          description="Create a theme to style the chat header, bubbles, and font for your solutions."
          action={<Button onClick={() => void handleNewTheme()}>New theme</Button>}
        />
      )}
    </div>
  );
}

function ThemeChip({
  theme,
  active,
  onSelect,
}: {
  theme: ThemeRow;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-[7px] border px-[11px] py-1.5 font-sans text-small font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-[var(--brand)] bg-[var(--brandtint)] text-[var(--ink)]"
          : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--panel)]",
      )}
    >
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-full border border-[rgba(0,0,0,0.15)]"
        style={{ background: theme.config.headerColor }}
      />
      {theme.name}
    </button>
  );
}

function ThemeBuilderEditor({ theme, allThemes }: { theme: ThemeRow; allThemes: ThemeRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const updateTheme = useUpdateTheme();
  const deleteTheme = useDeleteTheme();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditorValues>({
    resolver: zodResolver(editorSchema),
    defaultValues: { name: theme.name, config: theme.config },
  });

  const config = useWatch({ control, name: "config" });
  const name = useWatch({ control, name: "name" });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const saved = await updateTheme.mutateAsync({
        id: theme.id,
        name: data.name,
        config: data.config,
      });
      reset({ name: saved.name, config: saved.config });
      toast({ tone: "success", description: "Theme saved." });
    } catch (e) {
      toast({
        tone: "error",
        description: e instanceof Error ? e.message : "Couldn't save these changes.",
      });
    }
  });

  function applyPreset(preset: (typeof THEME_PRESETS)[number]) {
    setValue(
      "config",
      { ...config, ...preset.config, preset: preset.id },
      { shouldDirty: true, shouldValidate: true },
    );
  }

  async function handleDelete() {
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
      const next = allThemes.find((t) => t.id !== theme.id);
      router.push(next ? `/admin/themes/${next.id}` : "/admin/themes");
    } catch (e) {
      toast({
        tone: "error",
        description: e instanceof Error ? e.message : "Couldn't delete this theme.",
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex items-center justify-end">
        <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
      <FormError message={errors.root?.message} />

      <div className="flex flex-wrap items-start gap-8">
        <div className="min-w-[280px] flex-1 basis-[340px]">
          <Tabs defaultValue="presets">
            <TabsList className="flex w-full">
              <TabsTab value="presets" className="flex-1 px-2.5 text-center">
                Presets
              </TabsTab>
              <TabsTab value="elements" className="flex-1 px-2.5 text-center">
                Elements
              </TabsTab>
              <TabsTab value="css" className="flex-1 px-2.5 text-center">
                Custom CSS
              </TabsTab>
            </TabsList>

            <div className="border border-[var(--line)] p-[18px]">
              <TabsPanel value="presets" className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-3">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="flex flex-1 min-w-[118px] flex-col items-start gap-2 border border-[var(--line)] bg-[var(--surface)] p-3 text-left outline-none transition-colors hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-[var(--brand)] data-[active=true]:bg-[var(--brandtint)] data-[active=true]:hover:bg-[var(--brandtint)]"
                      data-active={config.preset === preset.id}
                    >
                      <span
                        aria-hidden
                        className="h-[30px] w-full"
                        style={{
                          background: `linear-gradient(90deg, ${preset.config.headerColor} 50%, ${preset.config.bubbleColor} 50%)`,
                        }}
                      />
                      <span className="text-small font-bold text-foreground">{preset.label}</span>
                      <span className="text-mono-xs text-[var(--ink3)]">{preset.description}</span>
                    </button>
                  ))}
                </div>
                <p className="text-mono-xs text-[var(--ink3)]">
                  Presets set header, bubbles and corners in one click. Fine-tune anything under
                  Elements.
                </p>
              </TabsPanel>

              <TabsPanel value="elements" className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Input id="theme-name" {...register("name")} placeholder="Theme name" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete()}
                      disabled={deleteTheme.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                  <FieldError message={errors.name?.message} />
                </div>

                <SwatchField
                  label="Header & accent"
                  swatches={HEADER_SWATCHES}
                  value={config.headerColor}
                  onChange={(v) =>
                    setValue("config.headerColor", v, { shouldDirty: true, shouldValidate: true })
                  }
                  error={errors.config?.headerColor?.message}
                />

                <SwatchField
                  label="User bubble"
                  swatches={BUBBLE_SWATCHES}
                  value={config.bubbleColor}
                  onChange={(v) =>
                    setValue("config.bubbleColor", v, { shouldDirty: true, shouldValidate: true })
                  }
                  error={errors.config?.bubbleColor?.message}
                />

                <div className="flex flex-col gap-1.5">
                  <Label>Corner radius</Label>
                  <SegmentedControl
                    options={RADIUS_ITEMS}
                    value={String(config.radius)}
                    onValueChange={(v) =>
                      setValue("config.radius", Number(v), {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  <FieldError message={errors.config?.radius?.message} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="font">Font</Label>
                  <Controller
                    control={control}
                    name="config.font"
                    render={({ field }) => (
                      <SegmentedControl
                        options={FONT_ITEMS}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    )}
                  />
                  <FieldError message={errors.config?.font?.message} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="placeholder">Input placeholder</Label>
                  <Input id="placeholder" {...register("config.placeholder")} />
                  <FieldError message={errors.config?.placeholder?.message} />
                </div>
              </TabsPanel>

              <TabsPanel value="css" className="flex flex-col gap-1.5">
                <Label>Custom CSS</Label>
                <Controller
                  control={control}
                  name="config.customCss"
                  render={({ field }) => (
                    <CodeMirror
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      height="220px"
                      theme="dark"
                      placeholder=".bubble.user { ... }"
                      extensions={[
                        css(),
                        Prec.highest(cssEditorTheme),
                        // Label the contenteditable textbox for screen readers (the old
                        // textarea had <Label htmlFor>; CodeMirror needs this explicitly).
                        EditorView.contentAttributes.of({ "aria-label": "Custom CSS" }),
                      ]}
                      basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        highlightActiveLine: false,
                        highlightActiveLineGutter: false,
                      }}
                    />
                  )}
                />
                <p className="text-small text-[var(--ink2)]">
                  Scoped to the chat preview and surface only — never applies to the admin or
                  workspace chrome.
                </p>
                <FieldError message={errors.config?.customCss?.message} />
              </TabsPanel>
            </div>
          </Tabs>
        </div>

        <div className="min-w-0 flex-1 basis-[360px]">
          <ThemePreview config={config} name={name} />
        </div>
      </div>
    </form>
  );
}

function SwatchField({
  label,
  swatches,
  value,
  onChange,
  error,
}: {
  label: string;
  swatches: readonly string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        {swatches.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            aria-pressed={value === hex}
            onClick={() => onChange(hex)}
            className="size-[26px] shrink-0 rounded-full outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              background: hex,
              boxShadow:
                value === hex
                  ? "0 0 0 2px var(--surface), 0 0 0 4px var(--ink)"
                  : "0 0 0 2px var(--surface), 0 0 0 3px var(--line)",
            }}
          />
        ))}
        <span className="font-mono text-mono-sm text-[var(--ink2)]">{value}</span>
      </div>
      <FieldError message={error} />
    </div>
  );
}
