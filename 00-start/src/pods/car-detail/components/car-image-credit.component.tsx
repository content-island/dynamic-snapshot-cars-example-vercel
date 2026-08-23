import type { CarImageCredit } from '../car-detail.model'

interface Props {
  image: CarImageCredit
}

export const CarImageCreditNote = ({ image }: Props) => (
  <p className="text-xs text-muted-foreground">
    Photo by {image.author} · {image.license} ·{' '}
    <a
      href={image.attributionUrl}
      target="_blank"
      rel="noreferrer noopener"
      className="nav-link"
    >
      Source
    </a>
  </p>
)
