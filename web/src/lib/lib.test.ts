import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CASES, FIXED_META, FIXTURES, fakeOsvFetch, goldenPath } from "../../../fixtures/fake-osv.mjs";
import { EMPTY_SELECTION, MAX_FILE_BYTES, addToSelection, classifyFile, readiness } from "./classifyFiles.ts";
import { friendlyError, runAudit } from "./runAudit.ts";
import { previewDocument, reportFileName } from "./download.ts";

const fixture = (dir: string, file: string) => readFile(join(FIXTURES, dir, file), "utf8");
const fakeFile = (name: string, text: string, size = text.length) => ({ name, size, text: async () => text });

for (const [dir, file] of CASES) {
  test(`${dir}: web report is identical to the CLI golden report`, async () => {
    const pkgJson = JSON.parse(await fixture(dir, "package.json"));
    const result = await runAudit(
      { lockfileName: file, lockfileText: await fixture(dir, file), displayName: file, pkgJson, generatedAt: FIXED_META.generatedAt },
      { fetchImpl: fakeOsvFetch },
    );
    assert.equal(result.html, await readFile(goldenPath(dir), "utf8"));
    assert.equal(result.project, "fixture-app");
    assert.equal(result.findingCount, 3);
    assert.equal(result.topSeverity, "CRITICAL");
  });
}

test("runAudit reports progress through every stage in order", async () => {
  const stages: string[] = [];
  await runAudit(
    { lockfileName: "pnpm-lock.yaml", lockfileText: await fixture("pnpm-v9", "pnpm-lock.yaml"), displayName: "x", pkgJson: null, generatedAt: FIXED_META.generatedAt },
    { fetchImpl: fakeOsvFetch, onProgress: (p) => stages.push(p.stage) },
  );
  assert.deepEqual([...new Set(stages)], ["parse", "query", "advisories", "render"]);
});

test("a renamed lockfile is recognised from its contents", async () => {
  const entry = await classifyFile(fakeFile("package-lock (1).json", await fixture("npm-v3", "package-lock.json")));
  assert.equal(entry.kind, "lockfile");
  assert.ok(entry.kind === "lockfile" && entry.detectedByContent && entry.parseAs === "package-lock.json");
});

test("package.json is recognised by name and when renamed", async () => {
  const text = await fixture("npm-v1", "package.json");
  for (const name of ["package.json", "package (2).json"]) {
    const entry = await classifyFile(fakeFile(name, text));
    assert.ok(entry.kind === "package-json" && entry.project === "fixture-app", name);
  }
});

test("unsupported, invalid and oversized files are rejected with a reason", async () => {
  const cases = [
    fakeFile("notes.txt", "hello"),
    fakeFile("package.json", "{ broken"),
    fakeFile("big.lock", "", MAX_FILE_BYTES + 1),
  ];
  for (const f of cases) {
    const entry = await classifyFile(f);
    assert.ok(entry.kind === "rejected" && entry.reason.length > 0, f.name);
  }
});

test("a drop with two lockfiles uses the first and lists the second as unused", async () => {
  const a = await classifyFile(fakeFile("pnpm-lock.yaml", await fixture("pnpm-v9", "pnpm-lock.yaml")));
  const b = await classifyFile(fakeFile("yarn.lock", await fixture("yarn-berry", "yarn.lock")));
  const sel = addToSelection(EMPTY_SELECTION, [a, b]);
  assert.equal(sel.lockfile?.name, "pnpm-lock.yaml");
  assert.deepEqual(sel.rejected.map((r) => r.name), ["yarn.lock"]);
});

test("a later drop replaces the lockfile and keeps the package.json", async () => {
  const pkg = await classifyFile(fakeFile("package.json", await fixture("yarn-classic", "package.json")));
  const first = await classifyFile(fakeFile("pnpm-lock.yaml", await fixture("pnpm-v9", "pnpm-lock.yaml")));
  const second = await classifyFile(fakeFile("yarn.lock", await fixture("yarn-classic", "yarn.lock")));
  const sel = addToSelection(addToSelection(EMPTY_SELECTION, [pkg, first]), [second]);
  assert.equal(sel.lockfile?.name, "yarn.lock");
  assert.equal(sel.packageJson?.name, "package.json");
});

test("npm v1 and yarn classic are not ready without package.json", async () => {
  for (const [dir, file] of [["npm-v1", "package-lock.json"], ["yarn-classic", "yarn.lock"]]) {
    const lock = await classifyFile(fakeFile(file, await fixture(dir, file)));
    const pkg = await classifyFile(fakeFile("package.json", await fixture(dir, "package.json")));
    assert.equal(readiness(addToSelection(EMPTY_SELECTION, [lock])).ok, false, dir);
    assert.equal(readiness(addToSelection(EMPTY_SELECTION, [lock, pkg])).ok, true, dir);
  }
  const berry = await classifyFile(fakeFile("yarn.lock", await fixture("yarn-berry", "yarn.lock")));
  assert.equal(readiness(addToSelection(EMPTY_SELECTION, [berry])).ok, true);
  assert.equal(readiness(EMPTY_SELECTION).ok, false);
});

test("report file names are safe and dated", () => {
  assert.equal(reportFileName("@scope/my app", "2026-03-04T05:06:07.000Z"), "dependency-audit-scope-my-app-2026-03-04.html");
  assert.equal(reportFileName(null, "2026-03-04T05:06:07.000Z"), "dependency-audit-2026-03-04.html");
  assert.equal(reportFileName("../..", "2026-03-04T05:06:07.000Z"), "dependency-audit-2026-03-04.html");
});

test("the preview opens links in a new tab and leaves the rest unchanged", () => {
  const html = "<!doctype html>\n<html>\n<head>\n<title>x</title></head><body><head></body></html>";
  const out = previewDocument(html);
  assert.equal(out, html.replace("<head>", '<head>\n<base target="_blank">'));
  assert.equal(out.split("<base").length, 2);
});

test("errors are turned into actionable messages", () => {
  assert.match(friendlyError("Failed to fetch"), /无法连接 osv\.dev/);
  assert.match(friendlyError("OSV 429 for https://api.osv.dev/v1/querybatch"), /429/);
  assert.match(friendlyError("npm lockfile v1 has no direct-dependency list."), /^分析失败/);
});
