import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { AdminGate } from "@/components/admin/admin-gate";
import { AnalysisRecordCard } from "@/components/admin/analysis-record-card";
import { PromptForm } from "@/components/admin/prompt-form";
import { FignalMark } from "@/components/layout/top-nav";
import { NoTradeState } from "@/components/platinum/no-trade-state";
import { Button } from "@/components/ui/button";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useAnalyses } from "@/hooks/use-analyses";
import type { AnalysisRecord } from "@/types/signal";

/** What the parser managed to lift, in one line, right after a submit. */
function describe(record: AnalysisRecord): string {
  const found = [
    record.entryMin != null ? "entry" : null,
    record.sl != null ? "SL" : null,
    record.tp1 != null ? "TP1" : null,
    record.tp2 != null ? "TP2" : null,
    record.confidence != null ? `grade ${record.confidence}` : null,
  ].filter((part): part is string => part != null);

  return found.length
    ? `${record.pair} published with ${found.join(", ")}.`
    : `${record.pair} published, but no levels were found — check the prompt.`;
}

/**
 * Fignal admin desk — /admin
 *
 * Paste a finished market analysis, publish it, and the summary that comes out
 * (pair, call, confidence, entry, SL, TP) joins the member feed immediately.
 * Reached by URL only: nothing in the member navigation links here.
 */
export function AdminDashboard() {
  const { isUnlocked, lock } = useAdminAuth();
  const { records, submit, setStatus, remove } = useAnalyses();
  const [notice, setNotice] = useState<{ id: string; text: string } | null>(null);

  if (!isUnlocked) return <AdminGate />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <Link to="/platinum" aria-label="Fignal Platinum dashboard">
            <FignalMark />
          </Link>

          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Admin
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild className="rounded-full">
              <Link to="/platinum">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Member view
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={lock}
              aria-label="Lock the admin desk"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
          <section
            aria-label="Submit analysis prompt"
            className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5 lg:sticky lg:top-20"
          >
            <h1 className="text-sm font-semibold tracking-tight">Publish an analysis</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              The prompt is stored as-is and read for its summary numbers.
            </p>

            <div className="mt-4">
              <PromptForm
                onSubmit={(raw) => {
                  const record = submit(raw);
                  setNotice({ id: record.id, text: describe(record) });
                }}
              />
            </div>
          </section>

          <div className="space-y-4">
            {notice && (
              <p
                role="status"
                className="animate-enter rounded-md border border-border bg-card px-4 py-3 text-[13px] leading-relaxed text-muted-foreground shadow-card"
              >
                {notice.text}
              </p>
            )}

            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight">
                Published analyses
              </h2>
              <span className="text-xs text-muted-foreground tnum">
                {records.length} total
              </span>
            </div>

            {records.length === 0 ? (
              <NoTradeState
                note="Submit a prompt to publish its entry, stop loss, targets and confidence to the member feed."
              />
            ) : (
              records.map((record, index) => (
                <AnalysisRecordCard
                  key={record.id}
                  record={record}
                  index={index}
                  onStatusChange={setStatus}
                  onRemove={remove}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
