import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardFooter } from '#/components/ui/card'

import type { CarSummary } from '../car-list.model'

interface Props {
  car: CarSummary
}

export const CarCard = ({ car }: Props) => (
  <Card className="feature-card gap-0 overflow-hidden rounded-sm pt-0">
    <Link
      to="/cars/$slug"
      params={{ slug: car.slug }}
      className="block aspect-[16/10] overflow-hidden bg-muted"
    >
      <img
        src={car.imageUrl}
        alt={car.imageAlt}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
      />
    </Link>

    <CardContent className="pt-5">
      <p className="spec-label">{car.year}</p>
      <h2 className="display-title mt-1 text-xl leading-tight">
        <Link to="/cars/$slug" params={{ slug: car.slug }}>
          {car.title}
        </Link>
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{car.version}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{car.fuelLabel}</Badge>
        <Badge variant="secondary">{car.transmissionLabel}</Badge>
        <Badge variant="outline">{car.displayPower}</Badge>
      </div>
    </CardContent>

    <CardFooter className="mt-5">
      <Link
        to="/cars/$slug"
        params={{ slug: car.slug }}
        className="nav-link text-sm font-semibold"
      >
        View details →
      </Link>
    </CardFooter>
  </Card>
)
