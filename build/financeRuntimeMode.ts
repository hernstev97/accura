type BuildEnvironment = Record<string, string | undefined>;

type ResolveMockApiOptions = {
  command: 'build' | 'serve';
  environment?: BuildEnvironment;
};

/**
 * The decision is compiled into the bundle so production cannot switch data
 * sources at runtime and does not ship the anonymous fixture chunk.
 */
export function resolveMockApiEnabled({
  command,
  environment = process.env,
}: ResolveMockApiOptions): boolean {
  if (command === 'build') {
    return (environment.VERCEL_ENV ?? environment.VITE_VERCEL_ENV) === 'preview';
  }
  return environment.VITE_USE_MOCK_API === 'true';
}
