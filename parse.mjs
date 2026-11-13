// File-reading wrapper around parse-core.mjs for the CLI.
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { parseLockfileText } from "./parse-core.mjs";

export { LOCKFILE_NAMES, parseLockfileText } from "./parse-core.mjs";

/**
 * @typedef {import("./parse-core.mjs").Graph} Graph
 */

/**
 * @param {string} lockPath Path to a lockfile. A package.json in the same folder is used when the
 *   lockfile does not record which packages are direct dependencies.
 * @returns {Promise<Graph>}
 */
export async function parseLockfile(lockPath) {
  const text = await readFile(lockPath, "utf8");
  const pkgJson = await readPackageJson(join(dirname(lockPath), "package.json"));
  return parseLockfileText(basename(lockPath), text, pkgJson);
}

async function readPackageJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}
