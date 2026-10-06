import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AppProviders } from "@/components/providers/app-providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const description = "Fignal Platinum — curated trading signals for members.";

export const metadata: Metadata = {
  title: "Fignal — Platinum Signals",
  description,
  // The feed is member-only and renders per request; nothing here is a static
  // snapshot, so there is nothing for a crawler to index but the landing copy.
  robots: { index: false, follow: false },
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a8a86' stroke-width='2.2' stroke-linecap='round'%3E%3Cpath d='M4 17v3M9 11v9M14 7v13M19 3v17'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Dark is the default theme. The persisted choice is applied before first paint
 * so there is never a flash of the wrong theme — which means the class on <html>
 * belongs to this script alone, not to React, hence suppressHydrationWarning.
 */
const THEME_BOOT = `
(function () {
  try {
    var theme = localStorage.getItem("fignal-theme");
    document.documentElement.classList.toggle("dark", theme !== "light");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}