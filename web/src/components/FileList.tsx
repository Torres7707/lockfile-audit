import type { LockfileFormat, Selection } from "../lib/classifyFiles.ts";
import { FileIcon, LockIcon } from "./Icons.tsx";

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
          <span className="file-icon is-lock">
            <LockIcon size={18} />
          </span>
          <div className="file-main">
            <div className="file-line">
              <span className="file-role">锁文件</span>
              <code className="file-name">{lockfile.name}</code>
              <span className="badge">{FORMAT_LABEL[lockfile.format]}</span>
            </div>
            {lockfile.detectedByContent && <span className="file-meta">文件名不是标准锁文件名，按内容识别为 {lockfile.parseAs}</span>}
          </div>
          <button type="button" className="btn-link" onClick={onRemoveLockfile} disabled={disabled}>
            移除
          </button>
        </li>
      )}
      {packageJson && (
        <li className="file">
          <span className="file-icon">
            <FileIcon size={18} />
          </span>
          <div className="file-main">
            <div className="file-line">
              <span className="file-role">清单</span>
              <code className="file-name">{packageJson.name}</code>
              <span className="badge">{packageJson.project ? packageJson.project : "没有 name 字段"}</span>
            </div>
          </div>
          <button type="button" className="btn-link" onClick={onRemovePackageJson} disabled={disabled}>
            移除
          </button>
        </li>
      )}
      {rejected.map((r, i) => (
        <li className="file is-rejected" key={`${r.name}-${i}`}>
          <span className="file-icon">
            <FileIcon size={18} />
          </span>
          <div className="file-main">
            <div className="file-line">
              <span className="file-role">未使用</span>
              <code className="file-name">{r.name}</code>
            </div>
            <span className="file-meta">{r.reason}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
