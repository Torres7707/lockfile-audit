import { useEffect, useRef, useState } from "react";
import { DropZone } from "./components/DropZone.tsx";
import { Hero } from "./components/Hero.tsx";
import { FileList } from "./components/FileList.tsx";
import { Progress } from "./components/Progress.tsx";
import { ReportView } from "./components/ReportView.tsx";
import { EMPTY_SELECTION, addToSelection, classifyFile, readiness, type Selection } from "./lib/classifyFiles.ts";
import { downloadHtml, reportFileName } from "./lib/download.ts";
import { friendlyError, type AuditRequest, type AuditResult, type Progress as ProgressState } from "./lib/runAudit.ts";
import type { WorkerResponse } from "./audit.worker.ts";

type Phase =
  | { name: "select" }
  | { name: "running"; progress: ProgressState; seen: Partial<Record<string, ProgressState>> }
  | { name: "done"; result: AuditResult; fileName: string }
  | { name: "error"; message: string };

export function App() {
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [phase, setPhase] = useState<Phase>({ name: "select" });
  const [reading, setReading] = useState(false);
  const worker = useRef<Worker | null>(null);

  // A file dropped outside the drop zone would otherwise replace the page with the file.
  useEffect(() => {
    const block = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
      worker.current?.terminate();
    };
  }, []);

  async function handleFiles(files: File[]) {
    setReading(true);
    try {
      const classified = await Promise.all(files.map(classifyFile));
      setSelection((s) => addToSelection(s, classified));
      setPhase((p) => (p.name === "error" ? { name: "select" } : p));
    } finally {
      setReading(false);
    }
  }

  function start() {
    const { lockfile, packageJson } = selection;
    if (!lockfile) return;
    worker.current?.terminate();
    const w = new Worker(new URL("./audit.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    setPhase({ name: "running", progress: { stage: "parse" }, seen: {} });

    const finish = (next: Phase) => {
      w.terminate();
      if (worker.current === w) worker.current = null;
      setPhase(next);
    };
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setPhase((p) =>
          p.name === "running"
            ? { name: "running", progress: msg.progress, seen: { ...p.seen, [msg.progress.stage]: msg.progress } }
            : p,
        );
      } else if (msg.type === "done") {
        finish({ name: "done", result: msg.result, fileName: reportFileName(msg.result.project, request.generatedAt) });
      } else {
        finish({ name: "error", message: friendlyError(msg.message) });
      }
    };
    w.onerror = (e) => finish({ name: "error", message: friendlyError(e.message || "后台分析进程没有启动或意外退出，请检查网络连接后重试") });

    const request: AuditRequest = {
      lockfileName: lockfile.parseAs,
      lockfileText: lockfile.text,
      displayName: lockfile.name,
      pkgJson: packageJson?.manifest ?? null,
      generatedAt: new Date().toISOString(),
    };
    w.postMessage(request);
  }

  function reset() {
    worker.current?.terminate();
    worker.current = null;
    setSelection(EMPTY_SELECTION);
    setPhase({ name: "select" });
  }

  const ready = readiness(selection);
  const running = phase.name === "running";

  return (
    <main>
      <Hero compact={phase.name === "done" || running} />

      {phase.name === "done" ? (
        <ReportView
          result={phase.result}
          fileName={phase.fileName}
          onDownload={() => downloadHtml(phase.result.html, phase.fileName)}
          onReset={reset}
        />
      ) : (
        <>
          {!running && <DropZone onFiles={handleFiles} busy={reading} />}
          <FileList
            selection={selection}
            disabled={running}
            onRemoveLockfile={() => setSelection((s) => ({ ...s, lockfile: null, rejected: [] }))}
            onRemovePackageJson={() => setSelection((s) => ({ ...s, packageJson: null, rejected: [] }))}
          />

          {phase.name === "running" ? (
            <Progress progress={phase.progress} seen={phase.seen} />
          ) : (
            <div className="start">
              {phase.name === "error" && (
                <p className="error" role="alert">
                  {phase.message}
                </p>
              )}
              {!ready.ok && selection.lockfile && <p className="hint">{ready.reason}</p>}
              <button type="button" className="btn btn-primary" onClick={start} disabled={!ready.ok || reading}>
                {phase.name === "error" ? "重试" : "开始分析"}
              </button>
            </div>
          )}
        </>
      )}

      <footer className="caveat">
        <span>数据来自 OSV（osv.dev），只收录已公开的漏洞。没有命中不代表没有风险。</span>
        <span>
          命令行版本：<code>node audit.mjs &lt;lockfile&gt;</code>
        </span>
      </footer>
    </main>
  );
}
