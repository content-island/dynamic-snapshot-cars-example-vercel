import { Badge } from '#/components/ui/badge'

import type { CarDetail } from '../car-detail.model'

interface Props {
  car: CarDetail
}

export const CarHero = ({ car }: Props) => (
  <header className="panel overflow-hidden rounded-sm">
    <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
      <img
        src={car.image.url}
        alt={car.image.alt}
        className="h-full w-full object-cover"
      />
    </div>

    <div className="border-l-4 border-primary px-6 py-6 sm:px-8">
      <p className="spec-label">{car.year}</p>
      <h1 className="display-title mt-2 text-3xl sm:text-5xl">{car.title}</h1>
      <p className="mt-2 text-muted-foreground">{car.version}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Badge variant="secondary">{car.fuelLabel}</Badge>
        <Badge variant="secondary">{car.transmissionLabel}</Badge>
        <Badge variant="outline">{car.displayPower}</Badge>
        <Badge variant="outline">{car.displayTopSpeed}</Badge>
      </div>
    </div>
  </header>
)
