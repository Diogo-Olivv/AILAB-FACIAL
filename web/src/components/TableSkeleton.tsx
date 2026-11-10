export function TableSkeleton() {
  return (
    <div className="surface-card overflow-hidden" aria-busy="true" aria-label="Carregando integrantes">
      <div className="glass-table-header px-5 py-3 flex items-center justify-between">
        <div className="h-3 w-28 rounded-md skeleton-shimmer" />
        <div className="h-3 w-20 rounded-md skeleton-shimmer" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center justify-between px-5 py-3 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 min-w-[2.5rem] aspect-square shrink-0 rounded-full skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-36 rounded-md skeleton-shimmer" />
                <div className="h-2.5 w-20 rounded-md skeleton-shimmer" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:block h-3.5 w-16 rounded-md skeleton-shimmer" />
              <div className="h-5 w-20 rounded-full skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Carregando indicadores">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="surface-card p-4 sm:p-5 space-y-4 min-h-[124px]">
          <div className="flex items-center justify-between">
            <div className="h-2.5 w-20 rounded-md skeleton-shimmer" />
            <div className="h-8 w-8 rounded-lg skeleton-shimmer" />
          </div>
          <div className="h-7 w-24 rounded-md skeleton-shimmer" />
          <div className="h-2.5 w-28 rounded-md skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
