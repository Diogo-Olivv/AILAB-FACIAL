export function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-xs">
      <div className="bg-navy/80 p-4">
        <div className="h-5 w-48 rounded-md skeleton-shimmer" />
      </div>
      <div className="divide-y divide-line/60 p-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded skeleton-shimmer" />
                <div className="h-3 w-20 rounded skeleton-shimmer" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-4 w-16 rounded skeleton-shimmer" />
              <div className="h-6 w-20 rounded-full skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-line bg-card p-4 shadow-2xs space-y-2"
        >
          <div className="h-3.5 w-24 rounded skeleton-shimmer" />
          <div className="h-7 w-20 rounded-md skeleton-shimmer" />
          <div className="h-3 w-32 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
