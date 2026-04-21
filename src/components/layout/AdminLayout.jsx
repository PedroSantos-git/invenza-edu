import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';
import AppFooter from '@/components/layout/AppFooter';

export default function AdminLayout({ user }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={cn("flex-1 flex flex-col overflow-hidden bg-background")}>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8 pt-16 lg:pt-8">
            <Outlet />
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
