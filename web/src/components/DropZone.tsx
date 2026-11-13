import { useRef, useState, type DragEvent } from "react";

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
}

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
    <div
      className={`dropzone${over ? " is-over" : ""}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <p className="dropzone-title">{busy ? "正在读取文件…" : "把锁文件拖到这里"}</p>
      <p className="dropzone-hint">
        支持 <code>package-lock.json</code>、<code>npm-shrinkwrap.json</code>、<code>pnpm-lock.yaml</code>、
        <code>yarn.lock</code>。npm lockfile v1 和 yarn classic 还需要同一项目的 <code>package.json</code>，可以一起拖进来。
      </p>
      <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()} disabled={busy}>
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
  );
}
