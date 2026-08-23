export enum FuelType {
  Gasoline = 'gasoline',
  Diesel = 'diesel',
  Hybrid = 'hybrid',
  PlugInHybrid = 'plug-in-hybrid',
  Electric = 'electric',
}

export enum Transmission {
  Manual = 'manual',
  Automatic = 'automatic',
}

export interface CarImageCredit {
  url: string
  alt: string
  author: string
  license: string
  attributionUrl: string
}

export interface CarDetail {
  id: string
  slug: string
  title: string
  version: string
  description: string
  year: number
  fuelType: FuelType
  fuelLabel: string
  transmission: Transmission
  transmissionLabel: string
  displayPower: string
  displayTopSpeed: string
  seats: number
  doors: number
  image: CarImageCredit
  // Normalised to `undefined` (never `null`) so consumers only check presence.
  consumptionL100Km?: number
  electricConsumptionKwh100Km?: number
  electricRangeKm?: number
  batteryCapacityKwh?: number
}

export interface CarSpec {
  label: string
  value: string
}
