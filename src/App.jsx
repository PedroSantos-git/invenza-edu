import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import AppFooter, { PROJECT_NAME } from '@/components/layout/AppFooter';

// Pages
import Dashboard from '@/pages/Dashboard';
import Equipamentos from '@/pages/Equipamentos';
import Pessoas from '@/pages/Pessoas';
import Emprestimos from '@/pages/Emprestimos';
import Devolucoes from '@/pages/Devolucoes';
import Avarias from '@/pages/Avarias';
import Pedidos from '@/pages/Pedidos';
import Utilizadores from '@/pages/Utilizadores';
import PortalPessoa from '@/pages/PortalPessoa';
import AcessoNegado from '@/pages/AcessoNegado';
import Configuracoes from '@/pages/Configuracoes';
import AdminLayout from '@/components/layout/AdminLayout';

const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

const AppContent = () => {
  const { isLoadingAuth, authError, navigateToLogin, user, isAuthenticated } = useAuth();

  // Show full screen loading only if we don't have a user yet and we're loading
  // This avoids blocking the UI when switching back to the window (routine session checks)
  if (isLoadingAuth && !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted-foreground">A carregar...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 space-y-4">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">{PROJECT_NAME}</h1>
              <p className="text-sm text-muted-foreground">
                {authError?.type === 'config_missing'
                  ? 'Falta configurar o Supabase para esta aplicação.'
                  : 'Inicie sessão com Google para continuar.'}
              </p>
            </div>
            {authError?.type === 'config_missing' && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-foreground space-y-2">
                <div className="font-medium">Variáveis de ambiente necessárias</div>
                <div className="font-mono text-xs">
                  <div>VITE_SUPABASE_URL</div>
                  <div>VITE_SUPABASE_ANON_KEY</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Em desenvolvimento, cria um ficheiro <span className="font-mono">.env.local</span> na raiz do projeto. Em Netlify,
                  define estas variáveis em Site settings → Environment variables.
                </div>
              </div>
            )}
            {authError?.type === 'access_denied' && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {authError.message}
              </div>
            )}
            {authError?.type !== 'config_missing' && (
              <Button className="w-full" onClick={navigateToLogin}>
                Entrar com Google
              </Button>
            )}
          </div>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (!user) return null;

  // Check user access
  const isProtectedAdmin = user.email === PROTECTED_EMAIL;
  const isAdmin = isProtectedAdmin || user.role === 'admin';
  const isStaff = isAdmin || user.role === 'staff';

  if (user.access === 'denied') {
    return <AcessoNegado />;
  }

  if (!isStaff && user.access === 'pessoa' && user.pessoa) {
    return <PortalPessoa user={user} pessoa={user.pessoa} />;
  }

  // Staff/Admin → full admin layout
  return (
    <Routes>
      <Route element={<AdminLayout user={user} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/equipamentos" element={<Equipamentos />} />
        <Route path="/pessoas" element={<Pessoas />} />
        <Route path="/emprestimos" element={<Emprestimos />} />
        <Route path="/devolucoes" element={<Devolucoes />} />
          <Route path="/avarias" element={<Avarias />} />
          <Route path="/pedidos" element={<Pedidos />} />
          {isAdmin && <Route path="/utilizadores" element={<Utilizadores />} />}
          {isAdmin && <Route path="/configuracoes" element={<Configuracoes />} />}
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
