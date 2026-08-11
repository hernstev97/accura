import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppearanceProvider } from './appearance/AppearanceProvider';
import { initializeAppearanceBeforeRender } from './appearance/appearanceStore';
import { FinanceDataProvider } from './data/FinanceDataProvider';
import { productionFinanceApi } from './data/financeApi';
import type { PickerLauncher } from './data/googlePicker';
import { PrivacyProvider } from './privacy/PrivacyProvider';
import { initializePrivacyBeforeRender } from './privacy/privacyStore';
import './design/tokens.css';
import './styles.css';

const initialAppearance = initializeAppearanceBeforeRender();
const initialPrivacy = initializePrivacyBeforeRender();

let financeApi = productionFinanceApi;
let mockPicker: PickerLauncher | undefined;
if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true') {
  financeApi = (await import('./mocks/mockFinanceApi')).mockFinanceApi;
  mockPicker = async () => ({ id: 'mock-spreadsheet-id', name: 'Anonyme Beispieldaten' });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivacyProvider initialEnabled={initialPrivacy}>
      <AppearanceProvider initialSnapshot={initialAppearance}>
        <FinanceDataProvider api={financeApi} pickerLauncher={mockPicker}>
          <App />
        </FinanceDataProvider>
      </AppearanceProvider>
    </PrivacyProvider>
  </StrictMode>,
);
