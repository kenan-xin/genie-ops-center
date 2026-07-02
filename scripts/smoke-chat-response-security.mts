/**
 * Smoke check for ticket 14's `Response` hardening (critique invariant: the
 * Streamdown security config is explicit, not default — see
 * src/features/chat/lib/response-hardening.ts and
 * src/components/ai-elements/response.tsx, which this reproduces the
 * wrapping of below). Run:
 *
 *   node scripts/smoke-chat-response-security.mts
 *
 * Not a test framework — one file, asserts, exits non-zero on the first
 * category of failures (matches scripts/smoke-chat-proxy.ts). Plain `node`
 * (not `tsx`) on purpose: the installed `streamdown` ships an ESM-only
 * `exports` map with no `require` condition, which trips up `tsx`'s
 * tsconfig-paths resolution shim (`resolveTsPaths` falls back to the legacy
 * CJS `Module._findPath`, which doesn't understand it) — a tooling
 * incompatibility, not a bug in our code. Node's native TS/ESM resolution
 * (this file, relative imports only, no `@/` aliases) handles it natively.
 * Renders the real hardening pipeline server-side (`react-dom/server`)
 * against inputs drawn from the observed external-chat-api-contract,
 * including the split-across-deltas case (rendering the same accumulating
 * string at successive "delta" boundaries, the way `useChat` would).
 *
 * Covers the acceptance criterion directly: split-across-deltas tags,
 * `<script>`, an unsafe link, a `data:` image, and the observed green
 * `<span style="color:#52c41a">` -> safe + Ledger-correct output.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Streamdown } from "streamdown";

import {
  CHAT_ALLOWED_TAGS,
  chatUrlTransform,
  hexToTone,
  mapColorSpansToTone,
} from "../src/features/chat/lib/response-hardening.ts";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.info(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

// Mirrors src/components/ai-elements/response.tsx's wrapping exactly (same
// props, same pre-processing) so this smoke test exercises the real config.
function render(markdown: string): string {
  return renderToStaticMarkup(
    createElement(
      Streamdown,
      { allowedTags: CHAT_ALLOWED_TAGS, urlTransform: chatUrlTransform },
      mapColorSpansToTone(markdown),
    ),
  );
}

function main() {
  console.info("\n[1] hexToTone: closed tone set, never leaks raw hex");
  {
    check("observed green maps to success", hexToTone("#52c41a") === "success");
    check("red-dominant maps to error", hexToTone("#d94032") === "error");
    check("gray/near-gray maps to neutral", hexToTone("#8b929c") === "neutral");
    check("unparsable input falls back to neutral", hexToTone("not-a-color") === "neutral");
  }

  console.info("\n[2] <script> is stripped entirely");
  {
    const html = render("Hello <script>alert(document.cookie)</script> world");
    check("no <script> tag in output", !html.includes("<script"));
    check("no alert( call text survives as executable markup", !/<script[\s\S]*alert/.test(html));
  }

  console.info("\n[3] unsafe link protocols are neutralized");
  {
    const html = render('<a href="javascript:alert(1)">click me</a>');
    check("no javascript: scheme in output", !html.includes("javascript:"));
  }

  console.info("\n[4] http (non-https) links are rejected by our explicit allow-list");
  {
    const html = render('<a href="http://example.com">insecure</a>');
    check("no plain-http href reaches the DOM", !html.includes("http://example.com"));
  }

  console.info("\n[5] https / mailto links are allowed");
  {
    const httpsHtml = render('<a href="https://example.com/docs">docs</a>');
    check(
      "https link content renders (href may be held for confirm-UX, not stripped)",
      httpsHtml.includes("docs"),
    );
    const mailtoHtml = render('<a href="mailto:ops@example.com">email us</a>');
    check("mailto link content renders", mailtoHtml.includes("email us"));
  }

  console.info("\n[6] data: images are blocked");
  {
    const html = render('<img src="data:image/png;base64,AAAAAAAAAAAAAAAA">');
    check("no data: URI reaches the DOM", !html.includes("data:image"));
  }

  console.info("\n[7] https images are allowed");
  {
    const html = render('<img src="https://example.com/chart.png">');
    check("https image src reaches the DOM", html.includes("https://example.com/chart.png"));
  }

  console.info(
    '\n[8] the observed green <span style="color:#52c41a;"> maps to a Ledger tone, never raw style',
  );
  {
    const html = render('Status: <span style="color:#52c41a;">on track</span> today.');
    check("no inline style attribute reaches the DOM", !html.includes("style="));
    check('mapped to data-tone="success"', html.includes('data-tone="success"'));
    check("visible text preserved", html.includes("on track"));
  }

  console.info("\n[9] split-across-deltas: a color span split mid-attribute renders safely");
  {
    // Mirrors the observed contract: one delta ends `...color: #52c41a`, the
    // next begins `;">`. useChat accumulates deltas into the full text on
    // every render, so we simulate the same accumulating sequence here.
    const deltas = ['Result: <span style="color: #52c41a', ';">green text</span> and done.'];
    let accumulated = "";
    const frames: string[] = [];
    for (const delta of deltas) {
      accumulated += delta;
      frames.push(render(accumulated));
    }
    const [midStreamHtml, finalHtml] = frames as [string, string];
    check(
      "mid-stream (incomplete tag) frame contains no dangling raw tag",
      !midStreamHtml.includes("<span style") && !midStreamHtml.includes('color: #52c41a"'),
    );
    check("final frame has no raw style attribute", !finalHtml.includes("style="));
    check('final frame maps to data-tone="success"', finalHtml.includes('data-tone="success"'));
    check(
      "final frame preserves the text",
      finalHtml.includes("green text") && finalHtml.includes("done"),
    );
  }

  console.info("\n[10] mapColorSpansToTone leaves incomplete/unmatched spans untouched");
  {
    check(
      "dangling unterminated span is not rewritten (falls through to Streamdown's own handling)",
      mapColorSpansToTone('before <span style="color: #52c41a') ===
        'before <span style="color: #52c41a',
    );
    check(
      "unrecognized color format (non-hex) is not rewritten",
      mapColorSpansToTone('<span style="color:red">x</span>') ===
        '<span style="color:red">x</span>',
    );
  }

  console.info(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
