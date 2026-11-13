/** `dependency-audit-<project>-<YYYY-MM-DD>.html`, with the project name made safe for file names. */
export function reportFileName(project: string | null, generatedAt: string): string {
  const slug = (project ?? "")
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|-+$/g, "");
  const date = generatedAt.slice(0, 10);
  return slug ? `dependency-audit-${slug}-${date}.html` : `dependency-audit-${date}.html`;
}

export function downloadHtml(html: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  // Some browsers start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * The report as shown in the preview iframe. Links open in a new tab, because the sandboxed frame
 * cannot navigate itself to osv.dev. The downloaded file is left unchanged.
 */
export function previewDocument(html: string): string {
  return html.replace("<head>", '<head>\n<base target="_blank">');
}
