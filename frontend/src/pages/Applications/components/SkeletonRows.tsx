/** Loading-state silhouette that mirrors the real ApplicationRow geometry
 *  so the layout doesn't pop when data arrives. */
import { Skeleton } from "../../../components/Skeleton/Skeleton.tsx";

export default function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="app-rows space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="app-row flex items-stretch overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center gap-1.5 py-3 pl-3 pr-2 sm:pr-3">
            <Skeleton className="w-14 h-14 rounded-lg" />
          </div>
          <div className="app-row-body flex-1 min-w-0 py-3 pr-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
            <Skeleton className="h-3 w-1/4" />
            <div className="app-field-grid grid gap-x-4 gap-y-2 mt-1.5">
              {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-7 w-3/4 rounded-md" />)}
            </div>
          </div>
          <div className="app-row-side border-border">
            <div className="flex flex-col gap-2.5 px-3.5 py-3 border-border">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-4 w-1/2 mt-auto" />
            </div>
            <div className="flex flex-col gap-2 p-3 border-l border-border bg-muted/30">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
