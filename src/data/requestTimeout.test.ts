import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestTimeoutError, runWithAbortTimeout } from './requestTimeout';

describe('abortable request timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts the operation and rejects at the deadline even when the operation ignores the signal', async () => {
    vi.useFakeTimers();
    let operationSignal: AbortSignal | undefined;
    const result = runWithAbortTimeout((signal) => {
      operationSignal = signal;
      return new Promise<void>(() => {});
    }, 1_000);
    const rejection = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);

    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
    expect(operationSignal?.aborted).toBe(true);
    expect(operationSignal?.reason).toBeInstanceOf(RequestTimeoutError);
  });

  it('returns successful results without aborting their signal', async () => {
    let operationSignal: AbortSignal | undefined;

    await expect(runWithAbortTimeout(async (signal) => {
      operationSignal = signal;
      return 'ok';
    }, 1_000)).resolves.toBe('ok');

    expect(operationSignal?.aborted).toBe(false);
  });
});
