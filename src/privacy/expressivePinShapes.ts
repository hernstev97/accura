import type { ShapeName } from 'shape-morph/react';

export const EXPRESSIVE_PIN_SHAPE_NAMES = [
  'Oval',
  'Pill',
  'Triangle',
  'Arrow',
  'Fan',
  'Diamond',
  'ClamShell',
  'Pentagon',
  'Gem',
  'Sunny',
  'VerySunny',
  'Cookie4Sided',
  'Cookie6Sided',
  'Cookie7Sided',
  'Cookie9Sided',
] as const satisfies readonly ShapeName[];

export type ExpressivePinShapeName = typeof EXPRESSIVE_PIN_SHAPE_NAMES[number];

export function chooseExpressivePinShape(
  cryptoRef: Pick<Crypto, 'getRandomValues'> | undefined = globalThis.crypto,
): ExpressivePinShapeName {
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== 'function') return EXPRESSIVE_PIN_SHAPE_NAMES[0];
  const random = cryptoRef.getRandomValues(new Uint32Array(1))[0];
  return EXPRESSIVE_PIN_SHAPE_NAMES[random % EXPRESSIVE_PIN_SHAPE_NAMES.length];
}
