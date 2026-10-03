import { ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { FignalMark } from "@/components/layout/top-nav";

/**
 * Gated state for the protected /platinum route.
 * Placeholder auth: "Sign in" flips the local session flag until the real
 * provider is connected. No payment flow in the MVP.
 */
export function AuthGate() {
  const { signIn } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="animate-enter w-full max-w-sm text-center">
        <div className="flex justify-center">
          <FignalMark />
        </div>

        <div className="mx-auto mt-8 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-card">
          <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          Platinum Members Only
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sign in to access the latest Fignal signals.
        </p>

        <div className="mt-7 flex flex-col gap-2.5">
          <Button onClick={signIn} className="rounded-full">
            Sign In
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={signIn}
            aria-label="Join Platinum (checkout coming soon)"
          >
            Join Platinum
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Trading involves significant risk. Signals are analytical information
          and are not a guarantee of future results.
        </p>
      </div>
    </main>
  );
}
