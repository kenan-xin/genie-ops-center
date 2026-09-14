const MAX_VEGA_LITE_SPEC_LENGTH = 100_000;
const URL_VALUE = /^(?:https?:)?\/\//i;
const SAFE_SCHEMA = /^https:\/\/vega\.github\.io\/schema\/vega-lite\/v\d+(?:\.\d+)?\.json$/i;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type InlineVegaLiteSpec = Record<string, unknown>;

function assertNoExternalResources(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoExternalResources);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) throw new Error("Unsupported Vega-Lite property");

    if (typeof child === "string" && URL_VALUE.test(child)) {
      if (key !== "$schema" || !SAFE_SCHEMA.test(child)) {
        throw new Error("External URLs are not supported in Vega-Lite charts");
      }
    }

    assertNoExternalResources(child);
  }
}

export function parseInlineVegaLiteSpec(code: string): InlineVegaLiteSpec {
  if (code.length > MAX_VEGA_LITE_SPEC_LENGTH) {
    throw new Error("Vega-Lite chart is too large to render");
  }

  const parsed: unknown = JSON.parse(code);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Vega-Lite chart must be a JSON object");
  }

  assertNoExternalResources(parsed);
  return parsed as InlineVegaLiteSpec;
}
