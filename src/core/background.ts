import type { Background } from "../domain/types";

const MAX_PX = 2400;
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69";

/** Turn a JPG/PNG/PDF file into a downscaled JPEG data URL. PDF uses page 1. */
export async function importBackground(file: File): Promise<Background> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return fromPdf(file);
  return fromImage(file);
}

async function fromImage(file: File): Promise<Background> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return rasterize(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fromPdf(file: File): Promise<Background> {
  const pdfjs = await import(/* @vite-ignore */ `${PDFJS}/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(4, MAX_PX / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { url: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height, opacity: 0.6 };
}

function rasterize(img: CanvasImageSource, w: number, h: number): Background {
  const k = Math.min(1, MAX_PX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { url: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height, opacity: 0.6 };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("無法讀取圖片"));
    img.src = url;
  });
}
