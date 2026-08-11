import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PwaUpdateNoticeView } from './PwaUpdateNotice';

const baseProps = {
  needRefresh: true,
  updating: false,
  error: null,
  onUpdate: vi.fn(),
  onDismiss: vi.fn(),
};

describe('PwaUpdateNoticeView', () => {
  it('stays absent until a new service worker is waiting', () => {
    expect(renderToStaticMarkup(createElement(PwaUpdateNoticeView, { ...baseProps, needRefresh: false }))).toBe('');
  });

  it('announces an understandable update with explicit update and defer actions', () => {
    const markup = renderToStaticMarkup(createElement(PwaUpdateNoticeView, baseProps));
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('Neue Version verfügbar');
    expect(markup).toContain('accura wurde aktualisiert. Lade die App neu, um die neue Version zu verwenden.');
    expect(markup).toContain('Jetzt neu laden');
    expect(markup).toContain('Später');
  });

  it('exposes progress and a recoverable activation error', () => {
    const updating = renderToStaticMarkup(createElement(PwaUpdateNoticeView, { ...baseProps, updating: true }));
    expect(updating).toContain('aria-busy="true"');
    expect(updating).toContain('Wird neu geladen …');
    expect(updating.match(/disabled=""/g)).toHaveLength(2);

    const failed = renderToStaticMarkup(createElement(PwaUpdateNoticeView, { ...baseProps, error: 'Bitte erneut versuchen.' }));
    expect(failed).toContain('inline-notice--warning');
    expect(failed).toContain('Bitte erneut versuchen.');
    expect(failed).toContain('Jetzt neu laden');
  });
});
