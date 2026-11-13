// Turns a dependency graph into audit findings using OSV. No file or Node.js access here, so the
// browser app can use it too. audit.mjs is the CLI on top of it.
import semver from "semver";
import { fetchAdvisory, lowestFixFor, queryVulnIds } from "./osv.mjs";
import { severityRank, topSeverity } from "./report.mjs";

const ADVISORY_CONCURRENCY = 6;

/**
 * @typedef {{ stage: "query" } | { stage: "advisories", done: number, total: number }} AuditProgress
 */

/**
 * @param {import("./parse-core.mjs").Graph} graph
 * @param {{ fetchImpl?: typeof fetch, onProgress?: (p: AuditProgress) => void }} [opts]
 */
export async function auditGraph(graph, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const onProgress = opts.onProgress ?? (() => {});

  const packages = [...graph.nodes.values()].map((n) => ({ name: n.name, version: n.version }));
  onProgress({ stage: "query" });
  const vulnIds = await queryVulnIds(packages, fetchImpl);

  const advisoryIds = [...new Set([...vulnIds.values()].flat())];
  const advisories = new Map();
  onProgress({ stage: "advisories", done: 0, total: advisoryIds.length });
  for (let i = 0; i < advisoryIds.length; i += ADVISORY_CONCURRENCY) {
    const chunk = advisoryIds.slice(i, i + ADVISORY_CONCURRENCY);
    const fetched = await Promise.all(chunk.map((id) => fetchAdvisory(id, fetchImpl)));
    for (const a of fetched) advisories.set(a.id, a);
    onProgress({ stage: "advisories", done: advisories.size, total: advisoryIds.length });
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
