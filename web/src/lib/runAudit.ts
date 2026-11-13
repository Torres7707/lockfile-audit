// The browser version of the CLI pipeline: parse -> OSV lookup -> report. Uses the same core
// modules as audit.mjs, so the HTML is identical to what the CLI writes for the same input.
import { parseLockfileText } from "../../../parse-core.mjs";
import { auditGraph } from "../../../audit-core.mjs";
import { renderReport, severityRank, topSeverity } from "../../../report.mjs";

export type Progress =
  | { stage: "parse" }
  | { stage: "query"; total: number }
  | { stage: "advisories"; done: number; total: number }
  | { stage: "render" };

export interface AuditRequest {
  /** Canonical lockfile name that picks the parser. */
  lockfileName: string;
  lockfileText: string;
  /** The user's file name, shown in the report. */
  displayName: string;
  pkgJson: Record<string, unknown> | null;
  generatedAt: string;
}

export interface AuditResult {
  html: string;
  format: string;
  project: string | null;
  packageCount: number;
  findingCount: number;
  advisoryCount: number;
  topSeverity: string | null;
}

export async function runAudit(
  req: AuditRequest,
  opts: { fetchImpl?: typeof fetch; onProgress?: (p: Progress) => void } = {},
): Promise<AuditResult> {
  const onProgress = opts.onProgress ?? (() => {});

  onProgress({ stage: "parse" });
  const graph = parseLockfileText(req.lockfileName, req.lockfileText, req.pkgJson);
  const result = await auditGraph(graph, { fetchImpl: opts.fetchImpl, onProgress });

  onProgress({ stage: "render" });
  const project = typeof req.pkgJson?.name === "string" ? req.pkgJson.name : null;
  const html = renderReport({
    format: result.format,
    packageCount: result.packageCount,
    findings: result.findings,
    lockfile: req.displayName,
    project,
    generatedAt: req.generatedAt,
  });

  const { findings } = result;
  const severities: string[] = findings.map((f) => topSeverity(f));
  return {
    html,
    format: result.format,
    project,
    packageCount: result.packageCount,
    findingCount: findings.length,
    advisoryCount: new Set(findings.flatMap((f) => f.advisories.map((a) => a.id))).size,
    topSeverity: severities.sort((a, b) => severityRank(b) - severityRank(a))[0] ?? null,
  };
}

/** Turns error messages from parsing and from OSV into something a user can act on. */
export function friendlyError(message: string): string {
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message)) {
    return "无法连接 osv.dev。请检查网络连接后重试。";
  }
  if (/^OSV 429\b/.test(message)) return "osv.dev 限制了请求频率（429）。请稍等片刻后重试。";
  if (/^OSV \d+/.test(message)) return `osv.dev 返回错误：${message}`;
  return `分析失败：${message}`;
}
