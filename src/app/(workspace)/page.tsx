/**
 * Solutions hub. The catalogue (granted solutions, filters, open) is ticket 11;
 * this is a clean placeholder that inherits the workspace chrome.
 */
export default function HubPage() {
  return (
    <section className="cs-hubpad" style={{ padding: 24, maxWidth: "var(--content-wide)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--t-h2)",
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "var(--ink)",
        }}
      >
        Solutions
      </h1>
      <p style={{ marginTop: 8, maxWidth: "60ch", color: "var(--ink2)" }}>
        Open any solution you&rsquo;ve been granted to use it live. Your solutions will appear here.
      </p>
    </section>
  );
}
