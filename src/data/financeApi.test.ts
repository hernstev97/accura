import { afterEach, describe, expect, it, vi } from 'vitest';
import { productionFinanceApi } from './financeApi';

describe('production finance API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards the disconnect abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await productionFinanceApi.disconnect('csrf-token', controller.signal);

    expect(fetchMock).toHaveBeenCalledWith('/api/connection/disconnect', expect.objectContaining({
      headers: { 'x-csrf-token': 'csrf-token' },
      method: 'POST',
      signal: controller.signal,
    }));
  });
});
