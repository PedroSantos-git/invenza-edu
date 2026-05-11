import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '@/api/db';
import { supabase, hasSupabaseConfig } from '@/api/supabaseClient';

const AuthContext = createContext(null);

const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const userRef = React.useRef(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Sync ref with state for use in closures
  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        setIsLoadingAuth(true);
        setAuthError(null);

        if (!hasSupabaseConfig || !supabase) {
          setUser(null);
          userRef.current = null;
          setIsAuthenticated(false);
          setAuthError({ type: 'config_missing', message: 'Configuração do Supabase em falta' });
          setIsLoadingAuth(false);
          setAuthChecked(true);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) {
          setUser(null);
          userRef.current = null;
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_error', message: error.message });
          setIsLoadingAuth(false);
          setAuthChecked(true);
          return;
        }

        await resolveAccess(data.session);
      } catch (err) {
        console.error('Erro no boot de autenticação:', err);
        if (mounted) {
          setAuthError({ type: 'auth_error', message: 'Erro ao carregar sessão de utilizador' });
        }
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      }
    };

    if (!hasSupabaseConfig || !supabase) {
      boot();
      return () => {
        mounted = false;
      };
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // Don't show full loading if we already have a user and it's just a refresh
      const isRoutineRefresh = (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && userRef.current;
      
      if (!isRoutineRefresh) {
        setIsLoadingAuth(true);
      }
      
      setAuthError(null);
      
      try {
        await resolveAccess(session);
      } catch (err) {
        console.error(`Erro ao processar evento de autenticação (${event}):`, err);
        if (!userRef.current) {
          setAuthError({ type: 'auth_error', message: 'Erro ao processar sessão' });
        }
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      }
    });

    boot();

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

    const resolveAccess = async (session) => {
      if (!session?.user) {
        setUser(null);
        userRef.current = null;
        setIsAuthenticated(false);
        setAuthError(null);
        return;
      }

      const email = session.user.email?.toLowerCase();
      const googleName = session.user.user_metadata?.full_name;
      const googleFoto = session.user.user_metadata?.avatar_url;

      // DEFINIR UTILIZADOR IMEDIATAMENTE (Otimista)
      // Isto evita o timeout e a mensagem de erro ao fazer refresh
      const optimisticUser = {
        id: session.user.id,
        email,
        full_name: googleName || email,
        foto: googleFoto || null,
        role: email === PROTECTED_EMAIL ? 'admin' : 'staff',
        ativo: true,
        access: 'staff',
        isOptimistic: true
      };

      if (!userRef.current || userRef.current.email !== email) {
        setUser(optimisticUser);
        userRef.current = optimisticUser;
        setIsAuthenticated(true);
      }

      // Validar na base de dados em background (sem bloquear a UI)
      _resolveAccessInternal(session).catch(err => {
        console.error('Erro na validação de background:', err);
      });
    };

    const _resolveAccessInternal = async (session) => {
      const email = session.user.email?.toLowerCase();
      const googleName = session.user.user_metadata?.full_name;
      const googleFoto = session.user.user_metadata?.avatar_url;

      try {
        if (email === PROTECTED_EMAIL) {
          const existing = await db.entities.User.maybeByEmail(email).catch(() => null);
          
          if (existing && googleName && googleName !== existing.full_name) {
            await db.entities.User.update(existing.id, { full_name: googleName }).catch(console.error);
          }

          const appUser = {
            id: session.user.id,
            email,
            full_name: googleName || existing?.full_name || email,
            foto: existing?.foto || googleFoto || null,
            role: 'admin',
            ativo: true,
            access: 'staff',
            pessoa: null,
            isOptimistic: false
          };
          setUser(appUser);
          userRef.current = appUser;
          return;
        }

        const [utilizador, pessoa] = await Promise.all([
          db.entities.User.maybeByEmail(email).catch(() => null),
          db.entities.Pessoa.maybeByEmail(email).catch(() => null)
        ]);

        if (utilizador && utilizador.ativo !== false) {
          const appUser = {
            id: session.user.id,
            email,
            full_name: googleName || utilizador.full_name || email,
            foto: utilizador.foto || googleFoto || null,
            role: utilizador.role || 'staff',
            ativo: true,
            access: 'staff',
            pessoa: null,
            isOptimistic: false
          };
          setUser(appUser);
          userRef.current = appUser;
          return;
        }

        if (pessoa && pessoa.ativo !== false) {
          const appUser = {
            id: session.user.id,
            email,
            full_name: pessoa.nome || googleName || email,
            foto: pessoa.foto || googleFoto || null,
            role: 'pessoa',
            ativo: true,
            access: 'pessoa',
            pessoa,
            isOptimistic: false
          };
          setUser(appUser);
          userRef.current = appUser;
          return;
        }

        // Se não existir na DB, remove o acesso
        setUser(null);
        userRef.current = null;
        setIsAuthenticated(false);
        setAuthError({ type: 'unauthorized', message: 'Utilizador não autorizado' });
      } catch (err) {
        console.warn('Erro ao validar na DB, mantendo acesso otimista:', err);
      }
    };

  const logout = async () => {
    if (!hasSupabaseConfig) return;
    await db.auth.logout();
  };

  const navigateToLogin = async () => {
    if (!hasSupabaseConfig) return;
    await db.auth.signInWithGoogle();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      authError,
      authChecked,
      logout,
      navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
