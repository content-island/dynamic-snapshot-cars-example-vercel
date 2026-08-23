import type { CarDetail, CarSpec } from './car-detail.model'

// Pure business logic over the ViewModel. Efficiency figures depend on the
// technology: a combustion car has no battery, a full electric has no fuel
// consumption, and a plug-in hybrid reports both. Only the specs the car
// actually has are shown.
export const buildSpecList = (car: CarDetail): Array<CarSpec> => {
  const specs: Array<CarSpec> = [
    { label: 'Year', value: String(car.year) },
    { label: 'Fuel', value: car.fuelLabel },
    { label: 'Transmission', value: car.transmissionLabel },
    { label: 'Power', value: car.displayPower },
    { label: 'Top speed', value: car.displayTopSpeed },
  ]

  if (car.consumptionL100Km !== undefined) {
    specs.push({
      label: 'Fuel consumption',
      value: `${car.consumptionL100Km} L/100 km`,
    })
  }

  if (car.electricConsumptionKwh100Km !== undefined) {
    specs.push({
      label: 'Electric consumption',
      value: `${car.electricConsumptionKwh100Km} kWh/100 km`,
    })
  }

  if (car.electricRangeKm !== undefined) {
    specs.push({
      label: 'Electric range',
      value: `${car.electricRangeKm} km`,
    })
  }

  if (car.batteryCapacityKwh !== undefined) {
    specs.push({
      label: 'Battery capacity',
      value: `${car.batteryCapacityKwh} kWh`,
    })
  }

  specs.push(
    { label: 'Seats', value: String(car.seats) },
    { label: 'Doors', value: String(car.doors) },
  )

  return specs
}
