import { createFileRoute } from '@tanstack/react-router'

import { CarListPod } from '#/pods/car-list/car-list.pod'
import { carListRepository } from '#/pods/car-list/car-list.repository'

export const Route = createFileRoute('/cars/')({
  loader: () => ({ cars: carListRepository.getCarList() }),
  component: CarListRoute,
})

function CarListRoute() {
  const { cars } = Route.useLoaderData()

  return <CarListPod cars={cars} />
}
