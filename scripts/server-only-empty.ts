// Empty shim aliased in for `server-only` when esbuild bundles the container
// entrypoint (src/server/entrypoint.ts). The `server-only` marker package only
// resolves to its no-op `empty.js` under the `react-server` condition, which a
// plain Node bundle won't have — so the build:entrypoint script aliases it here
// to keep the bundle importable at container boot. App server code still gets
// the real marker via Next.
export {};
