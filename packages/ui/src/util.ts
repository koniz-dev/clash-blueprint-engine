import type { ExportResult } from "@clash/plugins";

function clickDownload(href: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Trigger a browser download for a text exporter result. */
export function downloadExport(result: ExportResult): void {
  const blob = new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  clickDownload(url, result.filename);
  URL.revokeObjectURL(url);
}

/** Trigger a browser download for a data-URL exporter result (e.g. PNG). */
export function downloadDataUrl(result: ExportResult): void {
  clickDownload(result.content, result.filename);
}
