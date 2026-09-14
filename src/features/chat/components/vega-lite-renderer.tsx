"use client";

import type { CustomRendererProps } from "streamdown";
import { useEffect, useRef, useState } from "react";
import type { Result, VisualizationSpec } from "vega-embed";

import { parseInlineVegaLiteSpec } from "@/features/chat/lib/vega-lite";

export function VegaLiteRenderer({ code, isIncomplete }: CustomRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isIncomplete || !containerRef.current) return;

    const container = containerRef.current;
    let disposed = false;
    let result: Result | undefined;
    container.replaceChildren();
    setError(null);

    const render = async () => {
      try {
        const spec = parseInlineVegaLiteSpec(code) as VisualizationSpec;
        const { default: embed } = await import("vega-embed");
        if (disposed) return;

        const nextResult = await embed(container, spec, {
          actions: false,
          renderer: "svg",
        });
        if (disposed) {
          nextResult.finalize();
          return;
        }
        result = nextResult;
      } catch {
        if (!disposed) setError("This Vega-Lite chart could not be rendered.");
      }
    };

    void render();
    return () => {
      disposed = true;
      result?.finalize();
      container.replaceChildren();
    };
  }, [code, isIncomplete]);

  if (isIncomplete) {
    return (
      <output className="my-4 block border border-[var(--line)] bg-[var(--panel)] px-4 py-6 text-center text-small text-[var(--ink2)]">
        Rendering visualization…
      </output>
    );
  }

  return (
    <figure className="my-4 min-w-0 border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="w-full overflow-x-auto" ref={containerRef} />
      {error ? (
        <figcaption className="mt-2 text-small text-[var(--error)]" role="alert">
          {error}
        </figcaption>
      ) : null}
    </figure>
  );
}
