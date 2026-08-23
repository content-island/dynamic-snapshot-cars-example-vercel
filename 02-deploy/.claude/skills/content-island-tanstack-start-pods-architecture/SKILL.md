---
name: content-island-tanstack-start-pods-architecture
description: Use this skill to define a clear architecture for TanStack Start projects using a PODS (feature/islands) approach, ensuring consistent organization of UI, API models, business logic, repositories, and complete mapping between backend-facing API models and frontend-facing ViewModels.
---

You are working in a **TanStack Start** codebase that follows a **PODS (feature/islands) architecture**.

Your goal is to implement features by placing **UI, API models, API clients, business logic, ViewModels, repositories, and mapping logic inside PODS**, while keeping **routes thin** and mostly focused on **server/client orchestration**.

---

## 1) Project Structure

### TanStack Start conventions

- **Routes** live in: `src/routes/`
- **Root route (app shell / global layout)**: `src/routes/__root.tsx`
- **Router setup / configuration**: `src/router.tsx`
- **Generated route tree (do not edit)**: `src/routeTree.gen.ts`
- **Server functions / loaders / actions**: colocated in routes or extracted per pod

Routes should contain minimal logic:

- Server-side data fetching through pod repositories
- Params handling (`params`, `search`)
- Composition of pods
- Server/client orchestration

Everything else belongs in PODS:

- Components
- API implementation
- API models
- ViewModels
- Repositories
- Mapping
- Business logic

### PODS root

All PODS live in:

```text
src/pods/
```

There is **no required 1:1 mapping** between routes and PODS:

- One POD can serve multiple routes
- One route can compose multiple PODS
- Layouts can also compose PODS

---

## 2) POD Naming and File Conventions

Each pod follows this structure:

```text
src/pods/{pod-name}/
├── {pod-name}.pod.tsx
├── {pod-name}.model.ts
├── {pod-name}.mapper.ts
├── {pod-name}.repository.ts
├── {pod-name}.business.ts
├── components/
│   └── {component-name}.component.tsx
└── api/
    ├── {api-model-name}.api-model.ts
    └── {api-name}.api.ts
```

Not every pod needs every file. Create only the files required by the feature.

### Component file naming

Every React component file that is not a pod entry point or a TanStack route file must use the `.component.tsx` suffix.

Correct:

```text
car-card.component.tsx
car-list.component.tsx
price-filter.component.tsx
empty-state.component.tsx
```

Incorrect:

```text
car-card.tsx
car-list.tsx
price-filter.tsx
empty-state.tsx
```

Pod entry points keep the `.pod.tsx` suffix:

```text
car-list.pod.tsx
car-detail.pod.tsx
```

TanStack route files keep the filenames required by TanStack Router conventions and do not use the `.component.tsx` suffix.

### Components inside a pod

Subcomponents that belong exclusively to a pod must live inside that pod's `components` directory:

```text
src/pods/car-list/components/car-card.component.tsx
src/pods/car-list/components/car-filters.component.tsx
src/pods/car-list/components/empty-state.component.tsx
```

Do not place pod-specific subcomponents:

- Directly in the pod root
- Inside the route directory
- Inside `src/common/`
- Inside another pod

The pod entry point itself remains at the root of the pod:

```text
src/pods/car-list/car-list.pod.tsx
```

Only components that are genuinely shared by multiple pods should be extracted into an appropriate location under `src/common/`. Shared React component files must also use the `.component.tsx` suffix.

### About the repository

The `repository` is optional. Create it only in pods that load or persist data through an API or another external data source. Pure UI pods do not need a repository.

When a pod has an API, the repository is mandatory.

The repository is the architectural boundary between:

- Backend-facing API models
- Frontend-facing ViewModels

It is not merely a thin wrapper around API calls.

The repository must:

- Be the pod's single public data-access entry point
- Call the API
- Pass API responses through the appropriate mapper
- Return only the pod's ViewModel or another explicitly frontend-facing pod model
- Accept ViewModels or frontend-facing input types when persisting data
- Convert frontend-facing values into API request models when necessary
- Hide API clients, API models, transport details, and mappers from consumers

