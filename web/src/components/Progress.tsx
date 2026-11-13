import type { Progress as ProgressState } from "../lib/runAudit.ts";

const ORDER: ProgressState["stage"][] = ["parse", "query", "advisories", "render"];

function label(stage: ProgressState["stage"], progress: ProgressState, seen: Partial<Record<string, ProgressState>>) {
  const p = progress.stage === stage ? progress : seen[stage];
  switch (stage) {
    case "parse":
      return "解析锁文件";
    case "query":
      return p?.stage === "query" ? `在 OSV 中查询 ${p.total} 个包版本` : "在 OSV 中查询包版本";
    case "advisories":
      return p?.stage === "advisories" ? `拉取漏洞详情（${p.done}/${p.total}）` : "拉取漏洞详情";
    case "render":
      return "生成报告";
  }
}

interface Props {
  progress: ProgressState;
  /** The last event seen for each stage, so finished steps keep their numbers. */
  seen: Partial<Record<string, ProgressState>>;
}

export function Progress({ progress, seen }: Props) {
  const current = ORDER.indexOf(progress.stage);
  return (
    <ol className="steps" aria-live="polite">
      {ORDER.map((stage, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={stage} className={`step is-${state}`}>
            <span className="step-mark" aria-hidden="true" />
            <span>{label(stage, progress, seen)}</span>
            {state === "done" && <span className="visually-hidden">（已完成）</span>}
          </li>
        );
      })}
    </ol>
  );
}
