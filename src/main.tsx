import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppearanceProvider } from './appearance/AppearanceProvider';
import { initializeAppearanceBeforeRender } from './appearance/appearanceStore';
import { FinanceDataProvider } from './data/FinanceDataProvider';
import { productionFinanceApi } from './data/financeApi';
import { initializeNavigationBeforeRender } from './navigation/appNavigation';
import { PrivacyProvider } from './privacy/PrivacyProvider';
import { initializeAppProtectionBeforeRender } from './privacy/appProtectionStore';
import { initializePrivacyBeforeRender } from './privacy/privacyStore';
import './design/tokens.css';
import './styles.css';

const initialAppearance = initializeAppearanceBeforeRender();
const initialDestination = initializeNavigationBeforeRender();
const initialPrivacy = initializePrivacyBeforeRender();
const initialProtection = initializeAppProtectionBeforeRender();

const financeApi = __ACCURA_MOCK_API_ENABLED__
  ? (await import('./mocks/mockFinanceApi')).mockFinanceApi
  : productionFinanceApi;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivacyProvider initialEnabled={initialPrivacy} initialProtection={initialProtection}>
      <AppearanceProvider initialSnapshot={initialAppearance}>
        <FinanceDataProvider api={financeApi}>
          <App initialDestination={initialDestination} />
        </FinanceDataProvider>
      </AppearanceProvider>
    </PrivacyProvider>
  </StrictMode>,
);
