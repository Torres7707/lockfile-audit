// Runs the audit off the main thread, so parsing a large lockfile does not freeze the page.
import { runAudit, type AuditRequest, type AuditResult, type Progress } from "./lib/runAudit.ts";

export type WorkerResponse =
  | { type: "progress"; progress: Progress }
  | { type: "done"; result: AuditResult }
  | { type: "error"; message: string };

const post = (msg: WorkerResponse) => self.postMessage(msg);

self.onmessage = async (event: MessageEvent<AuditRequest>) => {
  try {
    const result = await runAudit(event.data, { onProgress: (progress) => post({ type: "progress", progress }) });
    post({ type: "done", result });
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
