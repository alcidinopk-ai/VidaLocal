import {StrictMode} from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { CityProvider } from './contexts/CityContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <CityProvider>
          <App />
        </CityProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
