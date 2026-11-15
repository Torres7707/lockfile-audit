// Inline SVG icons. They use currentColor so they follow the theme tokens.
interface IconProps {
  size?: number;
  className?: string;
}

function svg(size: number, className: string | undefined, children: React.ReactNode, viewBox = "0 0 24 24") {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Padlock whose body holds a small dependency tree: the lockfile-audit mark. */
export function LogoMark({ size = 28, className }: IconProps) {
  return svg(
    size,
    className,
    <>
      <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" />
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
      <circle cx="12" cy="14.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
      <path d="M12 15.2v.8M12 16H9v1M12 16h3v1" strokeWidth="1.2" />
    </>,
  );
}

export function LockIcon({ size = 20, className }: IconProps) {
  return svg(
    size,
    className,
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2.5" />
    </>,
  );
}

export function ShieldCheckIcon({ size = 20, className }: IconProps) {
  return svg(
    size,
    className,
    <>
      <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.1 7.5 9.5 4.4-1.4 7.5-5.1 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12.2 2.3 2.3 4.2-4.6" />
    </>,
  );
}

export function ShieldAlertIcon({ size = 20, className }: IconProps) {
  return svg(
    size,
    className,
    <>
      <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.1 7.5 9.5 4.4-1.4 7.5-5.1 7.5-9.5V6L12 3Z" />
      <path d="M12 8.5v4.2" />
      <circle cx="12" cy="15.7" r=".6" fill="currentColor" />
    </>,
  );
}

export function FileIcon({ size = 18, className }: IconProps) {
  return svg(
    size,
    className,
    <>
      <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </>,
  );
}

export function DownloadIcon({ size = 16, className }: IconProps) {
  return svg(
    size,
    className,
    <>
      <path d="M12 4v11" />
      <path d="m7.5 11 4.5 4.5 4.5-4.5" />
      <path d="M5 20h14" />
    </>,
  );
}

export function CheckIcon({ size = 12, className }: IconProps) {
  return svg(size, className, <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth="2.4" />);
}
