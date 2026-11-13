// Sorts dropped files into "the lockfile", "the package.json" and "not used", and decides whether
// the selection is ready to analyze. Pure apart from reading each file's text.
import { LOCKFILE_NAMES, lockfileFormat, lockfileNameFromContent, requiresPackageJson } from "../../../parse-core.mjs";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/** The parts of a browser File this module uses. */
export interface InputFile {
  name: string;
  size: number;
  text(): Promise<string>;
}

export type LockfileFormat = "npm" | "pnpm" | "yarn-classic" | "yarn-berry";

export interface LockfileEntry {
  kind: "lockfile";
  /** The name the user's file has. */
  name: string;
  /** The canonical lockfile name that picks the parser. */
  parseAs: string;
  format: LockfileFormat;
  /** True when the file name was not a lockfile name and the type came from the contents. */
  detectedByContent: boolean;
  text: string;
}

export interface PackageJsonEntry {
  kind: "package-json";
  name: string;
  manifest: Record<string, unknown>;
  project: string | null;
}

export interface RejectedEntry {
  kind: "rejected";
  name: string;
  reason: string;
}

export type Classified = LockfileEntry | PackageJsonEntry | RejectedEntry;

export interface Selection {
  lockfile: LockfileEntry | null;
  packageJson: PackageJsonEntry | null;
  /** Files from the most recent drop that were not used, with the reason. */
  rejected: RejectedEntry[];
}

export const EMPTY_SELECTION: Selection = { lockfile: null, packageJson: null, rejected: [] };

export async function classifyFile(file: InputFile): Promise<Classified> {
  const reject = (reason: string): RejectedEntry => ({ kind: "rejected", name: file.name, reason });
  if (file.size > MAX_FILE_BYTES) return reject(`文件超过 ${MAX_FILE_BYTES / 1024 / 1024} MB`);

  let text: string;
  try {
    text = await file.text();
  } catch {
    return reject("无法读取这个文件（文件夹不能直接拖入）");
  }

  const lockfile = (parseAs: string, detectedByContent: boolean): LockfileEntry => ({
    kind: "lockfile",
    name: file.name,
    parseAs,
    format: lockfileFormat(parseAs, text) as LockfileFormat,
    detectedByContent,
    text,
  });

  if (LOCKFILE_NAMES.includes(file.name)) return lockfile(file.name, false);

  if (file.name === "package.json") {
    const manifest = parseObject(text);
    return manifest ? packageJson(file.name, manifest) : reject("package.json 不是有效的 JSON 对象");
  }

  const detected = lockfileNameFromContent(text);
  if (detected) return lockfile(detected, true);

  // A renamed package.json, for example `package (1).json` from a browser download.
  const manifest = file.name.endsWith(".json") ? parseObject(text) : null;
  if (manifest && !("lockfileVersion" in manifest) && looksLikeManifest(manifest)) {
    return packageJson(file.name, manifest);
  }

  return reject("不是支持的锁文件，也不是 package.json");
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function looksLikeManifest(m: Record<string, unknown>): boolean {
  return ["name", "dependencies", "devDependencies", "optionalDependencies"].some((k) => k in m);
}

function packageJson(name: string, manifest: Record<string, unknown>): PackageJsonEntry {
  return { kind: "package-json", name, manifest, project: typeof manifest.name === "string" ? manifest.name : null };
}

/**
 * Adds one drop's files to the selection. A new lockfile or package.json replaces the previous
 * one. When a drop holds several lockfiles, the first is used and the rest are listed as unused.
 */
export function addToSelection(selection: Selection, files: Classified[]): Selection {
  const rejected: RejectedEntry[] = [];
  let { lockfile, packageJson } = selection;
  let lockfileInDrop: LockfileEntry | null = null;
  let packageJsonInDrop: PackageJsonEntry | null = null;

  for (const f of files) {
    if (f.kind === "rejected") {
      rejected.push(f);
    } else if (f.kind === "lockfile") {
      if (lockfileInDrop) rejected.push({ kind: "rejected", name: f.name, reason: `一次只分析一个锁文件，已使用 ${lockfileInDrop.name}` });
      else lockfile = lockfileInDrop = f;
    } else if (packageJsonInDrop) {
      rejected.push({ kind: "rejected", name: f.name, reason: `只需要一个 package.json，已使用 ${packageJsonInDrop.name}` });
    } else {
      packageJson = packageJsonInDrop = f;
    }
  }
  return { lockfile, packageJson, rejected };
}

export type Readiness = { ok: true } | { ok: false; reason: string };

export function readiness(selection: Selection): Readiness {
  const { lockfile, packageJson } = selection;
  if (!lockfile) return { ok: false, reason: "请先放入一个锁文件。" };
  if (!packageJson && requiresPackageJson(lockfile.parseAs, lockfile.text)) {
    const kind = lockfile.format === "npm" ? "npm lockfile v1" : "yarn classic 锁文件";
    return { ok: false, reason: `${kind} 没有记录哪些是直接依赖。请把同一项目的 package.json 一起拖进来。` };
  }
  return { ok: true };
}
