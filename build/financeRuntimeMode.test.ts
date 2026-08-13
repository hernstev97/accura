import { describe, expect, it } from 'vitest';
import { resolveMockApiEnabled } from './financeRuntimeMode';

describe('resolveMockApiEnabled', () => {
  it.each(['VERCEL_ENV', 'VITE_VERCEL_ENV'] as const)('uses anonymous mock data when %s identifies a preview build', (variable) => {
    expect(resolveMockApiEnabled({
      command: 'build',
      environment: { [variable]: 'preview' },
    })).toBe(true);
  });

  it('keeps the explicit local development mock', () => {
    expect(resolveMockApiEnabled({
      command: 'serve',
      environment: { VITE_USE_MOCK_API: 'true' },
    })).toBe(true);
  });

  it('uses the real API for ordinary local development', () => {
    expect(resolveMockApiEnabled({ command: 'serve', environment: {} })).toBe(false);
  });

  it.each(['production', undefined])('cannot enable mocks in a non-preview build through VITE_USE_MOCK_API (%s)', (vercelEnvironment) => {
    expect(resolveMockApiEnabled({
      command: 'build',
      environment: {
        VERCEL_ENV: vercelEnvironment,
        VITE_USE_MOCK_API: 'true',
      },
    })).toBe(false);
  });
});
