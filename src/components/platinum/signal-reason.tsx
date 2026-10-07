import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";

/**
 * Entry reason — the one-line rationale behind a setup, rendered as the muted
 * subheading directly under the pair name on every signal card.
 *
 * Follows the reader's language: Indonesian shows the desk's Groq translation,
 * English the analyst's original. A missing translation falls back to the
 * original rather than rendering nothing.
 */
export function SignalReason({
  reason,
  reasonId,
  className,
}: {
  reason?: string;
  reasonId?: string | null;
  className?: string;
}) {
  const { language } = useLanguage();
  const text = language === "id" ? (reasonId ?? reason) : reason;
  if (!text) return null;

  return (
    <p
      className={cn(
        "text-[13px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {text}
    </p>
  );
}
