import { useState } from "react";
import { Gem, LogOut, Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

export type DashboardView = "signals" | "history";

/** Wordmark: four ascending bars + Fignal. Geometric, no icon box. */
export function FignalMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
        shapeRendering="geometricPrecision"
      >
        <path d="M4 17v3" />
        <path d="M9 11v9" />
        <path d="M14 7v13" />
        <path d="M19 3v17" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">Fignal</span>
    </span>
  );
}

function ThemeToggle() {
  const { t } = useLanguage();

  // Dark is the default; index.html sets the class before first paint, so the
  // DOM is already authoritative on the first render.
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("fignal-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? t("theme.toLight") : t("theme.toDark")}
      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
    >
      {dark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function NavLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TopNav({
  view,
  onViewChange,
}: {
  view: DashboardView;
  onViewChange: (v: DashboardView) => void;
}) {
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (v: DashboardView) => {
    onViewChange(v);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
        <a href="#" aria-label={t("nav.home")} onClick={(e) => e.preventDefault()}>
          <FignalMark />
        </a>

        <span className="hidden items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold sm:inline-flex">
          <Gem className="h-3 w-3" aria-hidden="true" />
          Platinum
        </span>

        {/* Desktop nav */}
        <nav aria-label={t("nav.primary")} className="ml-6 hidden items-center gap-1 md:flex">
          <NavLink active={view === "signals"} onClick={() => onViewChange("signals")}>
            {t("nav.signals")}
          </NavLink>
          <NavLink active={view === "history"} onClick={() => onViewChange("history")}>
            {t("nav.history")}
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Beside the theme toggle: the two controls that change how the page
              looks sit together, and both stay reachable on every screen size. */}
          <LanguageToggle />
          <ThemeToggle />

          {/* Mobile menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground md:hidden"
                aria-label={t("nav.openMenu")}
              >
                <Menu className="h-4 w-4" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-card">
              <div className="mt-8 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => go("signals")}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    view === "signals"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("nav.signals")}
                </button>
                <button
                  type="button"
                  onClick={() => go("history")}
                  className={cn(
                    "rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    view === "history"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("nav.history")}
                </button>
                <div className="mt-3 border-t border-border pt-3">
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
                    <Gem className="h-3 w-3" aria-hidden="true" />
                    {t("nav.member")}
                  </span>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Account */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("nav.account")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background transition-transform duration-150 hover:scale-[1.04]"
              >
                FM
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-card">
              <DropdownMenuLabel className="font-normal">
                <div className="text-sm font-medium">{t("nav.member")}</div>
                <div className="text-xs text-muted-foreground">
                  member@fignal.id
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                {t("nav.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
