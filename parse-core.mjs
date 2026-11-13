// Reads npm, pnpm and yarn lockfiles into one dependency graph.
// Each node is one installed `name@version`. Edges point from a package to the packages it
// depends on, after the lockfile's own resolution (nested node_modules, peer suffixes, aliases).
// No file or Node.js access here, so the browser app can use it too. parse.mjs adds file reading.
import YAML from "yaml";
import yarnParsers from "@yarnpkg/parsers";

/**
 * @typedef {{ name: string, version: string, children: Set<string> }} GraphNode
 * @typedef {{ name: string, kind: string, id: string | null }} Root
 * @typedef {{ format: string, roots: Root[], nodes: Map<string, GraphNode> }} Graph
 */

export const LOCKFILE_NAMES = ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock"];

/**
 * @param {string} fileName Lockfile name, one of LOCKFILE_NAMES. Picks the parser.
 * @param {string} text Lockfile contents.
 * @param {object | null} pkgJson The project's parsed package.json, used when the lockfile does not
 *   record which packages are direct dependencies. Pass null when there is none.
 * @returns {Graph}
 */
export function parseLockfileText(fileName, text, pkgJson) {
  if (fileName === "yarn.lock") {
    return isYarnBerry(text) ? parseYarnBerry(text, pkgJson) : parseYarnClassic(text, pkgJson);
  }
  if (fileName === "pnpm-lock.yaml") return parsePnpm(text);
  if (fileName === "package-lock.json" || fileName === "npm-shrinkwrap.json") return parseNpm(text, pkgJson);
  throw new Error(`Unsupported lockfile: ${fileName}. Expected one of ${LOCKFILE_NAMES.join(", ")}.`);
}

const isYarnBerry = (text) => text.includes("__metadata:");

/**
 * Guesses the lockfile type from its contents, for files that were renamed (for example a
 * downloaded `package-lock (1).json`). Returns the canonical file name to pass to
 * parseLockfileText, or null when the text does not look like a supported lockfile.
 * @param {string} text
 * @returns {string | null}
 */
export function lockfileNameFromContent(text) {
  const head = text.trimStart();
  if (head.startsWith("{")) {
    try {
      const json = JSON.parse(text);
      return json && typeof json === "object" && "lockfileVersion" in json ? "package-lock.json" : null;
    } catch {
      return null;
    }
  }
  if (/^# yarn lockfile v1\b/m.test(text) || /^__metadata:\s*$/m.test(text)) return "yarn.lock";
  if (/^lockfileVersion:/m.test(text)) return "pnpm-lock.yaml";
  return null;
}

/**
 * True when this lockfile cannot be parsed without the project's package.json: npm lockfile v1
 * and yarn classic do not record the direct dependencies.
 * @param {string} fileName one of LOCKFILE_NAMES
 * @param {string} text
 */
export function requiresPackageJson(fileName, text) {
  if (fileName === "yarn.lock") return !isYarnBerry(text);
  if (fileName === "package-lock.json" || fileName === "npm-shrinkwrap.json") {
    try {
      return !JSON.parse(text).packages;
    } catch {
      return false;
    }
  }
  return false;
}

function newGraph(format) {
  return { format, roots: [], nodes: new Map() };
}

function addNode(graph, name, version) {
  const id = `${name}@${version}`;
  if (!graph.nodes.has(id)) graph.nodes.set(id, { name, version, children: new Set() });
  return id;
}

function addEdge(graph, from, to) {
  graph.nodes.get(from).children.add(to);
}

/** Maps each dependency name to its kind. The first section that lists a name wins. */
function kindMap(sections) {
  const kinds = new Map();
  for (const [kind, deps] of sections) {
    for (const name of Object.keys(deps ?? {})) if (!kinds.has(name)) kinds.set(name, kind);
  }
  return kinds;
}

const manifestSections = (manifest) => [
  ["prod", manifest?.dependencies],
  ["dev", manifest?.devDependencies],
  ["optional", manifest?.optionalDependencies],
];

function rootsFor(kinds) {
  return [...kinds].map(([name, kind]) => ({ name, kind, id: null }));
}

// ---------- npm ----------

function parseNpm(text, pkgJson) {
  const lock = JSON.parse(text);
  return lock.packages ? parseNpmPackages(lock) : parseNpmV1(lock, pkgJson);
}

/** npm lockfile v2 and v3: a flat `packages` map keyed by install path. */
function parseNpmPackages(lock) {
  const graph = newGraph("npm");
  const pk = lock.packages;
  const ids = new Map();

  const nameFromPath = (key) => {
    const i = key.lastIndexOf("node_modules/");
    return i === -1 ? undefined : key.slice(i + "node_modules/".length);
  };

  for (const [key, entry] of Object.entries(pk)) {
    if (key === "" || entry.link || !entry.version) continue;
    ids.set(key, addNode(graph, entry.name ?? nameFromPath(key) ?? key, entry.version));
  }
  // Symlinked workspace entries point at the real package entry.
  for (const [key, entry] of Object.entries(pk)) {
    if (entry.link && ids.has(entry.resolved)) ids.set(key, ids.get(entry.resolved));
  }

  for (const [key, entry] of Object.entries(pk)) {
    const from = ids.get(key);
    if (key === "" || entry.link || !from) continue;
    for (const dep of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies })) {
      const to = ids.get(resolveNpmPath(pk, key, dep));
      if (to) addEdge(graph, from, to);
    }
  }

  const rootEntry = pk[""] ?? {};
  const kinds = kindMap(manifestSections(rootEntry));
  graph.roots = rootsFor(kinds).map((root) => ({ ...root, id: ids.get(resolveNpmPath(pk, "", root.name)) ?? null }));
  return graph;
}

