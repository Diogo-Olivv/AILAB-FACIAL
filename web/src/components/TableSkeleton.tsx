export function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl shadow-[0_4px_24px_rgba(23,23,21,0.03)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
      <div className="glass-table-header px-5 py-4 border-b border-[#E5E2DC] dark:border-slate-800 flex items-center justify-between">
        <div className="h-5 w-48 rounded-xl bg-[#E5E2DC]/60 dark:bg-slate-800/80 animate-pulse" />
        <div className="h-4 w-24 rounded-lg bg-[#E5E2DC]/50 dark:bg-slate-800/60 animate-pulse" />
      </div>
      <div className="divide-y divide-[#E5E2DC]/60 dark:divide-slate-800/60 p-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-[#E5E2DC]/60 dark:bg-slate-800/80 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 rounded-lg bg-[#E5E2DC]/70 dark:bg-slate-800/90 animate-pulse" />
                <div className="h-3 w-20 rounded-md bg-[#E5E2DC]/40 dark:bg-slate-800/50 animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-4 w-16 rounded-lg bg-[#E5E2DC]/50 dark:bg-slate-800/60 animate-pulse" />
              <div className="h-6 w-20 rounded-full bg-[#E5E2DC]/60 dark:bg-slate-800/80 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-3xl border border-[#E5E2DC] dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl p-4 sm:p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 rounded-md bg-[#E5E2DC]/60 dark:bg-slate-800/80 animate-pulse" />
            <div className="h-7 w-7 rounded-xl bg-[#E5E2DC]/50 dark:bg-slate-800/60 animate-pulse" />
          </div>
          <div className="h-7 w-24 rounded-xl bg-[#E5E2DC]/70 dark:bg-slate-800/90 animate-pulse" />
          <div className="h-3 w-28 rounded-md bg-[#E5E2DC]/40 dark:bg-slate-800/50 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
