// Builds the HTML report and the fix suggestions. Pure functions: no network, no file access.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

const OSV_ID = /^[A-Za-z0-9._-]+$/;

/** Links only to OSV IDs that look like plain identifiers. The IDs come from an external API. */
function advisoryLink(id) {
  const safe = OSV_ID.test(id);
  const label = escapeHtml(id);
  return safe ? `<a href="https://osv.dev/vulnerability/${label}">${label}</a>` : label;
}

const SEVERITY_RANK = { CRITICAL: 4, HIGH: 3, MODERATE: 2, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };

export function severityRank(severity) {
  return SEVERITY_RANK[String(severity).toUpperCase()] ?? 0;
}

/** Highest severity across a finding's advisories, as a display label. */
export function topSeverity(finding) {
  const best = [...finding.advisories].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  return best ? String(best.severity).toUpperCase() : "UNKNOWN";
}

const INSTALL_CMD = { npm: "npm install", pnpm: "pnpm install", "yarn-classic": "yarn install", "yarn-berry": "yarn install" };

const ADD_CMD = {
  npm: (pkg, ver) => `npm install ${pkg}@${ver}`,
  pnpm: (pkg, ver) => `pnpm add ${pkg}@${ver}`,
  "yarn-classic": (pkg, ver) => `yarn add ${pkg}@${ver}`,
  "yarn-berry": (pkg, ver) => `yarn add ${pkg}@${ver}`,
};

/** The package.json block that forces one package to a version. Each package manager reads its own key. */
export function overrideBlock(format, pkg, spec) {
  const map = { [pkg]: spec };
  if (format === "npm") return { overrides: map };
  if (format === "pnpm") return { pnpm: { overrides: map } };
  return { resolutions: map };
}

/**
 * @param {{ name: string, fixedVersion: string | null, direct: boolean, chain: string[] }} finding
 * @param {string} format parse.mjs format name
 * @returns {{ summary: string, steps: string[], snippet: string | null }}
 */
export function suggestFix(finding, format) {
  const { name, fixedVersion, direct, chain } = finding;

  if (!fixedVersion) {
    return {
      summary: "OSV 没有给出修复版本。需要确认是否有官方修复、换一个替代包，或者移除这个依赖。",
      steps: [],
      snippet: null,
    };
  }

  if (direct) {
    // npm rejects an override that conflicts with a direct dependency's own spec, so the direct
    // dependency itself is upgraded instead.
    return {
      summary: `直接依赖 ${name} 需要升级到 ${fixedVersion} 或以上。`,
      steps: [ADD_CMD[format](name, fixedVersion), INSTALL_CMD[format]],
      snippet: null,
    };
  }

  const spec = `>=${fixedVersion}`;
  const via = chain.slice(0, -1).join(" -> ");
  return {
    summary: `${name} 是间接依赖（经由 ${via}）。用覆盖配置把它强制升到 ${fixedVersion} 或以上。`,
    steps: [`在项目的 package.json 中加入下面的配置`, INSTALL_CMD[format]],
    snippet: JSON.stringify(overrideBlock(format, name, spec), null, 2),
  };
}

const CSS = `
:root { color-scheme: light dark; --bg: #f6f5f2; --fg: #1d1d1b; --muted: #6b6a66; --card: #ffffff;
  --line: #deddd8; --code: #efeee9; --crit: #a4161a; --high: #c4520f; --mod: #8a6d00; --low: #3d6b3d; --unk: #6b6a66; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #161615; --fg: #ecebe6; --muted: #a09e97; --card: #1f1f1d;
    --line: #34332f; --code: #2a2a27; --crit: #ff8a8c; --high: #ffb27a; --mod: #e6cc62; --low: #9ad19a; --unk: #a09e97; }
}
:root[data-theme="dark"] { --bg: #161615; --fg: #ecebe6; --muted: #a09e97; --card: #1f1f1d;
  --line: #34332f; --code: #2a2a27; --crit: #ff8a8c; --high: #ffb27a; --mod: #e6cc62; --low: #9ad19a; --unk: #a09e97; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 960px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 24px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 0; }
.meta { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
.meta code { word-break: break-all; }
.summary { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
.stat { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px 16px; min-width: 150px; }
.stat b { display: block; font-size: 22px; }
.stat span { color: var(--muted); font-size: 13px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.badge { font-size: 12px; font-weight: 600; border-radius: 4px; padding: 2px 8px; border: 1px solid currentColor; }
.sev-CRITICAL { color: var(--crit); } .sev-HIGH { color: var(--high); } .sev-MODERATE, .sev-MEDIUM { color: var(--mod); }
.sev-LOW { color: var(--low); } .sev-UNKNOWN { color: var(--unk); }
.where { color: var(--muted); font-size: 13px; margin: 8px 0; }
code, pre { font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
code { background: var(--code); padding: 1px 5px; border-radius: 4px; }
pre { background: var(--code); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0 0; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
th, td { text-align: left; padding: 6px 8px; border-top: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 500; font-size: 12px; }
td.id { white-space: nowrap; }
a { color: inherit; }
.fix { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 12px; }
.fix ol { margin: 8px 0 0; padding-left: 20px; }
.empty { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 24px; }
.caveat { color: var(--muted); font-size: 13px; margin-top: 32px; }
@media (max-width: 600px) { main { padding: 24px 16px 48px; } th:nth-child(1), td:nth-child(1) { display: none; } }
`;

