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
      // Reduzir timeout para 10 segundos para falhar mais rápido se houver rede lenta
      // mas permitir que o site continue se a sessão for válida
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao verificar acesso')), 10000)
      );

      try {
        await Promise.race([_resolveAccessInternal(session), timeout]);
      } catch (err) {
        console.error('Erro em resolveAccess:', err);
        
        // Se houver timeout mas já tivermos uma sessão básica, 
        // deixamos o utilizador entrar com dados mínimos para não bloquear o site
        if (err.message === 'Timeout ao verificar acesso' && session?.user) {
          console.warn('Procedendo com acesso limitado devido a timeout na base de dados');
          const email = session.user.email?.toLowerCase();
          const googleName = session.user.user_metadata?.full_name;
          
          const fallbackUser = {
            id: session.user.id,
            email,
            full_name: googleName || email,
            role: email === PROTECTED_EMAIL ? 'admin' : 'staff',
            ativo: true,
            access: 'staff',
            isFallback: true
          };
          setUser(fallbackUser);
          userRef.current = fallbackUser;
          setIsAuthenticated(true);
          return;
        }
        throw err;
      }
    };

    const _resolveAccessInternal = async (session) => {
      if (!session?.user) {
        setUser(null);
        userRef.current = null;
        setIsAuthenticated(false);
        setAuthError(null);
        return;
      }

      const email = session.user.email?.toLowerCase();
      if (!email) {
        setUser(null);
        userRef.current = null;
        setIsAuthenticated(false);
        setAuthError({ type: 'invalid_session', message: 'Sessão inválida' });
        return;
      }

      // If user is already set and email matches, avoid re-fetching from DB
      // This speeds up routine session refreshes on window focus
      if (userRef.current && userRef.current.email === email && !authError) {
        return;
      }

      const googleName = session.user.user_metadata?.full_name;
      const googleFoto = session.user.user_metadata?.avatar_url;

      if (email === PROTECTED_EMAIL) {
        const existing = await db.entities.User.maybeByEmail(email).catch(() => null);
        
        // Sync protected user info
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
        };
        setUser(appUser);
        userRef.current = appUser;
        setIsAuthenticated(true);
        setAuthError(null);
        return;
      }

      // Check for user and pessoa in parallel to speed up initial load
      const [utilizador, pessoa] = await Promise.all([
        db.entities.User.maybeByEmail(email).catch(err => {
          console.error('Erro ao procurar utilizador:', err);
          return null;
        }),
        db.entities.Pessoa.maybeByEmail(email).catch(err => {
          console.error('Erro ao procurar pessoa:', err);
          return null;
        })
      ]);

      if (utilizador && utilizador.ativo !== false) {
        // Sync user info if it differs from Google (to keep it synced)
        const updates = {};
        if (googleName && googleName !== utilizador.full_name) updates.full_name = googleName;
        if (!utilizador.foto && googleFoto) updates.foto = googleFoto;
        
        if (Object.keys(updates).length > 0) {
          // Use a bypass/direct update if possible or ensure the policy allows self-update
          await db.entities.User.update(utilizador.id, updates).catch(err => {
            console.error('Erro ao sincronizar perfil (verificar políticas RLS):', err);
          });
        }

        const appUser = {
          id: session.user.id,
          email,
          full_name: googleName || utilizador.full_name || email,
          foto: utilizador.foto || googleFoto || null,
          role: utilizador.role || 'staff',
          ativo: true,
          access: 'staff',
          pessoa: null,
        };
        setUser(appUser);
        userRef.current = appUser;
        setIsAuthenticated(true);
        setAuthError(null);
        return;
      }

      if (pessoa && pessoa.ativo !== false) {
        const appUser = {
          id: session.user.id,
          email,
          full_name: pessoa.nome || session.user.user_metadata?.full_name || email,
          foto: pessoa.foto || session.user.user_metadata?.avatar_url || null,
          role: 'pessoa',
          ativo: true,
          access: 'pessoa',
          pessoa,
        };
        setUser(appUser);
        userRef.current = appUser;
        setIsAuthenticated(true);
        setAuthError(null);
        return;
      }

      const deniedUser = { id: session.user.id, email, full_name: email, foto: null, role: 'none', ativo: true, access: 'denied' };
      setUser(deniedUser);
      userRef.current = deniedUser;
      setIsAuthenticated(false);
      setAuthError({ type: 'access_denied', message: 'Acesso não autorizado. Contacte o administrador.' });
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
