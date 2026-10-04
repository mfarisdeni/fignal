"use client";

import type { ReactNode } from "react";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import { AuthProvider } from "@/hooks/use-auth";
import { LanguageProvider } from "@/components/providers/language-provider";

/**
 * The provider stack, mounted once by the root layout.
 *
 * Order matters and is unchanged from the Vite build: the admin passcode session
 * is separate from the member session, and the language provider sits outermost
 * so every screen below the gates is bilingual.
 *
 * A client boundary because all three hold React context. Routing lives in the
 * app directory instead of a <Routes> tree, so nothing here needs a router.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <LanguageProvider>{children}</LanguageProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}