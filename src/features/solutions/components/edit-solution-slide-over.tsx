"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FieldError, FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useThemesQuery } from "@/features/themes/api/themes";
import { ThemePreview } from "@/features/themes/components/theme-preview";
import { DEFAULT_THEME_CONFIG } from "@/features/themes/schemas/theme";

import { useUpdateSolution } from "../api/solutions";
import {
  DEFAULT_CHAT_API_ENDPOINT,
  editSolutionSchema,
  statusTone,
  STATUS_LABEL,
  TYPE_LABEL,
  type ChatConfig,
  type EditSolutionValues,
  type Solution,
  type SolutionType,
} from "../schemas/solution";

/**
 * Configure a solution (FR-ADM-S-03). Edits name/description/type and the
 * per-type config; binds a theme ONLY when type=chat (the dropdown is shown
 * then, and the procedure re-checks the themeId⇔type invariant at the boundary).
 */
export function EditSolutionSlideOver({
  solution,
  open,
  onOpenChange,
}: {
  solution: Solution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <SlideOver open={open} onOpenChange={onOpenChange}>
      <SlideOverContent>
        {solution ? (
          <EditSolutionForm key={solution.id} solution={solution} onOpenChange={onOpenChange} />
        ) : null}
      </SlideOverContent>
    </SlideOver>
  );
}

function EditSolutionForm({
  solution,
  onOpenChange,
}: {
  solution: Solution;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const update = useUpdateSolution();
  const { data: themes } = useThemesQuery();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditSolutionValues>({
    resolver: zodResolver(editSolutionSchema),
    defaultValues: toFormValues(solution),
  });

  const type = watch("type");
  const themeId = watch("themeId");

  const [startersText, setStartersText] = useState(
    () =>
      (solution.type === "chat" ? (solution.config as ChatConfig).starterPrompts : undefined)?.join(
        " · ",
      ) ?? "",
  );

  function onStartersChange(text: string) {
    setStartersText(text);
    const items = text
      .split("·")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    setValue("config.starterPrompts", items.length > 0 ? items : undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function selectType(next: SolutionType) {
    setValue("type", next, { shouldDirty: true, shouldValidate: true });
    setValue(
      "config",
      next === "chat"
        ? {
            botUuid: "",
            apiEndpoint: DEFAULT_CHAT_API_ENDPOINT,
            welcomeMessage: "",
            feedbackEnabled: true,
          }
        : { iframeUrl: "" },
      { shouldDirty: true, shouldValidate: true },
    );
    if (next !== "chat") setValue("themeId", null, { shouldDirty: true });
    setStartersText("");
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      reset(toFormValues(saved));
      setStartersText(
        (saved.type === "chat" ? (saved.config as ChatConfig).starterPrompts : undefined)?.join(
          " · ",
        ) ?? "",
      );
      toast({ tone: "success", description: "Solution saved." });
    } catch (e) {
      setError("root", {
        message: e instanceof Error ? e.message : "Couldn't save these changes.",
      });
    }
  });

  const themeItems = [
    { value: "", label: "No theme" },
    ...(themes ?? []).map((t) => ({ value: t.id, label: t.name })),
  ];
  const selectedThemeConfig = themes?.find((t) => t.id === themeId)?.config ?? DEFAULT_THEME_CONFIG;

  return (
    <>
      <SlideOverHeader>
        <div className="flex items-center gap-2">
          <SlideOverTitle>{solution.name}</SlideOverTitle>
          <StatusBadge tone={statusTone(solution.status)} dot>
            {STATUS_LABEL[solution.status]}
          </StatusBadge>
          {solution.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
        </div>
        <span className="text-small text-[var(--ink2)]">
          {TYPE_LABEL[solution.type]} · /s/{solution.slug}
        </span>
      </SlideOverHeader>

      <SlideOverBody className="flex flex-col gap-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          <FormError message={errors.root?.message} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea id="edit-desc" rows={2} {...register("description")} />
            <FieldError message={errors.description?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  name={field.name}
                  items={[
                    { value: "chat", label: "Chat" },
                    { value: "embedded", label: "Embedded" },
                  ]}
                  value={field.value}
                  onValueChange={(v) => selectType(v as SolutionType)}
                  onBlur={field.onBlur}
                />
              )}
            />
            <p className="text-mono-xs text-[var(--ink3)]">
              Switching type clears the type-specific config below.
            </p>
          </div>

          {type === "chat" ? (
            <ChatConfigFields
              register={register}
              control={control}
              errors={errors}
              startersText={startersText}
              onStartersChange={onStartersChange}
            />
          ) : (
            <EmbeddedConfigFields register={register} errors={errors} />
          )}

          {type === "chat" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Theme</Label>
              <Controller
                control={control}
                name="themeId"
                render={({ field }) => (
                  <Select
                    name={field.name}
                    items={themeItems}
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v === "" ? null : v)}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <p className="text-mono-xs text-[var(--ink3)]">
                Applied to the customer chat surface. Manage themes under Themes.
              </p>
              <ThemePreview config={selectedThemeConfig} />
            </div>
          ) : null}

          <div className="flex">
            <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </SlideOverBody>

      <SlideOverFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </SlideOverFooter>
    </>
  );
}

