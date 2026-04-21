import React from 'react';
import { ShieldX, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import AppFooter from '@/components/layout/AppFooter';

export default function AcessoNegado() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Acesso Não Autorizado</h1>
          <p className="text-sm text-muted-foreground">
            O seu email não está registado no sistema. Se acha que deveria ter acesso, deverá falar com a escola.
          </p>
          <Button variant="outline" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
