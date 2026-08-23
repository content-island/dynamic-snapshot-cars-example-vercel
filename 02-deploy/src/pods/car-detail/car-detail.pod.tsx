import { Link } from '@tanstack/react-router'

import { Separator } from '#/components/ui/separator'

import { buildSpecList } from './car-detail.business'
import { CarHero } from './components/car-hero.component'
import { CarImageCreditNote } from './components/car-image-credit.component'
import { CarSpecList } from './components/car-spec-list.component'

import type { CarDetail } from './car-detail.model'
import { Markdown } from '#/components/ui/markdown'

interface Props {
  car: CarDetail
}

export const CarDetailPod = ({ car }: Props) => (
  <main className="page-wrap rise-in py-14">
    <Link to="/cars" className="nav-link text-sm font-semibold">
      ← Back to all cars
    </Link>

    <div className="mt-6 space-y-8">
      <CarHero car={car} />

      <section>
        <h2 className="display-title text-xl">Overview</h2>
        <Markdown
          content={car.description}
          className="prose prose-invert mt-3 max-w-2xl leading-relaxed text-muted-foreground"
        />
      </section>

      <Separator />

      <section>
        <h2 className="display-title mb-4 text-xl font-semibold">
          Specifications
        </h2>
        <CarSpecList specs={buildSpecList(car)} />  
      </section>

      <CarImageCreditNote image={car.image} />
    </div>
  </main>
)
