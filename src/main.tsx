import {StrictMode} from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CityProvider } from './contexts/CityContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <CityProvider>
          <ToastProvider>
            <FavoritesProvider>
              <App />
            </FavoritesProvider>
          </ToastProvider>
        </CityProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
