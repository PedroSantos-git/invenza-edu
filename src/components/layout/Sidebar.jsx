import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Monitor, Users, UserCog, ArrowRightLeft,
  CornerDownLeft, AlertTriangle, Menu, X, LogOut, ChevronLeft, Settings, ClipboardList, FileSpreadsheet, BookOpen, Warehouse, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { PROJECT_NAME } from '@/components/layout/AppFooter';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/equipamentos', label: 'Equipamentos', icon: Monitor },
  { path: '/armazem', label: 'Armazém', icon: Warehouse },
  { path: '/pessoas', label: 'Pessoas', icon: Users },
  { path: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { path: '/listas', label: 'Listas', icon: FileSpreadsheet },
  { path: '/emprestimos', label: 'Empréstimos', icon: ArrowRightLeft },
  { path: '/devolucoes', label: 'Devoluções', icon: CornerDownLeft },
  { path: '/notificacoes-devolucao', label: 'Notificações', icon: Mail },
  { path: '/avarias', label: 'Avarias', icon: AlertTriangle },
];

const adminItems = [
  { path: '/utilizadores', label: 'Utilizadores', icon: UserCog },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Sidebar({ user, collapsed, setCollapsed, onOpenManual }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email === 'pedro.mf.santos@outlook.pt';
  const isStaff = isAdmin || user?.role === 'staff';

  const items = isStaff ? [...navItems, ...(isAdmin ? adminItems : [])] : [];

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
          <Monitor className="w-5 h-5 text-sidebar-primary" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-sidebar-foreground truncate">{PROJECT_NAME}</h1>
            <p className="text-[10px] text-sidebar-foreground/60 truncate">Inventário Escolar Inteligente</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className={cn("flex items-center gap-3 px-3 py-2", collapsed && "justify-center")}>
          {user?.foto ? (
            <img src={user.foto} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-sidebar-primary">
              {user?.full_name?.[0] || '?'}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.full_name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.role}</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-1 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenManual}
            className={cn("w-full justify-start text-sidebar-foreground/60 hover:text-primary hover:bg-primary/5", collapsed && "justify-center px-2")}
          >
            <BookOpen className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="ml-2">Ajuda</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className={cn("w-full justify-start text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/5", collapsed && "justify-center px-2")}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card shadow-md border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-40 w-64 bg-sidebar transform transition-transform",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <NavContent />
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0",
        collapsed ? "w-[68px]" : "w-60"
      )}>
        <NavContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-5 -right-3 w-6 h-6 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
        >
          <ChevronLeft className={cn("w-3 h-3 transition-transform", collapsed && "rotate-180")} />
        </button>no email 
      </div>
    </>
  );
}
