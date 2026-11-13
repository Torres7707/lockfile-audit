import { useMemo } from "react";
import type { AuditResult } from "../lib/runAudit.ts";
import { previewDocument } from "../lib/download.ts";

interface Props {
  result: AuditResult;
  fileName: string;
  onDownload: () => void;
  onReset: () => void;
}

export function ReportView({ result, fileName, onDownload, onReset }: Props) {
  const srcDoc = useMemo(() => previewDocument(result.html), [result.html]);
  const sev = result.topSeverity ?? "无";

  return (
    <section className="result">
      <div className="result-head">
        <h2>{result.findingCount ? `发现 ${result.findingCount} 个有漏洞的包版本` : "没有发现已知漏洞"}</h2>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onDownload}>
            下载 HTML 报告
          </button>
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            分析其他文件
          </button>
        </div>
      </div>
      <p className="muted">
        将保存为 <code>{fileName}</code>
      </p>

      <div className="stats">
        <div className="stat">
          <b>{result.findingCount}</b>
          <span>有漏洞的包版本</span>
        </div>
        <div className="stat">
          <b>{result.advisoryCount}</b>
          <span>不重复的漏洞编号</span>
        </div>
        <div className="stat">
          <b>{result.packageCount}</b>
          <span>检查的包版本</span>
        </div>
        <div className="stat">
          <b className={result.topSeverity ? `sev-${result.topSeverity}` : undefined}>{sev}</b>
          <span>最高严重等级</span>
        </div>
      </div>

      <iframe
        className="preview"
        title="报告预览"
        srcDoc={srcDoc}
        // No allow-scripts: the report needs none. Popups let its osv.dev links open in a new tab.
        sandbox="allow-popups allow-popups-to-escape-sandbox"
      />
    </section>
  );
}
