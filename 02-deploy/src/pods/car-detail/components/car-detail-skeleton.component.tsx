import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'

const PLACEHOLDER_SPECS = 9

export const CarDetailSkeleton = () => (
  <main
    className="page-wrap py-14"
    aria-busy="true"
    aria-label="Loading car details"
  >
    <Skeleton className="h-4 w-36" />

    <div className="mt-6 space-y-8">
      <header className="panel overflow-hidden rounded-sm">
        <Skeleton className="aspect-[16/9] w-full rounded-none" />

        <div className="border-l-4 border-primary px-6 py-6 sm:px-8">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-3 h-9 w-2/3 sm:h-12" />
          <Skeleton className="mt-3 h-4 w-1/3" />

          <div className="mt-5 flex flex-wrap gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </header>

      <section>
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 max-w-2xl space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </section>

      <Separator />

      <section>
        <Skeleton className="h-6 w-40" />
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-3">
          {Array.from({ length: PLACEHOLDER_SPECS }, (_, index) => (
            <div key={index} className="feature-card px-5 py-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-6 w-24" />
            </div>
          ))}
        </dl>
      </section>

      <Skeleton className="h-3 w-56" />
    </div>
  </main>
)
