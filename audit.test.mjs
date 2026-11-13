// Golden tests: the full pipeline (parse -> OSV lookup -> report) against every fixture, with OSV
// replaced by a fixed fake. Run `UPDATE_GOLDEN=1 npm test` to rewrite the expected reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { auditLockfile } from "./audit.mjs";
import { renderReport } from "./report.mjs";
import { CASES, FIXED_META, FIXTURES, fakeOsvFetch, goldenPath } from "./fixtures/fake-osv.mjs";

const UPDATE = process.env.UPDATE_GOLDEN === "1";

for (const [dir, file] of CASES) {
  test(`${dir}: CLI pipeline report matches the golden file`, async () => {
    const result = await auditLockfile(join(FIXTURES, dir, file), { fetchImpl: fakeOsvFetch });
    const html = renderReport({ ...result, lockfile: file, ...FIXED_META });
    if (UPDATE) await writeFile(goldenPath(dir), html, "utf8");
    assert.equal(html, await readFile(goldenPath(dir), "utf8"));
  });
}
