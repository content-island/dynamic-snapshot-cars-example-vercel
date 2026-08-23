// Backend contract as returned by Content Island (content type `Car`).
// Efficiency fields are mutually exclusive per technology, so the CMS returns
// `null` for the ones that do not apply to a given car.

export type FuelTypeApiModel =
  | 'gasoline'
  | 'diesel'
  | 'hybrid'
  | 'plug-in-hybrid'
  | 'electric'

export type TransmissionApiModel = 'manual' | 'automatic'

export interface MediaApiModel {
  name: string
  url: string
}

export interface CarImageApiModel {
  id: string
  url: MediaApiModel
  author: string
  license: string
  attributionUrl: string
}

export interface CarDetailApiModel {
  id: string
  slug: string
  brand: string
  model: string
  version: string
  description: string
  image: CarImageApiModel
  year: number
  fuelType: FuelTypeApiModel
  transmission: TransmissionApiModel
  powerHp: number
  topSpeedKmh: number
  consumptionL100Km: number | null
  electricConsumptionKwh100Km: number | null
  electricRangeKm: number | null
  batteryCapacityKwh: number | null
  seats: number
  doors: number
}
