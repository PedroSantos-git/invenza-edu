import React from 'react';
import { APP_VERSION, COPYRIGHT } from '@/utils/version';

export default function AppFooter({ className = '' }) {
  return (
    <footer className={`w-full border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-3 text-center text-[10px] text-muted-foreground">
        {COPYRIGHT} | v{APP_VERSION}
      </div>
    </footer>
  );
}

