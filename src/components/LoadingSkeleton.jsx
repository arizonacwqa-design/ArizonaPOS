export function SkeletonLine({ className = 'h-4 w-full' }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="card-luxury animate-pulse">
      <div className="h-4 w-24 skeleton-shimmer rounded mb-3" />
      <div className="h-8 w-32 skeleton-shimmer rounded" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="flex-1 h-10 skeleton-shimmer rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-8 animate-pulse">
      <div className="h-3 w-32 skeleton-shimmer rounded mb-2" />
      <div className="h-9 w-64 skeleton-shimmer rounded" />
    </div>
  );
}
