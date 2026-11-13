import type { LockfileFormat, Selection } from "../lib/classifyFiles.ts";

const FORMAT_LABEL: Record<LockfileFormat, string> = {
  npm: "npm",
  pnpm: "pnpm",
  "yarn-classic": "yarn classic",
  "yarn-berry": "yarn berry",
};

interface Props {
  selection: Selection;
  onRemoveLockfile: () => void;
  onRemovePackageJson: () => void;
  disabled: boolean;
}

export function FileList({ selection, onRemoveLockfile, onRemovePackageJson, disabled }: Props) {
  const { lockfile, packageJson, rejected } = selection;
  if (!lockfile && !packageJson && !rejected.length) return null;

  return (
    <ul className="files">
      {lockfile && (
        <li className="file">
          <span className="file-role">锁文件</span>
          <code className="file-name">{lockfile.name}</code>
          <span className="file-meta">
            {FORMAT_LABEL[lockfile.format]}
            {lockfile.detectedByContent && `，按内容识别为 ${lockfile.parseAs}`}
          </span>
          <button type="button" className="btn-link" onClick={onRemoveLockfile} disabled={disabled}>
            移除
          </button>
        </li>
      )}
      {packageJson && (
        <li className="file">
          <span className="file-role">package.json</span>
          <code className="file-name">{packageJson.name}</code>
          <span className="file-meta">{packageJson.project ? `项目 ${packageJson.project}` : "没有 name 字段"}</span>
          <button type="button" className="btn-link" onClick={onRemovePackageJson} disabled={disabled}>
            移除
          </button>
        </li>
      )}
      {rejected.map((r, i) => (
        <li className="file is-rejected" key={`${r.name}-${i}`}>
          <span className="file-role">未使用</span>
          <code className="file-name">{r.name}</code>
          <span className="file-meta">{r.reason}</span>
        </li>
      ))}
    </ul>
  );
}
