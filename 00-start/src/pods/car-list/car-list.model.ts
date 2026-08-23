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

export interface CarSummary {
  id: string
  slug: string
  title: string
  version: string
  year: number
  fuelType: FuelType
  fuelLabel: string
  transmission: Transmission
  transmissionLabel: string
  displayPower: string
  imageUrl: string
  imageAlt: string
}