/**
 * @param {{ format: string, packageCount: number, findings: object[], lockfile: string, project: string | null, generatedAt: string }} report
 * @returns {string} a complete HTML document
 */
export function renderReport(report) {
  const { findings } = report;
  const advisoryCount = new Set(findings.flatMap((f) => f.advisories.map((a) => a.id))).size;
  const top = findings.length ? findings.map(topSeverity).sort((a, b) => severityRank(b) - severityRank(a))[0] : null;
  const title = report.project ? `${report.project}: 依赖漏洞报告` : "依赖漏洞报告";

  const body = findings.length
    ? findings.map((f) => renderFinding(f, report.format)).join("\n")
    : `<div class="empty"><h2>没有发现已知漏洞</h2><p class="where">这次检查的 ${report.packageCount} 个包版本都没有命中 OSV 的记录。</p></div>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<div class="meta">
  生成于 ${escapeHtml(report.generatedAt)}<br>
  锁文件 <code>${escapeHtml(report.lockfile)}</code>（${escapeHtml(report.format)}）
</div>
<section class="summary">
  <div class="stat"><b>${findings.length}</b><span>有漏洞的包版本</span></div>
  <div class="stat"><b>${advisoryCount}</b><span>不重复的漏洞编号</span></div>
  <div class="stat"><b>${report.packageCount}</b><span>检查的包版本</span></div>
  <div class="stat"><b>${top ? escapeHtml(top) : "无"}</b><span>最高严重等级</span></div>
</section>
${body}
<p class="caveat">数据来自 OSV（osv.dev）。它只收录已公开的漏洞。没有命中不代表没有风险。修复建议基于 OSV 给出的修复版本，修改后请重新运行检查确认。</p>
</main>
</body>
</html>
`;
}

function renderFinding(f, format) {
  const sev = topSeverity(f);
  const fix = suggestFix(f, format);
  const where = f.direct
    ? "直接依赖"
    : `间接依赖，引入路径：<code>${escapeHtml(f.chain.join(" -> "))}</code>`;
  const dependents = f.dependents.length
    ? `<div class="where">被这些包依赖：${f.dependents.map((d) => `<code>${escapeHtml(d)}</code>`).join("、")}</div>`
    : "";

  const rows = f.advisories
    .map(
      (a) => `<tr>
        <td class="sev-${escapeHtml(String(a.severity).toUpperCase())}">${escapeHtml(String(a.severity).toUpperCase())}</td>
        <td class="id">${advisoryLink(a.id)}</td>
        <td>${escapeHtml(a.summary)}</td>
      </tr>`,
    )
    .join("\n");

  const steps = fix.steps.length
    ? `<ol>${fix.steps.map((s) => `<li><code>${escapeHtml(s)}</code></li>`).join("")}</ol>`
    : "";
  const snippet = fix.snippet ? `<pre><code>${escapeHtml(fix.snippet)}</code></pre>` : "";

  return `<section class="card">
  <div class="card-head">
    <h2><code>${escapeHtml(f.name)}@${escapeHtml(f.version)}</code></h2>
    <span class="badge sev-${escapeHtml(sev)}">${escapeHtml(sev)}</span>
  </div>
  <div class="where">${where}</div>
  ${dependents}
  <table>
    <thead><tr><th>严重程度</th><th>编号</th><th>说明</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <div class="fix">
    <div><b>修复建议</b></div>
    <div>${escapeHtml(fix.summary)}</div>
    ${steps}
    ${snippet}
  </div>
</section>`;
}
