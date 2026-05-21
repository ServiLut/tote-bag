export default function CatalogLoading() {
  return (
    <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <div className="hidden lg:block rounded-3xl border border-theme bg-surface p-6">
          <div className="space-y-4">
            <div className="h-4 w-24 animate-pulse rounded bg-theme/20" />
            <div className="h-4 w-full animate-pulse rounded bg-theme/20" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-theme/20" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-theme/20" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-4 w-48 animate-pulse rounded bg-theme/20" />
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-3xl border border-theme bg-surface"
              >
                <div className="aspect-[3/4] animate-pulse bg-theme/20" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-theme/20" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-theme/20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
