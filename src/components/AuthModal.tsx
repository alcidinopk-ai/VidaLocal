import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Mail, Lock, Loader2, AlertCircle, CheckCircle2, User as UserIcon, HelpCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const { user, setIsRegisterUserModalOpen } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [show403Help, setShow403Help] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isForgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (resetError) throw resetError;
        setSuccess('E-mail de recuperação enviado com sucesso! Por favor, verifique sua caixa de entrada.');
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (loginError) throw loginError;
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao processar sua solicitação.');
      if (err.message?.includes('403') || err.status === 403) {
        setShow403Help(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          skipBrowserRedirect: true,
        },
      });
      if (oauthError) throw oauthError;
      if (data?.url) {
        const popup = window.open(data.url, 'google-login', 'width=570,height=600,status=no,menubar=no,toolbar=no');
        if (!popup) {
          throw new Error('O bloqueador de popups impediu a autenticação. Por favor, permita popups para este site.');
        }
      } else {
        throw new Error('Não foi possível obter a URL de autenticação com o Google.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar com o Google.');
      setIsLoading(false);
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
              {isForgotPassword ? <ArrowLeft className="w-5 h-5 cursor-pointer" onClick={() => setIsForgotPassword(false)} /> : <UserIcon className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">
                {isForgotPassword ? 'Recuperar senha' : 'Identifique-se no VidaLocal'}
              </h2>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-[240px]">
                {isForgotPassword 
                  ? 'Insira seu email para mudar sua senha' 
                  : 'Para interagir e aproveitar o melhor da cidade, você precisa se identificar primeiro'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer">
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
              <h3 className="text-lg font-bold text-zinc-900 mb-2">Concluido!</h3>
              <p className="text-sm text-zinc-500 mb-6 leading-relaxed">{success}</p>
              <button 
                onClick={() => {
                  setSuccess(null);
                  if (isForgotPassword) {
                    setIsForgotPassword(false);
                  } else {
                    onClose();
                  }
                }}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all cursor-pointer"
              >
                Continuar
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                  
                  {show403Help && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                        <HelpCircle className="w-4 h-4" /> Configuração pendente:
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
                          <span>Adicione <b>{window.location.origin}</b> aos "Redirect URLs" autorizados.</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Google Login or Email login */}
              {!isForgotPassword && (
                <>
                  {/* 1. Google Login (Continuar com Google) as option 1 */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full py-3.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] font-bold rounded-2xl transition-all shadow-sm flex items-center justify-center disabled:opacity-50 text-sm cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#f57c00]" />
                    ) : (
                      <>
                        <GoogleIcon />
                        Continuar com Google
                      </>
                    )}
                  </button>

                  {/* 2. Divider "ou" */}
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-zinc-200"></div>
                    <span className="flex-shrink mx-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">ou</span>
                    <div className="flex-grow border-t border-zinc-200"></div>
                  </div>
                </>
              )}

              {/* 3. Traditional Email Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
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

                {!isForgotPassword && (
                  <div className="space-y-1.5 animate-fadeIn">
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
                    {/* Esqueci minha senha link */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError(null);
                        }}
                        className="text-xs font-semibold text-zinc-400 hover:text-[#f57c00] transition-colors"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-[#f57c00] text-white rounded-xl font-bold hover:bg-[#e65100] transition-all shadow-lg shadow-orange-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    isForgotPassword ? 'Enviar e-mail para recuperar' : 'Entrar'
                  )}
                </button>

                <div className="pt-4 text-center">
                  {isForgotPassword ? (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setError(null);
                      }}
                      className="text-xs font-bold text-[#f57c00] hover:underline transition-colors"
                    >
                      Voltar ao Login
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => {
                        onClose();
                        setIsRegisterUserModalOpen(true);
                      }}
                      className="text-xs font-bold text-zinc-500 hover:text-[#f57c00] transition-colors"
                    >
                      Ainda não faz parte? Cadastre-se
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
