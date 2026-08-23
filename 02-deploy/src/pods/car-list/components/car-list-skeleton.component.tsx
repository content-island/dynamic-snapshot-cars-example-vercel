import { Card, CardContent, CardFooter } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'

const PLACEHOLDER_CARDS = 6

const CarCardSkeleton = () => (
  <Card className="feature-card gap-0 overflow-hidden rounded-sm pt-0">
    <Skeleton className="aspect-[16/10] w-full rounded-none" />

    <CardContent className="pt-5">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="mt-2 h-6 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/2" />

      <div className="mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
    </CardContent>

    <CardFooter className="mt-5">
      <Skeleton className="h-4 w-28" />
    </CardFooter>
  </Card>
)

export const CarListSkeleton = () => (
  <main className="page-wrap py-14" aria-busy="true" aria-label="Loading cars">
    <header className="mb-10 border-l-4 border-primary pl-5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-12 w-52 sm:h-14" />
      <Skeleton className="mt-4 h-4 w-64" />
    </header>

    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => (
        <CarCardSkeleton key={index} />
      ))}
    </div>
  </main>
)
