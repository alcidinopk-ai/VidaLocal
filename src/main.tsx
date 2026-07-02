import {StrictMode} from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CityProvider } from './contexts/CityContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { FavoritesProvider } from './contexts/FavoritesContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Bypass full rendering in OAuth popups
const isPopup = typeof window !== 'undefined' && window.opener && (
  window.name === 'google-login' || 
  window.location.hash.includes('access_token=') || 
  window.location.search.includes('code=')
);

if (isPopup) {
  // Let Supabase load to parse the token (it runs on import)
  document.body.innerHTML = `
    <div style="font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #ffffff; color: #18181b; text-align: center; padding: 24px;">
      <div style="border: 3.5px solid #f4f4f5; border-top: 3.5px solid #f57c00; border-radius: 50%; width: 44px; height: 44px; animation: spin 0.8s linear infinite; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(245, 124, 0, 0.1);"></div>
      <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; tracking: -0.025em; color: #09090b;">Autenticando via Google...</h3>
      <p style="margin: 0; font-size: 13px; color: #71717a; font-weight: 500;">Esta janela fechará automaticamente.</p>
    </div>
    <style>
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  `;
  
  // Just import supabase to let it process the URL hash and store credentials
  import('./lib/supabase').then(({ supabase }) => {
    supabase.auth.getSession().then(() => {
      setTimeout(() => {
        try {
          window.opener.postMessage({ type: 'SUPABASE_OAUTH_SUCCESS' }, '*');
        } catch (e) {
          console.error(e);
        }
        window.close();
      }, 1000);
    });
  });
} else {
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
}
