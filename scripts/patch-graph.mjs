#!/usr/bin/env node
// Patch for @quartz-community/graph.
//
// Problem: the per-page ("local") graph reads the current page slug from the
// browser URL. For non-ASCII page names (e.g. Russian) the browser exposes the
// pathname percent-encoded, while the content index stores decoded slugs. The
// encoded slug matches no links, so the page graph renders no connections and
// the node label falls back to the percent-encoded garbage. The global graph is
// unaffected because it ignores the current slug entirely.
//
// Fix: decode the pathname before it is used. Applied to the compiled dist
// bundle (what Quartz actually ships) and, for completeness, the source file.
//
// Idempotent — safe to run repeatedly. Remove this script once the fix lands
// upstream and the plugin is bumped in quartz.lock.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(repoRoot, ".quartz", "plugins", "graph");

if (!existsSync(pluginDir)) {
  console.log("[patch-graph] graph plugin not installed — nothing to patch");
  process.exit(0);
}

const DIST_MARKER = "decodeURIComponent(window.location.pathname)";
const DIST_RE = /let ([A-Za-z_$][\w$]*)=window\.location\.pathname;/;
const DIST_REPL = "let $1=decodeURIComponent(window.location.pathname);";

let patched = 0;

for (const rel of ["dist/index.js", "dist/components/index.js"]) {
  const file = join(pluginDir, rel);
  if (!existsSync(file)) continue;
  const code = readFileSync(file, "utf8");

  if (code.includes(DIST_MARKER)) {
    console.log(`[patch-graph] already patched: ${rel}`);
    patched++;
    continue;
  }
  const matches = code.match(new RegExp(DIST_RE.source, "g"));
  if (!matches) {
    console.warn(
      `[patch-graph] WARNING: target pattern not found in ${rel} (plugin version changed?) — skipping`,
    );
    continue;
  }
  if (matches.length > 1) {
    console.warn(
      `[patch-graph] WARNING: ${matches.length} matches in ${rel} — skipping to avoid ambiguity`,
    );
    continue;
  }
  writeFileSync(file, code.replace(DIST_RE, DIST_REPL));
  console.log(`[patch-graph] patched: ${rel}`);
  patched++;
}

const srcFile = join(pluginDir, "src", "components", "scripts", "graph.inline.ts");
if (existsSync(srcFile)) {
  const code = readFileSync(srcFile, "utf8");
  const FROM = "var slug = getFullSlugFromUrl();";
  const TO = "var slug = decodeURIComponent(getFullSlugFromUrl());";
  if (code.includes(TO)) {
    console.log("[patch-graph] already patched: src/.../graph.inline.ts");
  } else if (code.includes(FROM)) {
    writeFileSync(srcFile, code.replace(FROM, TO));
    console.log("[patch-graph] patched: src/.../graph.inline.ts");
  } else {
    console.warn("[patch-graph] WARNING: could not find slug line in graph.inline.ts — skipping");
  }
}

if (patched === 0) {
  console.warn("[patch-graph] WARNING: no dist bundles were patched — check plugin install/version");
  process.exit(1);
}
console.log("[patch-graph] done");
