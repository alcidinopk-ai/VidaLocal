import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, Loader2, AlertCircle, CheckCircle2, User as UserIcon, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [show403Help, setShow403Help] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Basic security check - allow same origin
      if (event.origin !== window.location.origin) {
        // Also allow common dev/preview domains
        const isAllowed = 
          event.origin.endsWith('.run.app') || 
          event.origin.includes('localhost') || 
          event.origin.includes('vercel.app');
        
        if (!isAllowed) return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        console.log('[Auth] Google login success message received');
        onClose();
      }

      if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        console.error('[Auth] Google login error message received');
        setError(event.data.error || 'Erro na autenticação. Verifique as configurações de URL no Supabase.');
        setIsGoogleLoading(false);
        if (event.data.error?.includes('403')) {
          setShow403Help(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isLogin) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
        onClose();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar sua solicitação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    setShow403Help(false);
    console.log('[Auth] Starting Google OAuth flow...');
    
    try {
      const callbackUrl = `${window.location.origin}/auth/callback`;
      console.log('[Auth] Redirect URL:', callbackUrl);

      const { data, error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (googleError) {
        console.error('[Auth] Supabase OAuth error:', googleError);
        throw googleError;
      }

      if (data?.url) {
        console.log('[Auth] Opening popup window...');
        
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.url,
          'google_login_popup',
          `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
        );

        if (!popup) {
          setIsGoogleLoading(false);
          const blockMsg = 'O bloqueador de pop-ups impediu o login. Por favor, permita pop-ups para este site e tente novamente.';
          setError(blockMsg);
          console.warn('[Auth] Popup blocked');
          return;
        }

        // Periodically check if popup is closed as a fallback
        const checkPopup = setInterval(async () => {
          if (popup.closed) {
            clearInterval(checkPopup);
            console.log('[Auth] Popup closed by user or success');
            
            // Give it a moment to process the session
            setTimeout(async () => {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData.session) {
                console.log('[Auth] Session found after popup close');
                onClose();
              } else {
                setIsGoogleLoading(false);
              }
            }, 1000);
          }
        }, 1000);
      } else {
        throw new Error('Não foi possível gerar a URL de login do Google.');
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      const errorMsg = err.message || '';
      
      if (errorMsg.includes('403') || errorMsg.includes('forbidden') || errorMsg.includes('access_denied')) {
        setShow403Help(true);
      }
      
      const isRedirectError = errorMsg.includes('redirect') || errorMsg.includes('callback');
      setError(isRedirectError 
        ? `Erro de configuração: Verifique se "${window.location.origin}" está nos Redirect URIs do Supabase.`
        : (errorMsg || 'Ocorreu um erro ao entrar com o Google.'));
      setIsGoogleLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f57c00] flex items-center justify-center text-white shadow-lg">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">
                {isLogin ? 'Entrar no VidaLocal' : 'Criar Conta'}
              </h2>
              <p className="text-xs text-zinc-500">
                {isLogin ? 'Bem-vindo de volta!' : 'Junte-se a nós hoje'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {success ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">Sucesso!</h3>
              <p className="text-sm text-zinc-500 mb-6">{success}</p>
              <button 
                onClick={onClose}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all"
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                  
                  {(show403Help || error.includes('403')) && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                        <HelpCircle className="w-4 h-4" /> Como resolver o erro 403:
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                        Como resolver o erro 403:
                      </p>
                      <ul className="text-[10px] text-amber-800 space-y-1.5 list-none pl-1">
                        <li className="flex gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center font-bold text-[9px]">1</span>
                          <span>No Supabase: Auth {'>'} Configuration {'>'} URL Configuration</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center font-bold text-[9px]">2</span>
                          <span>No Supabase: Adicione <b>{window.location.origin}</b> aos "Redirect URLs" em Auth {'>'} Configuration.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center font-bold text-[9px]">3</span>
                          <span>No Supabase: Se adicionou colunas recentemente, vá em <b>Settings {'>'} API</b> e clique em <b>"PostgREST Config - Reload Schema"</b>.</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center font-bold text-[9px]">4</span>
                          <span>No Google Cloud: Verifique se o e-mail {user?.email || 'atual'} está como "Usuário de teste" caso o App esteja em modo de teste.</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f57c00]/10 focus:border-[#f57c00] transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f57c00]/10 focus:border-[#f57c00] transition-all text-sm"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full py-3.5 bg-[#f57c00] text-white rounded-xl font-bold hover:bg-[#e65100] transition-all shadow-lg shadow-orange-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  isLogin ? 'Entrar' : 'Cadastrar'
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-100"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-zinc-400 font-medium">Ou continuar com</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading || isLoading}
                className="w-full py-3 bg-white border border-zinc-200 text-zinc-700 rounded-xl font-bold hover:bg-zinc-50 transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-50"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Janela de login aberta...
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Entrar com Google
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <button 
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-xs font-bold text-zinc-500 hover:text-[#f57c00] transition-colors"
                >
                  {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre agora'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
