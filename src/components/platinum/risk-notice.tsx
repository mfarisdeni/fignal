import { Info } from "lucide-react";

/** Subtle, professional risk notice — no fear language, no promises. */
export function RiskNotice() {
  return (
    <footer className="animate-enter rounded-lg border border-border bg-card/60 px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        <Info
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">Risk notice.</span>{" "}
          Trading involves significant risk. Signals are analytical information
          and are not a guarantee of future results.
        </p>
      </div>
    </footer>
  );
}
