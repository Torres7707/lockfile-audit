import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The page talks only to OSV. The report preview is a srcdoc iframe and inherits this policy;
// its inline <style> needs 'unsafe-inline' for styles. Applied to builds only, because the dev
// server injects inline scripts and a websocket for hot reload.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src https://api.osv.dev",
  "img-src 'self' data:",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
    ],
  };
}

export default defineConfig({
  // Relative asset paths, so the build works from any subpath (for example GitHub Pages).
  base: "./",
  plugins: [react(), contentSecurityPolicy()],
  worker: { format: "es" },
});
