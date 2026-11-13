#!/usr/bin/env node
// Usage: node audit.mjs <lockfile> [--out <report.html>]
// Finds installed package versions with known OSV advisories and writes an HTML report with the
// dependency chain that pulls each one in and a fix suggestion. Exit code 1 means findings exist.
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseLockfile } from "./parse.mjs";
import { auditGraph } from "./audit-core.mjs";
import { renderReport } from "./report.mjs";

export { auditGraph, shortestChains } from "./audit-core.mjs";

/**
 * @param {string} lockPath
 * @param {{ fetchImpl?: typeof fetch, onProgress?: (p: import("./audit-core.mjs").AuditProgress) => void }} [opts]
 */
export async function auditLockfile(lockPath, opts = {}) {
  return auditGraph(await parseLockfile(lockPath), opts);
}

async function projectName(lockPath) {
  try {
    const pkg = JSON.parse(await readFile(join(dirname(lockPath), "package.json"), "utf8"));
    return typeof pkg.name === "string" ? pkg.name : null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let out = "dependency-audit.html";
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") out = args[++i];
    else positional.push(args[i]);
  }
  return { lockPath: positional[0], out };
}

async function main(argv) {
  const args = parseArgs(argv);
  if (!args.lockPath) {
    console.error("Usage: node audit.mjs <lockfile> [--out <report.html>]");
    return 2;
  }
  // `npm run` changes into this package's folder, so relative paths resolve from where npm was started.
  const base = process.env.INIT_CWD ?? process.cwd();
  const lockPath = resolve(base, args.lockPath);
  const outPath = resolve(base, args.out);

  const result = await auditLockfile(lockPath);
  const html = renderReport({
    format: result.format,
    packageCount: result.packageCount,
    findings: result.findings,
    lockfile: relative(base, lockPath) || basename(lockPath),
    project: await projectName(lockPath),
    generatedAt: new Date().toISOString(),
  });
  await writeFile(outPath, html, "utf8");

  console.log(`${result.findings.length} vulnerable package versions in ${result.packageCount} checked.`);
  console.log(`Report: ${outPath}`);
  return result.findings.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err.message);
      process.exitCode = 2;
    },
  );
}