From the outside, the repository only speaks in ViewModels or other explicitly frontend-facing pod models.

API models must never escape the repository boundary.

---

## 3) Import Rules

### Imports inside the same pod

When a file imports another file that belongs to the same pod, it must use a relative import.

Correct:

```ts
// car-list.pod.tsx
import { CarCard } from "./components/car-card.component";
import { carRepository } from "./car-list.repository";
import type { Car } from "./car-list.model";
```

```ts
// components/car-card.component.tsx
import type { Car } from "../car-list.model";
import { calculateDiscount } from "../car-list.business";
```

Incorrect:

```ts
import { CarCard } from "#/pods/car-list/components/car-card.component";
import { carRepository } from "#/pods/car-list/car-list.repository";
import type { Car } from "#/pods/car-list/car-list.model";
```

Import aliases must not be used to navigate within the same pod.

This rule applies to imports between all files belonging to the pod, including:

- `pod.tsx`
- Components
- Models
- API files
- Mappers
- Repositories
- Business files
- Tests

Use:

- `./` for files in the same directory
- `../` for files in a parent directory
- Relative nested paths for files elsewhere inside the same pod

### Imports outside the pod

Aliases may be used for imports that cross a valid architectural boundary, such as:

- From a route to a pod
- From a pod to `src/common/`
- From application code to shared infrastructure

For example:

```ts
import { CarListPod } from "#/pods/car-list/car-list.pod";
import { formatCurrency } from "#/common/formatters/currency";
```

An alias does not make a cross-pod import valid.

Cross-pod imports remain forbidden by default, even when an alias could resolve them. If a pod needs something from another pod, stop and ask the user before creating the import.

> **Import rule:** inside a pod, stay relative. Outside a pod, use the configured alias only when crossing a valid architectural boundary.

---

## 4) Mandatory Data Flow

### Read operations

The required flow for read operations is:

```text
Route loader / server function
              ↓
         Repository
              ↓
             API
              ↓
          API model
              ↓
            Mapper
              ↓
          ViewModel
              ↓
Route loader / server function / pod
```

For example:

```ts
export const Route = createFileRoute("/cars")({
  loader: () => carRepository.getCars(),
  component: CarsPage,
});
```

The loader calls the repository and receives ViewModels ready for frontend consumption.

Do not call the API and mapper separately from a loader:

```ts
// Incorrect
loader: async () => {
  const apiCars = await carApi.getCars();

  return apiCars.map(mapCarFromApi);
};
```

The loader must normally contain only the orchestration needed to call the repository:

```ts
// Correct
loader: () => carRepository.getCars();
```

### Write operations

The required flow for write operations is:

```text
Frontend-facing model / input
              ↓
         Repository
              ↓
            Mapper
              ↓
       API request model
              ↓
             API
              ↓
       API response model
              ↓
            Mapper
              ↓
          ViewModel
```

The repository must perform both mapping directions whenever required.

---

## 5) Architectural Rules

- Pods are isolated
- Avoid cross-pod imports by default
- If there is a strong justification for a cross-pod import, do not create it silently
- Stop and ask the user first, explaining why it is needed
- Otherwise, extract the shared piece into `src/common/`
- Shared logic belongs in `src/common/`
- Routes must stay thin
- Data access must always go through the pod repository
- Loaders should normally only call repositories
- Components, loaders, server functions, hooks, and `pod.tsx` files must not import API clients
- Components, loaders, server functions, hooks, and `pod.tsx` files must not import API models
- Components, loaders, server functions, hooks, and `pod.tsx` files must not call mappers
- API models must remain inside the API, mapper, and repository layers
- Only the repository exposes data-access operations to the rest of the application
- Repository methods must expose frontend-facing types, never API-facing types
- Every regular React component file must use the `.component.tsx` suffix
- Pod entry points must use the `.pod.tsx` suffix
- TanStack route files keep their framework-defined filenames
- Pod-specific subcomponents must live in the pod's `components/` directory
- Files inside the same pod must import each other using relative paths
- Do not use import aliases for imports whose source and target belong to the same pod
- Import aliases may be used when crossing valid architectural boundaries, such as route → pod or pod → common
- An import alias must never be used to bypass the cross-pod import restriction

