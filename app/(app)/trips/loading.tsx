export default function TripsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-muted rounded-lg" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
        <div className="h-9 w-24 bg-muted rounded-lg" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[80, 60, 90, 80, 75].map((w, i) => (
          <div key={i} className={`h-7 bg-muted rounded-full`} style={{ width: w }} />
        ))}
      </div>

      {/* Search */}
      <div className="h-10 bg-muted rounded-lg" />

      {/* Month label */}
      <div className="h-3 w-28 bg-muted rounded" />

      {/* Cards */}
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-l-[3px] border-l-muted rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-3 w-48 bg-muted rounded" />
              </div>
              <div className="space-y-1 text-right">
                <div className="h-4 w-16 bg-muted rounded ml-auto" />
                <div className="h-3 w-12 bg-muted rounded ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
