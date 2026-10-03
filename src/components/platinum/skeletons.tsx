import { Skeleton } from "@/components/ui/skeleton";

/** Polished loading states — structured skeletons, never spinner-only. */

function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-5 shadow-card"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-6 w-9 rounded-md" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="ml-auto h-6 w-20 rounded-full" />
      </div>
      {featured && <Skeleton className="mt-5 h-[68px] w-full rounded-md" />}
      <Skeleton className="mt-3 h-3 w-full max-w-[52ch]" />
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-3 w-28" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading signals" className="space-y-6">
      {/* Summary skeleton */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-card px-3.5 py-3 shadow-card"
          >
            <Skeleton className="h-6 w-8" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="space-y-3 sm:space-y-4">
        <SkeletonCard featured />
        {/* Mirrors the feed: one card per row on mobile, two on desktop. */}
        <div className="grid grid-cols-1 items-start gap-3 sm:gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>

      {/* History skeleton */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
          >
            <Skeleton className="h-5 w-8 rounded-md" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12 rounded-md" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
