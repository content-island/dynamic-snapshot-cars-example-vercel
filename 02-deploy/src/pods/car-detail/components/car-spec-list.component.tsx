import type { CarSpec } from '../car-detail.model'

interface Props {
  specs: Array<CarSpec>
}

export const CarSpecList = ({ specs }: Props) => (
  <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border bg-border sm:grid-cols-3">
    {specs.map((spec) => (
      <div key={spec.label} className="feature-card px-5 py-4">
        <dt className="spec-label">{spec.label}</dt>
        <dd className="mt-1 text-lg font-semibold">{spec.value}</dd>
      </div>
    ))}
  </dl>
)
