import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppearanceProvider } from './appearance/AppearanceProvider';
import { initializeAppearanceBeforeRender } from './appearance/appearanceStore';
import { FinanceDataProvider } from './data/FinanceDataProvider';
import { productionFinanceApi } from './data/financeApi';
import type { PickerLauncher } from './data/googlePicker';
import './design/tokens.css';
import './styles.css';

registerSW({ immediate: true });
const initialAppearance = initializeAppearanceBeforeRender();

let financeApi = productionFinanceApi;
let mockPicker: PickerLauncher | undefined;
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true') {
  financeApi = (await import('./mocks/mockFinanceApi')).mockFinanceApi;
  mockPicker = async () => ({ id: 'mock-spreadsheet-id', name: 'Anonyme Beispieldaten' });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppearanceProvider initialSnapshot={initialAppearance}>
      <FinanceDataProvider api={financeApi} pickerLauncher={mockPicker}>
        <App />
      </FinanceDataProvider>
    </AppearanceProvider>
  </StrictMode>,
);
