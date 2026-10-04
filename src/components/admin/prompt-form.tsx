import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Prompt console. The admin pastes the finished analysis and submits it; the
 * prompt itself is the source material, so nothing here edits the numbers —
 * extraction lives in `lib/analysis.ts` and gaps are reported back, not
 * filled in by hand.
 */
export function PromptForm({
  onSubmit,
}: {
  onSubmit: (raw: string) => void;
}) {
  const [raw, setRaw] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = raw.trim();
    if (!prompt) return;
    onSubmit(prompt);
    setRaw("");
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor="analysis-prompt">Analysis prompt</Label>
        <span className="font-mono-num tnum text-[11px] text-muted-foreground">
          {raw.trim().length > 0 ? `${raw.trim().length} chars` : "—"}
        </span>
      </div>

      <Textarea
        id="analysis-prompt"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        spellCheck={false}
        placeholder={
          "Paste the full market analysis here, e.g.\n\nXAUUSD — MARKET ANALYSIS\nH4 Bias:\nSHORT\nDecision: WAIT (NO CHASE)\nEntry:\n4215 - 4225\nSL:\n4235\nTP:\nTP1: 4150\nTP2: 4118\nConfidence\nGrade:\nB"
        }
        className="scroll-thin min-h-[340px] resize-y font-mono-num text-[12.5px] leading-relaxed"
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Extracted on submit: pair, decision, confidence, entry, stop loss, TP1
        and TP2. Fields the prompt does not state are reported as missing
        rather than guessed.
      </p>

      <Button type="submit" disabled={raw.trim().length === 0} className="rounded-full">
        <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        Extract &amp; publish
      </Button>
    </form>
  );
}