Treat any API model imported by a route, loader, component, hook, business file, or `pod.tsx` file as an architectural violation.

Treat any mapper invocation outside the repository as an architectural violation.

---

## 6) Responsibilities

### Routes

Routes are responsible for:

- Composing pods
- Handling route params and search params
- Calling pod repositories from loaders or server functions
- Passing repository results to pods
- Server/client orchestration

Routes must not:

- Call API clients directly
- Import API models
- Invoke mappers
- Transform API responses into ViewModels
- Contain pod business logic

### Pods

Pods contain the complete isolated feature:

- UI
- ViewModels
- API clients
- API models
- Repositories
- Mappers
- Business logic

The pod entry point must be named:

```text
{pod-name}.pod.tsx
```

Subcomponents owned by the pod must be placed in:

```text
src/pods/{pod-name}/components/
```

Every subcomponent file must use this naming convention:

```text
{component-name}.component.tsx
```

Files belonging to the same pod must use relative imports to reference each other.

### Business

Business files contain pure business logic.

They:

- Operate on ViewModels or frontend-facing domain values
- Must not perform I/O
- Must not call APIs
- Must not import API models
- Must not perform transport-layer mapping

### API

API files perform fetch and I/O only.

They:

- Communicate with the backend or external data source
- Send and receive API models
- Reflect the backend contract
- Do not return ViewModels
- Do not contain frontend formatting or presentation logic
- Do not contain business logic

### API models

API models represent the external backend contract.

They may contain:

- Backend field names
- Transport-friendly primitive values
- ISO date strings
- Nullable fields
- Backend enum values or codes
- Fields that the frontend does not need
- Nested structures shaped for transport rather than UI consumption

API models must not be consumed directly by routes, loaders, components, hooks, business logic, or pods.

### ViewModel

The pod model represents the frontend-facing ViewModel.

It must be designed around frontend needs, not around the backend response shape.

A ViewModel may:

- Use different property names
- Contain fewer fields than the API model
- Flatten or restructure nested API data
- Use `Date` instead of ISO strings
- Use frontend-specific enums
- Contain calculated or derived fields
- Contain formatted or normalized values
- Combine data from multiple API fields
- Provide frontend-friendly defaults

The ViewModel does not need to preserve the shape, field names, or types of the API model.

### Mapper

The mapper performs the complete transformation between API models and ViewModels.

Mapping is not limited to copying properties or satisfying TypeScript types.

A mapper may and should perform every transformation required to make the model appropriate for frontend consumption, including:

- Renaming fields
- Removing fields that the frontend does not need
- Selecting only relevant fields
- Flattening nested structures
- Restructuring objects
- Mapping nested collections
- Combining multiple fields
- Creating calculated or derived fields
- Converting ISO strings into `Date` objects
- Converting dates back into API-compatible strings
- Converting API enum values or codes into ViewModel enums
- Converting ViewModel enums back into API values
- Normalizing nullable or optional values
- Providing frontend-friendly defaults
- Converting units or representations
- Formatting values when that formatted representation belongs to the ViewModel

Mappers must:

- Be pure functions
- Contain no I/O
- Contain no API calls
- Produce complete ViewModels
- Perform reverse mapping for write operations when required

A consumer of the repository must never need to perform additional API-to-ViewModel mapping.

### Repository

The repository orchestrates the API and mapper.

It is the only public data-access entry point of the pod and the boundary between backend-facing and frontend-facing types.

The repository must:

- Call API functions
- Receive API models
- Invoke mappers
- Return complete ViewModels
- Map frontend-facing input into API request models when required
- Hide the existence and shape of API models from its consumers
- Hide API implementation details
- Hide mapper usage
- Expose methods whose parameters and return values use only frontend-facing types

The repository must not:

- Return raw API models
- Expose API clients
- Require consumers to invoke a mapper
- Require consumers to rename or remove API fields
- Require consumers to convert dates or enums
- Leak backend field names or transport details

