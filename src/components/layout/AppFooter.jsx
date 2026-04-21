import React from 'react';

const PROJECT_NAME = 'Invenza EDU';

export default function AppFooter({ className = '' }) {
  return (
    <footer className={`w-full border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-3 text-center text-xs text-muted-foreground">
        2026 Pedro Santos | {PROJECT_NAME}
      </div>
    </footer>
  );
}

export { PROJECT_NAME };