/** Finds the path of `dep` as seen from `from`, walking up the node_modules tree like Node does. */
function resolveNpmPath(pk, from, dep) {
  let base = from;
  for (;;) {
    const candidate = base ? `${base}/node_modules/${dep}` : `node_modules/${dep}`;
    if (pk[candidate]) return candidate;
    if (!base) return null;
    const i = base.lastIndexOf("/node_modules/");
    base = i === -1 ? "" : base.slice(0, i);
  }
}

/** npm lockfile v1: nested `dependencies` objects, with `requires` naming the ranges. */
function parseNpmV1(lock, pkgJson) {
  if (!pkgJson) {
    throw new Error("npm lockfile v1 has no direct-dependency list. Put package.json next to it.");
  }
  const graph = newGraph("npm");
  const visit = (level, ancestors) => {
    for (const [name, entry] of Object.entries(level ?? {})) {
      if (!entry.version) continue;
      const from = addNode(graph, name, entry.version);
      // A package resolves its requires from its own nested folder first, then outward.
      const scopes = [entry.dependencies, level, ...ancestors].filter(Boolean);
      const requires = entry.requires && typeof entry.requires === "object" ? entry.requires : {};
      for (const dep of Object.keys(requires)) {
        const target = scopes.map((s) => (Object.hasOwn(s, dep) ? s[dep] : undefined)).find((e) => e?.version);
        if (target) addEdge(graph, from, addNode(graph, dep, target.version));
      }
      visit(entry.dependencies, [level, ...ancestors]);
    }
  };
  visit(lock.dependencies, []);

  const kinds = kindMap(manifestSections(pkgJson));
  graph.roots = rootsFor(kinds).map((root) => {
    const entry = lock.dependencies?.[root.name];
    return { ...root, id: entry?.version ? addNode(graph, root.name, entry.version) : null };
  });
  return graph;
}

// ---------- pnpm ----------

/**
 * pnpm lockfile v5, v6 and v9. Package keys are `/name/version` (v5), `/name@version` (v6) or
 * `name@version` (v9). Dependency values can carry peer suffixes, and aliases use `name@version`.
 */
function parsePnpm(text) {
  const lock = selectPnpmProjectDocument(text);
  const flavor = String(lock.lockfileVersion).split(".")[0] === "5" ? "v5" : "v6+";
  const graph = newGraph("pnpm");
  // pnpm v9 keeps the dependency edges under `snapshots`; v5 and v6 keep them on `packages`.
  const entries = lock.snapshots ?? lock.packages ?? {};

  for (const [key, entry] of Object.entries(entries)) {
    const self = parsePnpmKey(key, flavor);
    if (!self || !entry) continue;
    const from = addNode(graph, self.name, self.version);
    for (const [dep, value] of Object.entries({ ...entry.dependencies, ...entry.optionalDependencies })) {
      const ref = parsePnpmRef(dep, value, flavor);
      if (ref) addEdge(graph, from, addNode(graph, ref.name, ref.version));
    }
  }

  // v9 nests the root manifest under `importers`; v5 and v6 keep it at the top level.
  const importer = lock.importers?.["."] ?? lock;
  const kinds = kindMap(manifestSections(importer));
  graph.roots = rootsFor(kinds).map((root) => {
    const ref = parsePnpmRef(root.name, importer.dependencies?.[root.name] ?? importer.devDependencies?.[root.name] ?? importer.optionalDependencies?.[root.name], flavor);
    return { ...root, id: ref ? addNode(graph, ref.name, ref.version) : null };
  });
  return graph;
}

