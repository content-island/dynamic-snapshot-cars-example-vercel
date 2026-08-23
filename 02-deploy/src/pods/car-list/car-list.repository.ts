import { getCarListApi } from './api/car-list.api'
import { mapCarSummaryListFromApi } from './car-list.mapper'

import type { CarSummary } from './car-list.model'

// Single data-access entry point of the pod. From the outside it only speaks
// ViewModel: `CarSummaryApiModel` never crosses this boundary.
export const carListRepository = {
  getCarList: async (): Promise<Array<CarSummary>> =>
    mapCarSummaryListFromApi(await getCarListApi()),
}
