export function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/80 backdrop-blur-2xl shadow-apple">
      <div className="glass-table-header px-5 py-4 border-b border-black/[0.05] flex items-center justify-between">
        <div className="h-5 w-48 rounded-xl bg-slate-200/70 animate-pulse" />
        <div className="h-4 w-24 rounded-lg bg-slate-200/60 animate-pulse" />
      </div>
      <div className="divide-y divide-black/[0.04] p-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-slate-200/70 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-4 w-36 rounded-lg bg-slate-200/80 animate-pulse" />
                <div className="h-3 w-20 rounded-md bg-slate-200/50 animate-pulse" />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="h-4 w-16 rounded-lg bg-slate-200/60 animate-pulse" />
              <div className="h-6 w-20 rounded-full bg-slate-200/70 animate-pulse" />
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
          className="rounded-3xl border border-white/80 bg-white/80 backdrop-blur-xl p-4 sm:p-5 shadow-apple space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 rounded-md bg-slate-200/70 animate-pulse" />
            <div className="h-7 w-7 rounded-xl bg-slate-200/60 animate-pulse" />
          </div>
          <div className="h-7 w-24 rounded-xl bg-slate-200/80 animate-pulse" />
          <div className="h-3 w-28 rounded-md bg-slate-200/50 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
