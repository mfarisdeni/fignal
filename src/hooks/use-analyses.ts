import { useCallback, useState } from "react";
import {
  loadAnalyses,
  removeAnalysis,
  setAnalysisStatus,
  submitAnalysis,
} from "@/data/prompt-store";
import type { AnalysisRecord, SignalStatus } from "@/types/signal";

/**
 * Read/write access to the prompt desk for /admin.
 *
 * Every mutation writes to the repository and then re-reads it, so the screen
 * always shows what was actually persisted — localStorage can refuse a write.
 */
export function useAnalyses() {
  const [records, setRecords] = useState<AnalysisRecord[]>(() => loadAnalyses());

  const submit = useCallback((raw: string) => {
    const record = submitAnalysis(raw);
    setRecords(loadAnalyses());
    return record;
  }, []);

  const setStatus = useCallback((id: string, status: SignalStatus) => {
    setAnalysisStatus(id, status);
    setRecords(loadAnalyses());
  }, []);

  const remove = useCallback((id: string) => {
    removeAnalysis(id);
    setRecords(loadAnalyses());
  }, []);

  return { records, submit, setStatus, remove };
}
