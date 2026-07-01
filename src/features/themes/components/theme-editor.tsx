"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

import { useThemeQuery, useUpdateTheme } from "../api/themes";
import { FONT_OPTIONS, THEME_PRESETS, themeConfigSchema, type ThemeConfig } from "../schemas/theme";
import { ThemePreview } from "./theme-preview";

const editorSchema = z.object({
  name: z.string().trim().min(1, "Enter a theme name").max(80, "Keep it under 80 characters"),
  config: themeConfigSchema,
});
type EditorValues = z.infer<typeof editorSchema>;

const FONT_ITEMS = FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }));

export function ThemeEditor({ themeId }: { themeId: string }) {
  const { data: theme, isPending, isError, error } = useThemeQuery(themeId);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-40 w-full max-w-[420px]" />
      </div>
    );
  }
  if (isError) {
    return <FormError message={(error as { message: string }).message} />;
  }
  return <ThemeEditorForm key={theme.id} theme={theme} />;
}

function ThemeEditorForm({ theme }: { theme: { id: string; name: string; config: ThemeConfig } }) {
  const { toast } = useToast();
  const updateTheme = useUpdateTheme();

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
      toast({ tone: "error", description: (e as { message: string }).message });
    }
  });

  function applyPreset(preset: (typeof THEME_PRESETS)[number]) {
    setValue(
      "config",
      { ...config, ...preset.config, preset: preset.id },
      { shouldDirty: true, shouldValidate: true },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/themes"
          className="font-mono text-mono-xs font-semibold tracking-[0.1em] text-[var(--ink3)] uppercase hover:text-foreground"
        >
          ← Themes
        </Link>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme name</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 pt-0">
          <Input {...register("name")} />
          <FieldError message={errors.name?.message} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-start gap-8">
        <Card className="w-full max-w-[420px]">
          <CardContent className="p-5">
            <Tabs defaultValue="presets">
              <TabsList>
                <TabsTab value="presets">Presets</TabsTab>
                <TabsTab value="elements">Elements</TabsTab>
                <TabsTab value="css">Custom CSS</TabsTab>
              </TabsList>

              <TabsPanel value="presets" className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="flex flex-col items-start gap-2 border border-[var(--line)] p-3 text-left outline-none transition-colors hover:bg-[var(--panel)] focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-[var(--brand)]"
                      data-active={config.preset === preset.id}
                    >
                      <span className="flex gap-1">
                        <span
                          aria-hidden
                          className="size-4 border border-[var(--line)]"
                          style={{ background: preset.config.headerColor }}
                        />
                        <span
                          aria-hidden
                          className="size-4 border border-[var(--line)]"
                          style={{ background: preset.config.bubbleColor }}
                        />
                      </span>
                      <span className="text-small font-semibold text-foreground">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </TabsPanel>

              <TabsPanel value="elements" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Header colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      {...register("config.headerColor")}
                      className="h-10 w-16 cursor-pointer border border-[var(--line)] bg-[var(--surface)] p-0"
                    />
                    <span className="font-mono text-mono-sm text-[var(--ink2)]">
                      {config.headerColor}
                    </span>
                  </div>
                  <FieldError message={errors.config?.headerColor?.message} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>User bubble colour</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      {...register("config.bubbleColor")}
                      className="h-10 w-16 cursor-pointer border border-[var(--line)] bg-[var(--surface)] p-0"
                    />
                    <span className="font-mono text-mono-sm text-[var(--ink2)]">
                      {config.bubbleColor}
                    </span>
                  </div>
                  <FieldError message={errors.config?.bubbleColor?.message} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="radius">Corner radius — {config.radius}px</Label>
                  <input
                    id="radius"
                    type="range"
                    min={0}
                    max={28}
                    step={1}
                    {...register("config.radius", { valueAsNumber: true })}
                  />
                  <FieldError message={errors.config?.radius?.message} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="font">Font</Label>
                  <Controller
                    control={control}
                    name="config.font"
                    render={({ field }) => (
                      <Select
                        name={field.name}
                        items={FONT_ITEMS}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
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
                <Label htmlFor="customCss">Custom CSS</Label>
                <Textarea
                  id="customCss"
                  rows={12}
                  spellCheck={false}
                  placeholder=".bubble.user { ... }"
                  {...register("config.customCss")}
                />
                <p className="text-small text-[var(--ink2)]">
                  Scoped to the chat preview and surface only — never applies to the admin or
                  workspace chrome.
                </p>
                <FieldError message={errors.config?.customCss?.message} />
              </TabsPanel>
            </Tabs>
          </CardContent>
        </Card>

        <div className="flex flex-1 justify-center pt-2">
          <ThemePreview config={config} />
        </div>
      </div>
    </form>
  );
}
