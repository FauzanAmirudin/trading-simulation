export default function AdminLoading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-2.5 sm:py-6 space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="h-20 rounded-2xl sm:rounded-3xl bg-muted/50 border border-border/40" />

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="h-24 rounded-2xl bg-muted/40 border border-border/40" />
        <div className="h-24 rounded-2xl bg-muted/40 border border-border/40" />
        <div className="h-24 rounded-2xl bg-muted/40 border border-border/40" />
        <div className="h-24 rounded-2xl bg-muted/40 border border-border/40" />
      </div>

      {/* Main content table skeleton */}
      <div className="h-96 rounded-2xl sm:rounded-3xl bg-muted/30 border border-border/40" />
    </div>
  );
}
