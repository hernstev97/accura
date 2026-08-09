import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { loadWallpaperPreview, removeWallpaperPreview, saveWallpaperPreview } from './wallpaperStore';

afterEach(async () => {
  await removeWallpaperPreview().catch(() => undefined);
});

describe('local wallpaper preview storage', () => {
  it('stores only the thumbnail blob and removes it explicitly', async () => {
    const thumbnail = new Blob(['local-thumbnail'], { type: 'image/webp' });
    await saveWallpaperPreview(thumbnail);
    const loaded = await loadWallpaperPreview();
    expect(loaded?.type).toBe('image/webp');
    expect(await loaded?.text()).toBe('local-thumbnail');
    await removeWallpaperPreview();
    expect(await loadWallpaperPreview()).toBeNull();
  });

  it('fails safely when IndexedDB is unavailable', async () => {
    const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });

    try {
      await expect(saveWallpaperPreview(new Blob(['thumbnail'], { type: 'image/webp' }))).rejects.toThrow('IndexedDB is unavailable');
      await expect(loadWallpaperPreview()).rejects.toThrow('IndexedDB is unavailable');
      await expect(removeWallpaperPreview()).rejects.toThrow('IndexedDB is unavailable');
    } finally {
      if (indexedDbDescriptor) Object.defineProperty(globalThis, 'indexedDB', indexedDbDescriptor);
    }
  });
});
