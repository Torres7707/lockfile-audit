import { useRef, useState, type DragEvent } from "react";
import { LockIcon } from "./Icons.tsx";

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
}

const FORMATS = [
  { label: "npm", files: "package-lock.json · npm-shrinkwrap.json" },
  { label: "pnpm", files: "pnpm-lock.yaml" },
  { label: "yarn", files: "yarn.lock（classic / berry）" },
];

export function DropZone({ onFiles, busy }: Props) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // dragenter and dragleave also fire for child elements, so count them.
  const depth = useRef(0);

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const files = [...e.dataTransfer.files];
    if (files.length) onFiles(files);
  };

  return (
    <section
      className={`dropzone${over ? " is-over" : ""}${busy ? " is-busy" : ""}`}
      aria-label="选择锁文件"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Decorative: what a lockfile looks like, so the slot reads as "put a lockfile here". */}
      <pre className="dropzone-ghost" aria-hidden="true">
        {`"node_modules/example": {
  "version": "1.2.3",
  "resolved": "https://registry…",
  "integrity": "sha512-9fQ…==",
  "dependencies": {
    "inner": "^2.0.0"
  }
},`}
      </pre>
      <span className="scanline" aria-hidden="true" />
      <span className="corner tl" aria-hidden="true" />
      <span className="corner tr" aria-hidden="true" />
      <span className="corner bl" aria-hidden="true" />
      <span className="corner br" aria-hidden="true" />

      <div className="dropzone-inner">
        <span className="dropzone-icon">
          <LockIcon size={26} />
        </span>
        <p className="dropzone-title">{busy ? "正在读取文件…" : over ? "松开以载入锁文件" : "把锁文件拖到这里"}</p>
        <p className="dropzone-hint">
          npm lockfile v1 和 yarn classic 没有记录直接依赖，还需要同一项目的 <code>package.json</code>，可以一起拖进来。
        </p>
        <button type="button" className="btn btn-primary" onClick={() => input.current?.click()} disabled={busy}>
          选择文件
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) onFiles(files);
          }}
        />
      </div>

      <ul className="formats">
        {FORMATS.map((f) => (
          <li key={f.label}>
            <b>{f.label}</b>
            <span>{f.files}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
