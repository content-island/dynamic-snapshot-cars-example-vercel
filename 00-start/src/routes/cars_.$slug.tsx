import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { CarDetailPod } from '#/pods/car-detail/car-detail.pod'
import { carDetailRepository } from '#/pods/car-detail/car-detail.repository'
import { CarDetailSkeleton } from '#/pods/car-detail/components/car-detail-skeleton.component'

export const Route = createFileRoute('/cars_/$slug')({
  loader: async ({ params }) => {
    const car = await carDetailRepository.getCarBySlug(params.slug)

    if (!car) {
      throw notFound()
    }

    return car
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? loaderData.title : 'Car' }],
  }),
  pendingComponent: CarDetailSkeleton,
  notFoundComponent: CarNotFound,
  component: CarDetailRoute,
})

function CarDetailRoute() {
  const car = Route.useLoaderData()

  return <CarDetailPod car={car} />
}

function CarNotFound() {
  return (
    <main className="page-wrap py-14">
      <h1 className="display-title text-3xl font-bold">Car not found</h1>
      <p className="mt-3 text-muted-foreground">
        We could not find that car in the catalogue.
      </p>
      <Link to="/cars" className="nav-link mt-6 inline-block font-semibold">
        ← Back to all cars
      </Link>
    </main>
  )
}
