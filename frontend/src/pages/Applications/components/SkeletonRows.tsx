/** Loading-state silhouette that mirrors the real ApplicationRow geometry
 *  so the layout doesn't pop when data arrives. */
import { Skeleton } from "../../../components/Skeleton/Skeleton.tsx";

export default function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 py-3 pl-3 pr-2 sm:pr-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
          </div>
          <div className="flex-1 min-w-0 py-3 pr-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
            <Skeleton className="h-3 w-1/4" />
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-4 w-12 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          </div>
          <div className="w-[200px] shrink-0 flex flex-col gap-2 p-3 border-l border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-7 w-full rounded-md mt-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
