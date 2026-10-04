import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { FignalMark } from "@/components/layout/top-nav";
import { Button } from "@/components/ui/button";

/**
 * Fignal landing page — /
 *
 * Deliberately thin for now: the product only ships the Platinum member area,
 * so the page states what Fignal is and hands over. The real landing page will
 * replace this copy without touching the subscribe hand-off to /platinum.
 */
export function Landing() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-14 w-full max-w-[1280px] items-center px-4 sm:px-6">
        <FignalMark />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="animate-enter w-full max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Trade the setup,
            <br />
            not the noise.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Structured market analysis with a stated entry, stop loss, targets
            and confidence grade — for Platinum members only.
          </p>

          <Button asChild size="lg" className="mt-8 rounded-full">
            <Link to="/platinum">
              Subscribe
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Trading involves significant risk. Signals are analytical information
            and are not a guarantee of future results.
          </p>
        </div>
      </div>
    </main>
  );
}
