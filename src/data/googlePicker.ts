import type { FinanceApi, FinanceResponse, PickerConfig } from './financeApi';

export type PickerSelection = { id: string; name: string } | null;
export type PickerLauncher = (config: PickerConfig) => Promise<PickerSelection>;

export async function selectSpreadsheetWithPicker(
  api: FinanceApi,
  launcher: PickerLauncher,
  csrfToken: string,
  signal?: AbortSignal,
): Promise<FinanceResponse | null> {
  const config = await api.getPickerConfig(signal);
  const selected = await launcher(config);
  if (!selected) return null;
  return api.saveSpreadsheet(selected.id, csrfToken, signal);
}

let pickerScript: Promise<void> | null = null;

function loadPickerScript() {
  if (globalThis.google?.picker) return Promise.resolve();
  if (pickerScript) return pickerScript;
  pickerScript = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-picker]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Picker konnte nicht geladen werden.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.dataset.googlePicker = 'true';
    script.onload = () => globalThis.gapi.load('picker', { callback: resolve, onerror: () => reject(new Error('Google Picker konnte nicht geladen werden.')) });
    script.onerror = () => reject(new Error('Google Picker konnte nicht geladen werden.'));
    document.head.append(script);
  });
  return pickerScript;
}

export const launchGooglePicker: PickerLauncher = async (config) => {
  await loadPickerScript();
  return new Promise((resolve) => {
    let accessToken = config.accessToken;
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setMimeTypes('application/vnd.google-apps.spreadsheet')
      .setSelectFolderEnabled(false);
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setAppId(config.appId)
      .setDeveloperKey(config.apiKey)
      .setOAuthToken(accessToken)
      .setOrigin(window.location.origin)
      .setCallback((event) => {
        if (event.action === google.picker.Action.PICKED) {
          const document = event.docs?.[0];
          accessToken = '';
          resolve(document ? { id: document.id, name: document.name } : null);
        } else if (event.action === google.picker.Action.CANCEL) {
          accessToken = '';
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
};
