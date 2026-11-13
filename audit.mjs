#!/usr/bin/env node
// Usage: node audit.mjs <lockfile> [--out <report.html>]
// Finds installed package versions with known OSV advisories and writes an HTML report with the
// dependency chain that pulls each one in and a fix suggestion. Exit code 1 means findings exist.
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import semver from "semver";
import { parseLockfile } from "./parse.mjs";
import { fetchAdvisory, lowestFixFor, queryVulnIds } from "./osv.mjs";
import { renderReport, severityRank, topSeverity } from "./report.mjs";

const ADVISORY_CONCURRENCY = 6;

/**
 * @param {string} lockPath
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function auditLockfile(lockPath, opts = {}) {
  const graph = await parseLockfile(lockPath);
  const fetchImpl = opts.fetchImpl ?? fetch;

  const packages = [...graph.nodes.values()].map((n) => ({ name: n.name, version: n.version }));
  const vulnIds = await queryVulnIds(packages, fetchImpl);

  const advisoryIds = [...new Set([...vulnIds.values()].flat())];
  const advisories = new Map();
  for (let i = 0; i < advisoryIds.length; i += ADVISORY_CONCURRENCY) {
    const chunk = advisoryIds.slice(i, i + ADVISORY_CONCURRENCY);
    const fetched = await Promise.all(chunk.map((id) => fetchAdvisory(id, fetchImpl)));
    for (const a of fetched) advisories.set(a.id, a);
  }

  const chains = shortestChains(graph);
  const directIds = new Set(graph.roots.map((r) => r.id).filter(Boolean));
  const parents = parentsOf(graph);

  const findings = [];
  for (const [id, ids] of vulnIds) {
    const node = graph.nodes.get(id);
    const fixes = ids.map((aid) => lowestFixFor(advisories.get(aid), node.name, node.version));
    // Upgrading past every advisory means taking the highest of the per-advisory fixes.
    const highest = fixes.every(Boolean) ? fixes.reduce((a, b) => (semver.gt(b, a) ? b : a)) : null;
    // Only a real semver version goes into the suggested commands.
    const fixedVersion = highest && semver.valid(highest) ? highest : null;
    findings.push({
      name: node.name,
      version: node.version,
      advisories: ids.map((aid) => ({
        id: aid,
        severity: advisories.get(aid)?.severity ?? "UNKNOWN",
        summary: advisories.get(aid)?.summary ?? "",
      })),
      fixedVersion,
      direct: directIds.has(id),
      chain: chains.get(id) ?? [id],
      dependents: [...(parents.get(id) ?? [])].sort(),
    });
  }

  findings.sort((a, b) => severityRank(topSeverity(b)) - severityRank(topSeverity(a)) || a.name.localeCompare(b.name));
  return { format: graph.format, packageCount: graph.nodes.size, findings };
}

/**
 * Breadth-first search from the direct dependencies. Returns the shortest chain from a root to
 * each reachable node, as `name@version` ids from the root down.
 */
export function shortestChains(graph) {
  const chains = new Map();
  const queue = [];
  for (const root of graph.roots) {
    if (!root.id || chains.has(root.id)) continue;
    chains.set(root.id, [root.id]);
    queue.push(root.id);
  }
  for (let i = 0; i < queue.length; i++) {
    const last = queue[i];
    for (const child of graph.nodes.get(last)?.children ?? []) {
      if (chains.has(child)) continue;
      chains.set(child, [...chains.get(last), child]);
      queue.push(child);
    }
  }
  return chains;
}

/** Maps each node id to the ids of the packages that depend on it. */
function parentsOf(graph) {
  const parents = new Map();
  for (const [id, node] of graph.nodes) {
    for (const child of node.children) {
      if (!parents.has(child)) parents.set(child, new Set());
      parents.get(child).add(id);
    }
  }
  return parents;
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
