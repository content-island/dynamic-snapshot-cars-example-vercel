import { getCarBySlugApi } from './api/car-detail.api'
import { mapCarDetailFromApi } from './car-detail.mapper'

import type { CarDetail } from './car-detail.model'

// Single data-access entry point of the pod. Returns `null` (a frontend-facing
// value) when the car does not exist, instead of leaking transport details.
export const carDetailRepository = {
  getCarBySlug: async (slug: string): Promise<CarDetail | null> => {
    const apiCar = await getCarBySlugApi({ data: slug })

    return apiCar ? mapCarDetailFromApi(apiCar) : null
  },
}
