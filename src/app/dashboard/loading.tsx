export default function DashboardLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-4 animate-pulse">
      {/* Top banner / user card skeleton */}
      <div className="h-28 rounded-2xl sm:rounded-3xl bg-muted/50 border border-border/40" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-80 rounded-2xl bg-muted/40 border border-border/40" />
        <div className="h-80 rounded-2xl bg-muted/40 border border-border/40" />
      </div>
    </div>
  );
}
