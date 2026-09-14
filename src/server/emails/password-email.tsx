import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render, toPlainText } from "@react-email/render";

import { PASSWORD_RESET_TOKEN_TTL_LABEL } from "@/server/features/password";

/**
 * Invite + reset email. One shell, two copy sets.
 *
 * NOT imported at module scope by `@/server/mailer` — see the comment on the
 * dynamic import there. `@react-email/render` pulls in `react-dom/server`,
 * which throws under the `react-server` condition the entrypoint and
 * reset-admin esbuild bundles run with.
 *
 * Colors mirror the Ledger tokens in `src/app/globals.css` (--brand, --ink,
 * --ink2, --ink3, --line, --radius: 0). They are literals because email clients
 * cannot read CSS custom properties. Light mode only: client support for
 * prefers-color-scheme is inconsistent and the dark token set is unreachable
 * from an email.
 */

export type PasswordEmailVariant = "invite" | "reset";

const PRODUCT = "Genie Ops Center";

const COLOR = {
  brand: "#2360c4",
  onBrand: "#ffffff",
  ink: "#14161b",
  ink2: "#4a515c",
  ink3: "#8b929c",
  line: "#c8cdd5",
  card: "#ffffff",
  ground: "#dfe3e9",
} as const;

// Archivo / Hanken Grotesk are loaded by next/font in the app. Email clients
// cannot load them, so they lead the stack and fall back to system faces.
const FONT = 'Archivo, "Hanken Grotesk", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';

const COPY: Record<
  PasswordEmailVariant,
  { subject: string; preview: string; heading: string; body: string; cta: string; footer: string }
> = {
  invite: {
    subject: `Set your ${PRODUCT} password`,
    preview: "Choose a password to finish setting up your account.",
    heading: "Set your password",
    body: `An administrator added you to ${PRODUCT}. Choose a password to finish setting up your account.`,
    cta: "Set password",
    footer: "If you did not expect this invitation, you can ignore this email.",
  },
  reset: {
    subject: `Reset your ${PRODUCT} password`,
    preview: "Choose a new password for your account.",
    heading: "Reset your password",
    body: `You asked to reset your ${PRODUCT} password. Choose a new one below.`,
    cta: "Reset password",
    footer: "If you did not ask for this, you can ignore this email. Your password stays the same.",
  },
};

const wordmark = {
  fontFamily: FONT,
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: COLOR.onBrand,
  margin: "0",
} as const;

export function PasswordEmail({ url, variant }: { url: string; variant: PasswordEmailVariant }) {
  const copy = COPY[variant];
  return (
    <Html lang="en">
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: COLOR.ground }}>
        <Container
          style={{ width: "100%", maxWidth: "600px", margin: "0 auto", padding: "32px 12px" }}
        >
          <Section style={{ backgroundColor: COLOR.brand, padding: "22px 32px" }}>
            <Text style={wordmark}>{PRODUCT}</Text>
          </Section>

          <Section style={{ backgroundColor: COLOR.card, padding: "40px 32px 0" }}>
            <Heading
              as="h1"
              style={{
                margin: 0,
                fontFamily: FONT,
                fontSize: "30px",
                lineHeight: 1.15,
                fontWeight: 700,
                color: COLOR.ink,
              }}
            >
              {copy.heading}
            </Heading>
            <Text
              style={{
                margin: "16px 0 0",
                fontFamily: FONT,
                fontSize: "16px",
                lineHeight: 1.65,
                color: COLOR.ink2,
              }}
            >
              {copy.body}
            </Text>
          </Section>

          <Section style={{ backgroundColor: COLOR.card, padding: "28px 32px 0" }}>
            <Button
              href={url}
              style={{
                backgroundColor: COLOR.brand,
                borderRadius: "0",
                color: COLOR.onBrand,
                fontFamily: FONT,
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: 1,
                padding: "13px 26px",
                textDecoration: "none",
              }}
            >
              {copy.cta}
            </Button>
          </Section>

          <Section style={{ backgroundColor: COLOR.card, padding: "20px 32px 0" }}>
            <Text
              style={{
                margin: 0,
                fontFamily: FONT,
                fontSize: "14px",
                lineHeight: 1.6,
                color: COLOR.ink2,
              }}
            >
              The link expires in {PASSWORD_RESET_TOKEN_TTL_LABEL}. If the button does not work,
              paste this into your browser:
            </Text>
            <Text style={{ margin: "8px 0 0" }}>
              <Link
                href={url}
                style={{
                  fontFamily: FONT,
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: COLOR.brand,
                  wordBreak: "break-all",
                }}
              >
                {url}
              </Link>
            </Text>
          </Section>

          <Section style={{ backgroundColor: COLOR.card, padding: "32px 32px 34px" }}>
            <Hr
              style={{ margin: "0 0 16px", border: "none", borderTop: `1px solid ${COLOR.line}` }}
            />
            <Text
              style={{
                margin: 0,
                fontFamily: FONT,
                fontSize: "12px",
                lineHeight: 1.6,
                color: COLOR.ink3,
              }}
            >
              {copy.footer}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderPasswordEmail({
  url,
  variant,
}: {
  url: string;
  variant: PasswordEmailVariant;
}): Promise<{ subject: string; html: string; text: string }> {
  const html = await render(<PasswordEmail url={url} variant={variant} />);
  return { subject: COPY[variant].subject, html, text: toPlainText(html) };
}
