declare module "@shared-ui" {
  import * as React from "react";

  export const AppShell: React.FC<{ className?: string; children?: React.ReactNode }>;
  export const CloverSidebar: React.FC<{
    currentPath?: string;
    onNavigate?: (path: string) => void;
    onLogout?: () => void | Promise<void>;
    user?: { name?: string; email?: string };
    brand?: { name?: string; subtitle?: string };
  }>;
}
