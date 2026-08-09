import { QuantizerCelebi, Score, argbFromRgb, hexFromArgb } from '@material/material-color-utilities';
import { createWallpaperPalettes, dedupeSeedColors } from './themePalettes';
import { DEFAULT_THEME_SEED } from './themeTokens';
import type { PaletteCandidate } from './types';

export const MAX_WALLPAPER_FILE_BYTES = 20 * 1024 * 1024;
export const ANALYSIS_MAX_EDGE = 192;
export const PREVIEW_MAX_EDGE = 480;
export const PREVIEW_TARGET_BYTES = 250 * 1024;
const MAX_DECODED_PIXELS = 100_000_000;
const MAX_DECODED_EDGE = 24_000;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const WALLPAPER_IMAGE_ERROR = 'Dieses Bild konnte nicht verarbeitet werden. Wähle eine JPG-, PNG- oder WebP-Datei mit höchstens 20 MB.';

export class WallpaperImageError extends Error {
  constructor() {
    super(WALLPAPER_IMAGE_ERROR);
    this.name = 'WallpaperImageError';
  }
}

export type PixelBuffer = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type WallpaperAnalysisResult = {
  candidates: PaletteCandidate[];
  seeds: string[];
  thumbnail: Blob;
};

export type PaletteWorkerRequest = {
  requestId: number;
  pixels: ArrayBuffer;
  width: number;
  height: number;
};

export type PaletteWorkerResponse = {
  requestId: number;
  candidates?: PaletteCandidate[];
  seeds?: string[];
  error?: string;
};

export class WallpaperAnalysisRaceGuard {
  private generation = 0;

  begin() {
    this.generation += 1;
    return this.generation;
  }

  invalidate() {
    this.generation += 1;
  }

  isCurrent(generation: number) {
    return generation === this.generation;
  }
}

function abortError() {
  return new DOMException('Wallpaper analysis was aborted.', 'AbortError');
}

function ensureActive(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

export function quantizeWallpaperSeeds({ data, width, height }: PixelBuffer): string[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || data.length !== width * height * 4) {
    throw new WallpaperImageError();
  }
  const pixels: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 128) continue;
    if (alpha < 255) {
      const opacity = alpha / 255;
      pixels.push(argbFromRgb(
        data[index] * opacity + 255 * (1 - opacity),
        data[index + 1] * opacity + 255 * (1 - opacity),
        data[index + 2] * opacity + 255 * (1 - opacity),
      ));
    } else {
      pixels.push(argbFromRgb(data[index], data[index + 1], data[index + 2]));
    }
  }
  if (!pixels.length) return [DEFAULT_THEME_SEED];
  const quantized = QuantizerCelebi.quantize(pixels, 128);
  const ranked = Score.score(quantized, { desired: 8, fallbackColorARGB: argbFromRgb(47, 102, 122), filter: true });
  return dedupeSeedColors(ranked.map((argb) => hexFromArgb(argb)), 3);
}

export function extractWallpaperPalettes(pixels: PixelBuffer): { candidates: PaletteCandidate[]; seeds: string[] } {
  const seeds = quantizeWallpaperSeeds(pixels);
  return { candidates: createWallpaperPalettes(seeds), seeds };
}

function scaledSize(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new WallpaperImageError()), 'image/webp', quality));
}

async function createThumbnail(bitmap: ImageBitmap, signal?: AbortSignal): Promise<Blob> {
  const attempts = [
    { maxEdge: PREVIEW_MAX_EDGE, quality: 0.76 },
    { maxEdge: PREVIEW_MAX_EDGE, quality: 0.58 },
    { maxEdge: 384, quality: 0.58 },
    { maxEdge: 300, quality: 0.52 },
    { maxEdge: 240, quality: 0.48 },
  ];
  let latest: Blob | null = null;
  for (const attempt of attempts) {
    ensureActive(signal);
    const size = scaledSize(bitmap.width, bitmap.height, attempt.maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new WallpaperImageError();
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    latest = await canvasBlob(canvas, attempt.quality);
    canvas.width = 0;
    canvas.height = 0;
    if (latest.size <= PREVIEW_TARGET_BYTES) return latest;
  }
  if (!latest) throw new WallpaperImageError();
  return latest;
}

function analysisPixels(bitmap: ImageBitmap): PixelBuffer {
  const size = scaledSize(bitmap.width, bitmap.height, ANALYSIS_MAX_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) throw new WallpaperImageError();
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const imageData = context.getImageData(0, 0, size.width, size.height);
  canvas.width = 0;
  canvas.height = 0;
  return { data: imageData.data, width: size.width, height: size.height };
}

let workerRequestId = 0;

export async function analyzePixelsOffThread(pixels: PixelBuffer, signal?: AbortSignal): Promise<{ candidates: PaletteCandidate[]; seeds: string[] }> {
  ensureActive(signal);
  if (typeof Worker === 'undefined') return extractWallpaperPalettes(pixels);

  const fallbackPixels = pixels.data.slice();
  let worker: Worker;
  try {
    worker = new Worker(new URL('./palette.worker.ts', import.meta.url), { type: 'module', name: 'finance-palette' });
  } catch {
    return extractWallpaperPalettes(pixels);
  }

  const requestId = ++workerRequestId;
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
    };
    const fallback = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        resolve(extractWallpaperPalettes({ data: fallbackPixels, width: pixels.width, height: pixels.height }));
      } catch (error) {
        reject(error);
      }
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onerror = (event) => {
      event.preventDefault();
      fallback();
    };
    worker.onmessage = ({ data }: MessageEvent<PaletteWorkerResponse>) => {
      if (data.requestId !== requestId || settled) return;
      settled = true;
      cleanup();
      if (data.error || !data.candidates || !data.seeds) reject(new WallpaperImageError());
      else resolve({ candidates: data.candidates, seeds: data.seeds });
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    const transferablePixels = new Uint8ClampedArray(pixels.data).buffer;
    const request: PaletteWorkerRequest = { requestId, pixels: transferablePixels, width: pixels.width, height: pixels.height };
    try {
      worker.postMessage(request, [request.pixels]);
    } catch {
      fallback();
    }
  });
}

export async function analyzeWallpaperFile(file: File, signal?: AbortSignal): Promise<WallpaperAnalysisResult> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_WALLPAPER_FILE_BYTES) throw new WallpaperImageError();
  ensureActive(signal);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new WallpaperImageError();
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > MAX_DECODED_EDGE || bitmap.height > MAX_DECODED_EDGE || bitmap.width * bitmap.height > MAX_DECODED_PIXELS) {
      throw new WallpaperImageError();
    }
    ensureActive(signal);
    const pixels = analysisPixels(bitmap);
    const thumbnailPromise = createThumbnail(bitmap, signal);
    const palettePromise = analyzePixelsOffThread(pixels, signal);
    const [thumbnail, palette] = await Promise.all([thumbnailPromise, palettePromise]);
    ensureActive(signal);
    return { ...palette, thumbnail };
  } finally {
    bitmap.close();
  }
}
