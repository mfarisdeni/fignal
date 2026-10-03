import { cn } from "@/lib/utils";
import type { Confidence } from "@/types/signal";

const styles: Record<Confidence, string> = {
  "A+": "bg-conf-aplus/10 text-conf-aplus border-conf-aplus/30",
  A: "bg-conf-a/10 text-conf-a border-conf-a/30",
  "B+": "bg-conf-bplus/10 text-conf-bplus border-conf-bplus/30",
  B: "bg-conf-b/10 text-conf-b border-conf-b/30",
  C: "bg-conf-c/10 text-conf-c border-conf-c/25",
};

export function ConfidenceBadge({
  confidence,
  size = "md",
  className,
}: {
  confidence: Confidence;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-semibold tnum leading-none",
        styles[confidence],
        size === "sm" && "h-5 min-w-7 px-1.5 text-[11px]",
        size === "md" && "h-6 min-w-8 px-2 text-xs",
        size === "lg" && "h-7 min-w-10 px-2.5 text-sm",
        className,
      )}
      aria-label={`Confidence ${confidence}`}
    >
      {confidence}
    </span>
  );
}