type FormRegister = ReturnType<typeof useForm<EditSolutionValues>>["register"];
type FormControl = ReturnType<typeof useForm<EditSolutionValues>>["control"];
type FormErrors = ReturnType<typeof useForm<EditSolutionValues>>["formState"]["errors"];

function ChatConfigFields({
  register,
  control,
  errors,
  startersText,
  onStartersChange,
}: {
  register: FormRegister;
  control: FormControl;
  errors: FormErrors;
  startersText: string;
  onStartersChange: (text: string) => void;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-[var(--line2)] pt-5">
      <Label>Chat configuration</Label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chat-bot">Bot UUID</Label>
        <Input
          id="chat-bot"
          placeholder="The Genie bot id this solution talks to"
          {...register("config.botUuid")}
        />
        <FieldError
          message={(errors.config as { botUuid?: { message?: string } })?.botUuid?.message}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chat-endpoint">Chat streaming API endpoint</Label>
        <Input
          id="chat-endpoint"
          placeholder="https://dev-genie.001.gs/public-api/v2/workflow/chatbot/chats"
          {...register("config.apiEndpoint")}
        />
        <p className="text-mono-xs text-[var(--ink3)]">
          Where this solution streams responses from. Must be an approved origin.
        </p>
        <FieldError
          message={(errors.config as { apiEndpoint?: { message?: string } })?.apiEndpoint?.message}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chat-welcome">Welcome message</Label>
        <Textarea
          id="chat-welcome"
          rows={3}
          placeholder="Shown when a conversation starts"
          {...register("config.welcomeMessage")}
        />
        <FieldError
          message={
            (errors.config as { welcomeMessage?: { message?: string } })?.welcomeMessage?.message
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="chat-starters">Conversation starters</Label>
        <Input
          id="chat-starters"
          placeholder="e.g. Track my claim · Talk to a person"
          value={startersText}
          onChange={(e) => onStartersChange(e.target.value)}
        />
        <p className="text-mono-xs text-[var(--ink3)]">
          Separate with · — shown as quick-reply chips in the chat.
        </p>
        <FieldError
          message={
            (errors.config as { starterPrompts?: { message?: string } })?.starterPrompts?.message
          }
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="chat-feedback">Collect feedback</Label>
        <Controller
          control={control}
          name="config.feedbackEnabled"
          render={({ field }) => (
            <Switch
              id="chat-feedback"
              name={field.name}
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </div>
    </section>
  );
}

function EmbeddedConfigFields({
  register,
  errors,
}: {
  register: FormRegister;
  errors: FormErrors;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-[var(--line2)] pt-5">
      <Label>Embedded configuration</Label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="embed-iframe">iframe URL</Label>
        <Input
          id="embed-iframe"
          placeholder="https://example.com/app"
          {...register("config.iframeUrl")}
        />
        <FieldError
          message={(errors.config as { iframeUrl?: { message?: string } })?.iframeUrl?.message}
        />
        <p className="text-mono-xs text-[var(--ink3)]">
          Must be HTTPS. Allowed origins are controlled by ALLOWED_IFRAME_ORIGINS.
        </p>
      </div>
    </section>
  );
}

function toFormValues(s: Solution): EditSolutionValues {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? undefined,
    type: s.type,
    config:
      s.type === "chat"
        ? {
            botUuid: (s.config as { botUuid?: string }).botUuid ?? "",
            apiEndpoint:
              (s.config as { apiEndpoint?: string }).apiEndpoint ?? DEFAULT_CHAT_API_ENDPOINT,
            welcomeMessage: (s.config as { welcomeMessage?: string }).welcomeMessage ?? "",
            starterPrompts: (s.config as { starterPrompts?: string[] }).starterPrompts,
            feedbackEnabled: (s.config as { feedbackEnabled?: boolean }).feedbackEnabled ?? false,
          }
        : { iframeUrl: (s.config as { iframeUrl?: string }).iframeUrl ?? "" },
    themeId: s.themeId,
  };
}