/**
 * pnpm 12 can write a second document before the project lockfile. That first document holds
 * `packageManagerDependencies` (pnpm itself) and no project dependencies. Use the document that
 * has `packages`, preferring one with `importers['.']`. v5 and v6 have one document with the
 * root manifest at the top level.
 */
function selectPnpmProjectDocument(text) {
  const docs = YAML.parseAllDocuments(text).map((d) => d.toJS()).filter((d) => d && typeof d === "object");
  const withPackages = docs.filter((d) => d.packages);
  const project = [...withPackages].reverse().find((d) => d.importers?.["."]) ?? withPackages.at(-1);
  if (!project) throw new Error("pnpm lockfile has no document with a packages section.");
  return project;
}

function parsePnpmKey(key, flavor) {
  const k = key.replace(/^\//, "");
  if (flavor === "v5") {
    // `name/version` with the scope in front: `@scope/name/1.2.3_peer@1.0.0`.
    const nameEnd = k.startsWith("@") ? k.indexOf("/", k.indexOf("/") + 1) : k.indexOf("/");
    if (nameEnd <= 0) return null;
    return { name: k.slice(0, nameEnd), version: k.slice(nameEnd + 1).split("_")[0] };
  }
  const base = k.split("(")[0];
  const at = base.lastIndexOf("@");
  if (at <= 0) return null;
  return { name: base.slice(0, at), version: base.slice(at + 1) };
}

function parsePnpmRef(depName, value, flavor) {
  if (value && typeof value === "object") value = value.version;
  if (typeof value !== "string" || /^(link|file):/.test(value)) return null;
  if (value.startsWith("/")) return parsePnpmKey(value, flavor);
  const base = value.split("(")[0].split("_")[0];
  const at = base.lastIndexOf("@");
  if (at > 0) return { name: base.slice(0, at), version: base.slice(at + 1) };
  return { name: depName, version: base };
}

// ---------- yarn ----------

function parseYarnClassic(text, pkgJson) {
  if (!pkgJson) {
    throw new Error("yarn classic lockfiles do not record direct dependencies. Put package.json next to yarn.lock.");
  }
  const { graph, resolve } = buildYarnGraph("yarn-classic", yarnParsers.parseSyml(text));
  const kinds = kindMap(manifestSections(pkgJson));
  graph.roots = rootsFor(kinds).map((root) => {
    const range = pkgJson.dependencies?.[root.name] ?? pkgJson.devDependencies?.[root.name] ?? pkgJson.optionalDependencies?.[root.name];
    return { ...root, id: resolve(root.name, range) };
  });
  return graph;
}

function parseYarnBerry(text, pkgJson) {
  const lock = yarnParsers.parseSyml(text);
  const { graph, resolve, rootEntry } = buildYarnGraph("yarn-berry", lock);
  const kinds = kindMap(manifestSections(pkgJson));
  const names = Object.keys(rootEntry?.dependencies ?? {});
  graph.roots = names.map((name) => ({
    name,
    kind: kinds.get(name) ?? "unknown",
    id: resolve(name, rootEntry.dependencies[name]),
  }));
  return graph;
}

/**
 * Yarn classic and Berry share one structure: a key holds one or more `name@range` specifiers
 * and an entry holds the resolved version and its dependency ranges.
 */
function buildYarnGraph(format, lock) {
  const graph = newGraph(format);
  const bySpec = new Map();
  const records = [];
  let rootEntry = null;

  for (const [keys, entry] of Object.entries(lock)) {
    if (keys === "__metadata" || !entry || typeof entry !== "object") continue;
    const specs = keys.split(", ");
    if (specs.some((spec) => spec.endsWith("@workspace:."))) {
      rootEntry = entry;
      continue;
    }
    for (const spec of specs) bySpec.set(spec, entry);
    if (!entry.version) continue;
    const first = specs[0];
    const name = first.slice(0, first.indexOf("@", 1));
    records.push({ entry, id: addNode(graph, name, entry.version) });
  }

  const idOf = new Map(records.map((r) => [r.entry, r.id]));
  const resolve = (name, range) => {
    if (typeof range !== "string") return null;
    const target = bySpec.get(`${name}@${range}`);
    return target ? (idOf.get(target) ?? null) : null;
  };

  for (const { entry, id } of records) {
    for (const [dep, range] of Object.entries({ ...entry.dependencies, ...entry.optionalDependencies })) {
      const to = resolve(dep, range);
      if (to) addEdge(graph, id, to);
    }
  }
  return { graph, resolve, rootEntry };
}
