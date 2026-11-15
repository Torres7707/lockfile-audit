import { useMemo } from "react";
import type { AuditResult } from "../lib/runAudit.ts";
import { previewDocument } from "../lib/download.ts";
import { DownloadIcon, ShieldAlertIcon, ShieldCheckIcon } from "./Icons.tsx";

interface Props {
  result: AuditResult;
  fileName: string;
  onDownload: () => void;
  onReset: () => void;
}

export function ReportView({ result, fileName, onDownload, onReset }: Props) {
  const srcDoc = useMemo(() => previewDocument(result.html), [result.html]);
  const sev = result.topSeverity ?? "无";
  const clean = result.findingCount === 0;

  return (
    <section className="result">
      <div className={`verdict ${clean ? "is-clean" : `is-vuln sev-${result.topSeverity ?? "UNKNOWN"}`}`}>
        <span className="verdict-icon">{clean ? <ShieldCheckIcon size={30} /> : <ShieldAlertIcon size={30} />}</span>
        <div className="verdict-text">
          <p className="verdict-kicker">{clean ? "审计通过" : "发现已知漏洞"}</p>
          <h2>{clean ? "没有发现已知漏洞" : `${result.findingCount} 个包版本存在已知漏洞`}</h2>
          <p className="muted">
            {clean
              ? "OSV 中没有这份锁文件里任何包版本的记录。没有命中不代表没有风险。"
              : "展开下方报告，查看每个漏洞的引入路径和修复建议。"}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={onDownload}>
            <DownloadIcon /> 下载 HTML 报告
          </button>
          <button type="button" className="btn btn-secondary" onClick={onReset}>
            分析其他文件
          </button>
        </div>
      </div>

      <dl className="stats">
        <div className="stat">
          <dt>有漏洞的包版本</dt>
          <dd className={result.findingCount ? "is-alert" : undefined}>{result.findingCount}</dd>
        </div>
        <div className="stat">
          <dt>不重复的漏洞编号</dt>
          <dd>{result.advisoryCount}</dd>
        </div>
        <div className="stat">
          <dt>检查的包版本</dt>
          <dd>{result.packageCount}</dd>
        </div>
        <div className="stat">
          <dt>最高严重等级</dt>
          <dd className={result.topSeverity ? `sev-${result.topSeverity}` : undefined}>{sev}</dd>
        </div>
      </dl>

      <div className="window">
        <div className="window-bar">
          <span className="window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="window-title">报告预览</span>
          <span className="window-file">
            保存为 <code>{fileName}</code>
          </span>
        </div>
        <iframe
          className="preview"
          title="报告预览"
          srcDoc={srcDoc}
          // No allow-scripts: the report needs none. Popups let its osv.dev links open in a new tab.
          sandbox="allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </section>
  );
}
