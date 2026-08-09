import { describe, expect, it } from 'vitest';
import { MAX_WALLPAPER_FILE_BYTES, WALLPAPER_IMAGE_ERROR, WallpaperAnalysisRaceGuard, WallpaperImageError, analyzeWallpaperFile, extractWallpaperPalettes, quantizeWallpaperSeeds } from './imagePalette';
import { areSeedsDistinct, createWallpaperPalettes, dedupeSeedColors } from './themePalettes';

function syntheticPixels(colors: readonly [number, number, number][], width = 30, height = 20) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const color = colors[Math.min(colors.length - 1, Math.floor(pixel / (width * height / colors.length)))];
    const offset = pixel * 4;
    data.set([...color, 255], offset);
  }
  return { data, width, height };
}

describe('wallpaper quantization and palette creation', () => {
  it('uses Celebi and Material Score deterministically on synthetic pixels', () => {
    const pixels = syntheticPixels([[170, 42, 68], [35, 92, 156], [44, 126, 84]]);
    const first = quantizeWallpaperSeeds(pixels);
    const second = quantizeWallpaperSeeds(pixels);
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first.length).toBeLessThanOrEqual(3);
    expect(first.every((seed) => /^#[\dA-F]{6}$/.test(seed))).toBe(true);
  });

  it('always returns five to seven complete candidates', () => {
    const result = extractWallpaperPalettes(syntheticPixels([[216, 72, 96], [45, 100, 190], [40, 148, 91]]));
    expect(result.candidates.length).toBeGreaterThanOrEqual(5);
    expect(result.candidates.length).toBeLessThanOrEqual(7);
    expect(result.candidates.slice(0, 5).map(({ variant }) => variant)).toEqual(['tonalSpot', 'neutral', 'vibrant', 'expressive', 'monochrome']);
    expect(new Set(result.candidates.map(({ id }) => id)).size).toBe(result.candidates.length);
  });

  it('deduplicates near-identical HCT seeds while preserving distinct hues', () => {
    const seeds = dedupeSeedColors(['#2F667A', '#30677B', '#8E4D64', '#3F5F90']);
    expect(seeds[0]).toBe('#2F667A');
    expect(seeds).not.toContain('#30677B');
    expect(seeds.length).toBeLessThanOrEqual(3);
    expect(areSeedsDistinct('#2F667A', '#8E4D64')).toBe(true);
  });

  it('uses the deterministic fallback for fully transparent images', () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    expect(quantizeWallpaperSeeds({ data, width: 4, height: 4 })).toEqual(['#2F667A']);
    expect(createWallpaperPalettes(['#2F667A'])).toHaveLength(5);
  });

  it('rejects corrupt pixel buffers with the controlled user-facing error', () => {
    expect(() => quantizeWallpaperSeeds({ data: new Uint8ClampedArray(3), width: 1, height: 1 })).toThrow(WallpaperImageError);
    expect(new WallpaperImageError().message).toBe(WALLPAPER_IMAGE_ERROR);
  });

  it('rejects unsupported, oversized, and corrupt files with one controlled error', async () => {
    await expect(analyzeWallpaperFile({ type: 'image/gif', size: 128 } as File)).rejects.toThrow(WALLPAPER_IMAGE_ERROR);
    await expect(analyzeWallpaperFile({ type: 'image/png', size: MAX_WALLPAPER_FILE_BYTES + 1 } as File)).rejects.toThrow(WALLPAPER_IMAGE_ERROR);
    await expect(analyzeWallpaperFile({ type: 'image/png', size: 128 } as File)).rejects.toThrow(WALLPAPER_IMAGE_ERROR);
  });

  it('prevents an older asynchronous analysis from replacing a newer selection', () => {
    const guard = new WallpaperAnalysisRaceGuard();
    const older = guard.begin();
    const newer = guard.begin();
    expect(guard.isCurrent(older)).toBe(false);
    expect(guard.isCurrent(newer)).toBe(true);
    guard.invalidate();
    expect(guard.isCurrent(newer)).toBe(false);
  });
});
