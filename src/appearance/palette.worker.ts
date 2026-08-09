import { extractWallpaperPalettes, type PaletteWorkerRequest, type PaletteWorkerResponse } from './imagePalette';

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PaletteWorkerRequest>) => void) | null;
  postMessage: (message: PaletteWorkerResponse) => void;
};

workerScope.onmessage = ({ data }) => {
  try {
    const result = extractWallpaperPalettes({
      data: new Uint8ClampedArray(data.pixels),
      width: data.width,
      height: data.height,
    });
    workerScope.postMessage({ requestId: data.requestId, ...result });
  } catch {
    workerScope.postMessage({ requestId: data.requestId, error: 'palette_failed' });
  }
};

export {};
