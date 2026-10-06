import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/hooks/use-language";

/**
 * Prompt console. The admin pastes the finished analysis and submits it; the
 * prompt itself is the source material, so nothing here edits the numbers -
 * extraction lives in `lib/analysis.ts` and gaps are reported back, not
 * filled in by hand.
 */
export function PromptForm({
  onSubmit,
  busy = false,
}: {
  onSubmit: (raw: string) => void | Promise<void>;
  /** Publishing is a network write now, so the button has to reflect it. */
  busy?: boolean;
}) {
  const { t } = useLanguage();
  const [raw, setRaw] = useState("");
  // Same-tick double submits pass the `busy` prop before it re-renders, and a
  // second POST would publish the signal twice. The ref closes that window.
  const submitting = useRef(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = raw.trim();
    if (!prompt || busy || submitting.current) return;
    submitting.current = true;
    // Cleared after the write settles, so a refused publish leaves the prompt in
    // the box to fix and resubmit rather than losing the analyst's text.
    try {
      await onSubmit(prompt);
      setRaw("");
    } catch {
      setRaw(prompt);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor="analysis-prompt">{t("form.label")}</Label>
        <span className="font-mono-num tnum text-[11px] text-muted-foreground">
          {raw.trim().length > 0 ? t("form.chars", { n: raw.trim().length }) : "-"}
        </span>
      </div>

      <Textarea
        id="analysis-prompt"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        spellCheck={false}
        placeholder={
          "Paste the full market analysis here, e.g.\n\nXAUUSD - MARKET ANALYSIS\nH4 Bias:\nSHORT\nDecision: WAIT (NO CHASE)\nEntry:\n4215 - 4225\nSL:\n4235\nTP:\nTP1: 4150\nTP2: 4118\nConfidence\nGrade:\nB"
        }
        className="scroll-thin min-h-[340px] resize-y font-mono-num text-[12.5px] leading-relaxed"
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("form.help")}
      </p>

<Button
        type="submit"
        disabled={raw.trim().length === 0 || busy}
        className="rounded-full"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {busy ? "Publishing..." : t("form.submit")}
      </Button>
    </form>
  );
}
