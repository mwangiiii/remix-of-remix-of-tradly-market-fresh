// Shimmer skeletons used across the storefront while queries settle.
//
// These are visual placeholders — same footprint as the eventual content
// so the layout doesn't jump when data arrives. Uses tailwind's built-in
// `animate-pulse` for the shimmer; no custom keyframes needed.
//
// Rule of thumb: never show a bare spinner if you can show a skeleton
// that mirrors the shape of what's loading. That's the Apple-quality
// difference — the page feels like it's *rendering*, not *fetching*.

export function ProductCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square rounded-2xl bg-surface soft-shadow" />
      <div className="mt-2.5 space-y-1.5">
        <div className="h-4 w-3/4 rounded bg-surface" />
        <div className="h-3 w-1/2 rounded bg-surface" />
        <div className="h-5 w-1/3 rounded bg-surface" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CategoryPillSkeleton() {
  return (
    <div className="hide-scrollbar -mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2 pb-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="h-8 w-24 shrink-0 animate-pulse rounded-full bg-surface"
          />
        ))}
      </ul>
    </div>
  );
}

export function OrderRowSkeleton() {
  return (
    <li className="flex items-center gap-3 py-4">
      <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-surface" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-4 w-2/5 animate-pulse rounded bg-surface" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface" />
      </div>
      <div className="h-6 w-16 animate-pulse rounded-full bg-surface" />
    </li>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="animate-pulse px-4 pb-16 lg:px-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:pt-8">
        <div className="-mx-4 aspect-square bg-surface lg:mx-0 lg:rounded-3xl" />
        <div className="mt-6 space-y-4 lg:mt-0">
          <div className="h-9 w-3/4 rounded bg-surface" />
          <div className="h-4 w-1/3 rounded bg-surface" />
          <div className="h-10 w-1/4 rounded bg-surface" />
          <div className="space-y-2 pt-2">
            <div className="h-3 w-full rounded bg-surface" />
            <div className="h-3 w-5/6 rounded bg-surface" />
            <div className="h-3 w-4/6 rounded bg-surface" />
          </div>
          <div className="flex gap-2 pt-4">
            <div className="h-9 w-24 rounded-full bg-surface" />
            <div className="h-9 w-24 rounded-full bg-surface" />
          </div>
        </div>
      </div>
    </div>
  );
}
