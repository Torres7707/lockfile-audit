import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLockfile } from "./parse.mjs";
import { lockfileNameFromContent, parseLockfileText, requiresPackageJson } from "./parse-core.mjs";

const FIXTURES = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

const CASES = [
  ["npm-v1", "package-lock.json", true],
  ["npm-v3", "package-lock.json", false],
  ["pnpm-v5", "pnpm-lock.yaml", false],
  ["pnpm-v6", "pnpm-lock.yaml", false],
  ["pnpm-v9", "pnpm-lock.yaml", false],
  ["yarn-classic", "yarn.lock", true],
  ["yarn-berry", "yarn.lock", false],
];

for (const [dir, file, needsPkg] of CASES) {
  test(`${dir}: parseLockfileText builds the same graph as parseLockfile`, async () => {
    const text = await readFile(join(FIXTURES, dir, file), "utf8");
    const pkgJson = JSON.parse(await readFile(join(FIXTURES, dir, "package.json"), "utf8"));
    assert.deepEqual(parseLockfileText(file, text, pkgJson), await parseLockfile(join(FIXTURES, dir, file)));
  });

  test(`${dir}: detected as ${file} from its contents`, async () => {
    const text = await readFile(join(FIXTURES, dir, file), "utf8");
    assert.equal(lockfileNameFromContent(text), file);
  });

  test(`${dir}: ${needsPkg ? "needs" : "does not need"} package.json`, async () => {
    const text = await readFile(join(FIXTURES, dir, file), "utf8");
    assert.equal(requiresPackageJson(file, text), needsPkg);
  });
}

test("content detection rejects files that are not lockfiles", () => {
  assert.equal(lockfileNameFromContent('{"name":"x","dependencies":{}}'), null);
  assert.equal(lockfileNameFromContent("{ not json"), null);
  assert.equal(lockfileNameFromContent("hello: world\n"), null);
  assert.equal(lockfileNameFromContent(""), null);
});

test("lockfiles that need package.json fail with a clear message without it", async () => {
  for (const [dir, file] of [["npm-v1", "package-lock.json"], ["yarn-classic", "yarn.lock"]]) {
    const text = await readFile(join(FIXTURES, dir, file), "utf8");
    assert.throws(() => parseLockfileText(file, text, null), /package\.json/);
  }
});