> **Repository invariant:** from the outside, the repository only speaks ViewModel.

If a loader or component still needs to rename fields, remove API-only fields, calculate values, convert dates, translate enums, or reshape data after calling the repository, the mapper is incomplete and the repository boundary is broken.

---

## 7) Complete Mapping Example

```ts
// api/car.api-model.ts

export interface CarApiModel {
  vehicle_id: string;
  registration_date: string;
  fuel_type: "P" | "D" | "E";
  price_in_cents: number;
  internal_reference: string;
}
```

```ts
// car.model.ts

export enum FuelType {
  Petrol = "petrol",
  Diesel = "diesel",
  Electric = "electric",
}

export interface Car {
  id: string;
  registrationDate: Date;
  fuelType: FuelType;
  price: number;
  displayPrice: string;
}
```

```ts
// car.mapper.ts

const mapFuelTypeFromApi = (fuelType: CarApiModel["fuel_type"]): FuelType => {
  switch (fuelType) {
    case "P":
      return FuelType.Petrol;
    case "D":
      return FuelType.Diesel;
    case "E":
      return FuelType.Electric;
  }
};

export const mapCarFromApi = (car: CarApiModel): Car => {
  const price = car.price_in_cents / 100;

  return {
    id: car.vehicle_id,
    registrationDate: new Date(car.registration_date),
    fuelType: mapFuelTypeFromApi(car.fuel_type),
    price,
    displayPrice: formatCurrency(price),
  };
};
```

```ts
// car.repository.ts

export const carRepository = {
  async getCars(): Promise<Car[]> {
    const apiCars = await carApi.getCars();

    return apiCars.map(mapCarFromApi);
  },
};
```

Notice that the mapper:

- Renames `vehicle_id` to `id`
- Omits `internal_reference`
- Converts an ISO string into a `Date`
- Converts backend fuel codes into a ViewModel enum
- Converts cents into euros
- Creates the calculated `displayPrice` field

The route loader only sees `Car[]`. It does not know that `CarApiModel` exists.

---

## 8) Checklist

When creating or reviewing a pod:

- Create the pod
- Define the ViewModel around frontend needs
- Define API models around the backend contract
- Add an API client for I/O
- Add complete API model ↔ ViewModel mapping
- Add a repository when the pod loads or persists data
- Ensure the repository is the only consumer of the API and mapper
- Ensure repository methods expose only frontend-facing types
- Ensure API models never escape the repository boundary
- Ensure loaders call repositories instead of APIs
- Ensure loaders do not perform API-to-ViewModel mapping
- Ensure components and pods consume ViewModels
- Ensure business logic consumes ViewModels
- Ensure every regular React component file uses the `.component.tsx` suffix
- Ensure the pod entry point uses the `.pod.tsx` suffix
- Ensure pod-specific subcomponents live under the pod's `components/` directory
- Ensure files inside the same pod import each other using relative paths
- Ensure aliases are not being used to bypass pod isolation
- Keep routes thin
- Do not create cross-pod imports without explicit user approval

Before finishing, search for architectural leaks:

- API imports outside `api`, `mapper`, or `repository`
- API model imports in routes, components, hooks, business files, or pods
- Mapper calls outside repositories
- Raw API responses returned by repositories
- Date, enum, field-name, or shape conversion performed by loaders or components

Also search for naming and import violations:

- Regular React component files that do not end in `.component.tsx`
- Pod entry points that do not end in `.pod.tsx`
- Pod-specific components placed outside the pod's `components/` directory
- Alias imports whose source and target are inside the same pod
- Alias imports used to access another pod

If any of these exist, fix the repository boundary, naming, or imports before considering the implementation complete.

---

## Summary

- Routes = thin orchestration
- Pods = isolated features
- API = backend communication using API models
- Mapper = complete API model ↔ ViewModel transformation
- Repository = boundary and single data-access entry point
- ViewModel = the only model exposed to frontend consumers
- Components = `.component.tsx`
- Pod entry points = `.pod.tsx`
- Imports inside a pod = relative paths
- Common = explicitly shared code
- From the outside, the repository only speaks ViewModel
