// Client-only helpers: turn the rendered A4 page into a PDF, print it, or share it.
import { PAGE_H, PAGE_W } from "./DocPage";

let fontCss: Promise<string> | null = null;

async function renderCanvas(node: HTMLElement) {
  const { toCanvas, getFontEmbedCSS } = await import("html-to-image");
  await document.fonts?.ready;
  // Embed the site fonts once per session (Arabic shaping is done by the browser itself).
  fontCss ??= getFontEmbedCSS(node).catch(() => "");
  const fontEmbedCSS = await fontCss;
  const opts = { pixelRatio: 2, backgroundColor: "#ffffff", fontEmbedCSS, width: PAGE_W, cacheBust: false };
  // first pass warms image/font caches (Safari sometimes skips images on the very first render)
  await toCanvas(node, opts).catch(() => null);
  return toCanvas(node, opts);
}

export async function makePdf(node: HTMLElement): Promise<Blob> {
  const canvas = await renderCanvas(node);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "px", format: [PAGE_W, PAGE_H], orientation: "portrait", hotfixes: ["px_scaling"], compress: true });
  const scale = canvas.width / PAGE_W; // = pixelRatio
  const pageHpx = Math.round(PAGE_H * scale);
  const pages = Math.max(1, Math.ceil((canvas.height - 4) / pageHpx));
  for (let i = 0; i < pages; i++) {
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(pageHpx, canvas.height - i * pageHpx);
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, i * pageHpx, slice.width, slice.height, 0, 0, slice.width, slice.height);
    if (i > 0) pdf.addPage([PAGE_W, PAGE_H], "portrait");
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PAGE_W, slice.height / scale);
  }
  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Share the PDF through the phone's share sheet (WhatsApp, Mail…). Returns false if not supported. */
export async function sharePdf(blob: Blob, filename: string, title: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try {
    await nav.share({ files: [file], title });
  } catch (e: any) {
    if (e?.name !== "AbortError") throw e;
  }
  return true;
}

/** Print the page exactly as rendered, via a hidden iframe (A4, no margins). */
export async function printNode(node: HTMLElement) {
  const head = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join("\n");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><base href="${location.origin}/">${head}
    <style>@page{size:A4;margin:0}html,body{margin:0;background:#fff!important}body::before,body::after{display:none!important}
    .doc-print{width:${PAGE_W}px;zoom:${(210 / 25.4) * 96 / PAGE_W}}</style></head>
    <body><div class="doc-print">${node.outerHTML}</div></body></html>`;
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => setTimeout(r, 50));
  await Promise.all(Array.from(doc.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  await (iframe.contentWindow as any)?.document?.fonts?.ready;
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => iframe.remove(), 60_000);
}
