// Shared by the CLI and web golden tests: the fixture list and a fake OSV API that answers the
// two endpoints osv.mjs calls, so reports are stable without network access.
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES = fileURLToPath(new URL(".", import.meta.url));

export function goldenPath(dir) {
  return join(FIXTURES, dir, "report.golden.html");
}

export const CASES = [
  ["npm-v1", "package-lock.json"],
  ["npm-v3", "package-lock.json"],
  ["pnpm-v5", "pnpm-lock.yaml"],
  ["pnpm-v6", "pnpm-lock.yaml"],
  ["pnpm-v9", "pnpm-lock.yaml"],
  ["yarn-classic", "yarn.lock"],
  ["yarn-berry", "yarn.lock"],
];

// Covers a transitive fix (minimist@0.0.8 via mkdirp), a direct fix (lodash, two advisories whose
// fixes differ), and an advisory with no fix (ms).
const FAKE_ADVISORIES = {
  "GHSA-fake-mini": {
    summary: "Prototype pollution in minimist",
    database_specific: { severity: "CRITICAL" },
    affected: [
      {
        package: { ecosystem: "npm", name: "minimist" },
        ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "0.2.4" }, { introduced: "1.0.0" }, { fixed: "1.2.6" }] }],
      },
    ],
  },
  "GHSA-fake-lod1": {
    summary: "Command injection in lodash <script>",
    database_specific: { severity: "HIGH" },
    affected: [{ package: { ecosystem: "npm", name: "lodash" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] }],
  },
  "GHSA-fake-lod2": {
    details: "Prototype pollution in lodash\nMore text",
    database_specific: { severity: "MODERATE" },
    affected: [{ package: { ecosystem: "npm", name: "lodash" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.16" }] }] }],
  },
  "GHSA-fake-ms": {
    summary: "Regular expression denial of service in ms",
    affected: [{ package: { ecosystem: "npm", name: "ms" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }] }] }],
  },
};

const VULNS_BY_PACKAGE = {
  "minimist@0.0.8": ["GHSA-fake-mini"],
  "lodash@4.17.15": ["GHSA-fake-lod1", "GHSA-fake-lod2"],
  "ms@2.0.0": ["GHSA-fake-ms"],
};

/** A `fetch` that answers the two OSV endpoints osv.mjs uses from the tables above. */
export async function fakeOsvFetch(url, init = {}) {
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (url.endsWith("/querybatch")) {
    const { queries } = JSON.parse(init.body);
    return json({
      results: queries.map((q) => {
        const ids = VULNS_BY_PACKAGE[`${q.package.name}@${q.version}`] ?? [];
        return ids.length ? { vulns: ids.map((id) => ({ id })) } : {};
      }),
    });
  }
  const id = decodeURIComponent(url.split("/vulns/")[1] ?? "");
  if (FAKE_ADVISORIES[id]) return json({ id, ...FAKE_ADVISORIES[id] });
  return new Response("not found", { status: 404 });
}

export const FIXED_META = { project: "fixture-app", generatedAt: "2026-01-01T00:00:00.000Z" };
