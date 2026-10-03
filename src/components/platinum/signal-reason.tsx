import { cn } from "@/lib/utils";

/**
 * Entry reason — the one-line rationale behind a setup, rendered as the muted
 * subheading directly under the pair name on every signal card.
 */
export function SignalReason({
  reason,
  className,
}: {
  reason?: string;
  className?: string;
}) {
  if (!reason) return null;

  return (
    <p
      className={cn(
        "text-[13px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {reason}
    </p>
  );
}