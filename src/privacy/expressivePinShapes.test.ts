import { describe, expect, it } from 'vitest';
import { shapeNames } from 'shape-morph';
import { EXPRESSIVE_PIN_SHAPE_NAMES, chooseExpressivePinShape } from './expressivePinShapes';

describe('ACC-14 expressive PIN shapes', () => {
  it('uses only official shape-morph Material 3 presets and excludes the final circle', () => {
    expect(EXPRESSIVE_PIN_SHAPE_NAMES.length).toBeGreaterThan(10);
    expect(EXPRESSIVE_PIN_SHAPE_NAMES.every((name) => shapeNames.includes(name))).toBe(true);
    expect(EXPRESSIVE_PIN_SHAPE_NAMES).not.toContain('Circle');
  });

  it('selects from the catalog using random bytes rather than a PIN digit', () => {
    const randomSource = {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        new Uint32Array(array.buffer, array.byteOffset, 1)[0] = 11;
        return array;
      },
    };
    expect(chooseExpressivePinShape(randomSource)).toBe(EXPRESSIVE_PIN_SHAPE_NAMES[11]);
  });
});
