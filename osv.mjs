// Looks up known vulnerabilities for npm packages in OSV (https://osv.dev) and works out the
// lowest version that fixes each one.
import semver from "semver";

const OSV = "https://api.osv.dev/v1";
const BATCH_SIZE = 500;

/**
 * @param {Array<{ name: string, version: string }>} packages
 * @returns {Promise<Map<string, string[]>>} "name@version" -> advisory IDs
 */
export async function queryVulnIds(packages, fetchImpl = fetch) {
  const found = new Map();
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const chunk = packages.slice(i, i + BATCH_SIZE);
    const res = await postJson(fetchImpl, `${OSV}/querybatch`, {
      queries: chunk.map((p) => ({ package: { name: p.name, ecosystem: "npm" }, version: p.version })),
    });
    res.results.forEach((result, idx) => {
      const p = chunk[idx];
      const ids = (result.vulns ?? []).map((v) => v.id);
      if (ids.length) found.set(`${p.name}@${p.version}`, ids);
    });
  }
  return found;
}

/**
 * @param {string} id OSV advisory ID, e.g. GHSA-...
 * @returns {Promise<{ id: string, summary: string, severity: string, aliases: string[], fixedIn: (pkg: string, version: string) => string | null }>}
 */
export async function fetchAdvisory(id, fetchImpl = fetch) {
  const v = await getJson(fetchImpl, `${OSV}/vulns/${encodeURIComponent(id)}`);
  return {
    id,
    summary: v.summary ?? v.details?.split("\n")[0] ?? "",
    severity: v.database_specific?.severity ?? "UNKNOWN",
    aliases: v.aliases ?? [],
    affected: (v.affected ?? []).filter((a) => a.package?.ecosystem === "npm"),
  };
}

/**
 * Returns the lowest fixed version that is above `version`, or null when OSV gives no fix.
 * Uses the SEMVER ranges (introduced/fixed events), walking each range from its start.
 */
export function lowestFixFor(advisory, pkgName, version) {
  let best = null;
  for (const aff of advisory.affected) {
    if (aff.package?.name !== pkgName) continue;
    for (const range of aff.ranges ?? []) {
      if (range.type !== "SEMVER") continue;
      let introduced = "0.0.0";
      for (const ev of range.events ?? []) {
        if (ev.introduced !== undefined) {
          introduced = ev.introduced === "0" ? "0.0.0" : ev.introduced;
        } else if (ev.fixed !== undefined) {
          if (isInRange(version, introduced, ev.fixed) && (!best || semver.lt(ev.fixed, best))) best = ev.fixed;
        }
      }
    }
  }
  return best;
}

function isInRange(version, introduced, fixed) {
  try {
    return semver.gte(version, introduced) && semver.lt(version, fixed);
  } catch {
    return false;
  }
}

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`OSV ${res.status} for ${url}`);
  return res.json();
}

async function postJson(fetchImpl, url, body) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OSV ${res.status} for ${url}`);
  return res.json();
}
