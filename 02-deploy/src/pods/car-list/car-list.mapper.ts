import { FuelType, Transmission } from './car-list.model'

import type {
  CarSummaryApiModel,
  FuelTypeApiModel,
  TransmissionApiModel,
} from './api/car-list.api-model'
import type { CarSummary } from './car-list.model'

const FUEL_LABELS: Record<FuelType, string> = {
  [FuelType.Gasoline]: 'Gasoline',
  [FuelType.Diesel]: 'Diesel',
  [FuelType.Hybrid]: 'Hybrid',
  [FuelType.PlugInHybrid]: 'Plug-in hybrid',
  [FuelType.Electric]: 'Electric',
}

const TRANSMISSION_LABELS: Record<Transmission, string> = {
  [Transmission.Manual]: 'Manual',
  [Transmission.Automatic]: 'Automatic',
}

export const mapFuelTypeFromApi = (fuelType: FuelTypeApiModel): FuelType => {
  switch (fuelType) {
    case 'gasoline':
      return FuelType.Gasoline
    case 'diesel':
      return FuelType.Diesel
    case 'hybrid':
      return FuelType.Hybrid
    case 'plug-in-hybrid':
      return FuelType.PlugInHybrid
    case 'electric':
      return FuelType.Electric
  }
}

export const mapTransmissionFromApi = (
  transmission: TransmissionApiModel,
): Transmission =>
  transmission === 'manual' ? Transmission.Manual : Transmission.Automatic

export const getFuelLabel = (fuelType: FuelType): string =>
  FUEL_LABELS[fuelType]

export const getTransmissionLabel = (transmission: Transmission): string =>
  TRANSMISSION_LABELS[transmission]

export const mapCarSummaryFromApi = (car: CarSummaryApiModel): CarSummary => {
  const fuelType = mapFuelTypeFromApi(car.fuelType)
  const transmission = mapTransmissionFromApi(car.transmission)
  const title = `${car.brand} ${car.model}`

  return {
    id: car.id,
    slug: car.slug,
    title,
    version: car.version,
    year: car.year,
    fuelType,
    fuelLabel: getFuelLabel(fuelType),
    transmission,
    transmissionLabel: getTransmissionLabel(transmission),
    displayPower: `${car.powerHp} hp`,
    imageUrl: car.image.url.url,
    imageAlt: `${title} (${car.year})`,
  }
}

export const mapCarSummaryListFromApi = (
  cars: Array<CarSummaryApiModel>,
): Array<CarSummary> => cars.map(mapCarSummaryFromApi)
