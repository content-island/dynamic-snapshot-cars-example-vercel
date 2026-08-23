import { CarCard } from './components/car-card.component'
import { CarListEmpty } from './components/car-list-empty.component'

import type { CarSummary } from './car-list.model'
import { CarListSkeleton } from './components/car-list-skeleton.component'
import { Await } from '@tanstack/react-router'

interface Props {
  cars: Promise<Array<CarSummary>>
}

export const CarListPod = ({ cars }: Props) => (
  <main className="page-wrap rise-in py-14">
    <header className="mb-10 border-l-4 border-primary pl-5">
      <p className="spec-label">Content Island</p>
      <h1 className="display-title mt-2 text-5xl sm:text-6xl">Cars</h1>
    </header>

    <Await promise={cars} fallback={<CarListSkeleton />}>
      {(list) => (
        <>
          <p className="mb-10 -mt-6 max-w-xl text-muted-foreground">
            {list.length} {list.length === 1 ? 'model' : 'models'} in the catalogue.
          </p>

          {list.length === 0 ? (
            <CarListEmpty />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          )}
        </>
      )}
    </Await>
  </main>
)
