// Backend contract as returned by Content Island (content type `Car`).
// Field names, enum codes and nullability mirror the CMS, not the UI.

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

export interface CarSummaryApiModel {
  id: string
  slug: string
  brand: string
  model: string
  version: string
  image: CarImageApiModel
  year: number
  fuelType: FuelTypeApiModel
  transmission: TransmissionApiModel
  powerHp: number
}
