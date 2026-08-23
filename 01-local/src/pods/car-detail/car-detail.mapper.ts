import { FuelType, Transmission } from './car-detail.model'

import type {
  CarDetailApiModel,
  FuelTypeApiModel,
  TransmissionApiModel,
} from './api/car-detail.api-model'
import type { CarDetail } from './car-detail.model'

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

const mapFuelTypeFromApi = (fuelType: FuelTypeApiModel): FuelType => {
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

const mapTransmissionFromApi = (
  transmission: TransmissionApiModel,
): Transmission =>
  transmission === 'manual' ? Transmission.Manual : Transmission.Automatic

const mapOptionalNumberFromApi = (value: number | null): number | undefined =>
  value ?? undefined

export const mapCarDetailFromApi = (car: CarDetailApiModel): CarDetail => {
  const fuelType = mapFuelTypeFromApi(car.fuelType)
  const transmission = mapTransmissionFromApi(car.transmission)
  const title = `${car.brand} ${car.model}`

  return {
    id: car.id,
    slug: car.slug,
    title,
    version: car.version,
    description: car.description,
    year: car.year,
    fuelType,
    fuelLabel: FUEL_LABELS[fuelType],
    transmission,
    transmissionLabel: TRANSMISSION_LABELS[transmission],
    displayPower: `${car.powerHp} hp`,
    displayTopSpeed: `${car.topSpeedKmh} km/h`,
    seats: car.seats,
    doors: car.doors,
    image: {
      url: car.image.url.url,
      alt: `${title} (${car.year})`,
      author: car.image.author,
      license: car.image.license,
      attributionUrl: car.image.attributionUrl,
    },
    consumptionL100Km: mapOptionalNumberFromApi(car.consumptionL100Km),
    electricConsumptionKwh100Km: mapOptionalNumberFromApi(
      car.electricConsumptionKwh100Km,
    ),
    electricRangeKm: mapOptionalNumberFromApi(car.electricRangeKm),
    batteryCapacityKwh: mapOptionalNumberFromApi(car.batteryCapacityKwh),
  }
}
