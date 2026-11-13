import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLockfile } from "./parse.mjs";

const FIXTURES = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

const CASES = [
  ["npm-v1", "package-lock.json", "npm"],
  ["npm-v3", "package-lock.json", "npm"],
  ["pnpm-v5", "pnpm-lock.yaml", "pnpm"],
  ["pnpm-v6", "pnpm-lock.yaml", "pnpm"],
  ["pnpm-v9", "pnpm-lock.yaml", "pnpm"],
  ["yarn-classic", "yarn.lock", "yarn-classic"],
  ["yarn-berry", "yarn.lock", "yarn-berry"],
];

for (const [dir, file, format] of CASES) {
  test(`${dir}: parses ${format} with the nested minimist kept separate from the root one`, async () => {
    const graph = await parseLockfile(join(FIXTURES, dir, file));

    assert.equal(graph.format, format);
    assert.deepEqual(
      [...graph.nodes.keys()].sort(),
      ["lodash@4.17.15", "minimist@0.0.8", "minimist@1.2.8", "mkdirp@0.5.1", "ms@2.0.0"],
    );

    const mkdirp = graph.nodes.get("mkdirp@0.5.1");
    assert.deepEqual([...mkdirp.children], ["minimist@0.0.8"], "mkdirp must reach the old minimist, not 1.2.8");

    const roots = Object.fromEntries(graph.roots.map((r) => [r.name, { kind: r.kind, id: r.id }]));
    assert.deepEqual(roots.minimist, { kind: "prod", id: "minimist@1.2.8" });
    assert.deepEqual(roots.mkdirp, { kind: "prod", id: "mkdirp@0.5.1" });
    assert.deepEqual(roots.ms, { kind: "dev", id: "ms@2.0.0" });
  });
}

test("rejects an unknown lockfile name", async () => {
  await assert.rejects(parseLockfile(join(FIXTURES, "npm-v3", "package.json")), /Unsupported lockfile/);
});
