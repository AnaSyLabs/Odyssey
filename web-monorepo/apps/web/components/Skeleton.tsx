// Loading placeholders in the shape of the content they stand in for.

export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`motion-safe:animate-pulse rounded-lg bg-[var(--st-3)] ${className}`} />;
}

/** Wraps placeholders so screen readers hear one "Loading" instead of empty shapes. */
export function Loading({ label = "Loading", className = "", children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="glass flex flex-col gap-3 p-6" aria-hidden>
      <Bone className="h-5 w-20 rounded-full" />
      <Bone className="h-6 w-3/4" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-2/3" />
      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-[var(--st-line)] pt-3">
        {[0, 1, 2].map((j) => <Bone key={j} className="mx-auto h-8 w-14" />)}
      </div>
    </div>
  ));
}

export function RowsSkeleton({ rows = 3, className = "h-9" }: { rows?: number; className?: string }) {
  return <div className="space-y-2" aria-hidden>{Array.from({ length: rows }, (_, i) => <Bone key={i} className={`w-full ${className}`} />)}</div>;
}

/** A generic page: title, toolbar, a card grid and a side panel. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Bone className="h-7 w-48" />
      <Bone className="h-4 w-96 max-w-full" />
      <Bone className="h-14 w-full rounded-full" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-start gap-3 md:grid-cols-2"><CardsSkeleton count={4} /></div>
        <div className="glass space-y-3 p-6"><Bone className="h-5 w-1/2" /><RowsSkeleton rows={6} className="h-4" /></div>
      </div>
    </div>
  );
}
