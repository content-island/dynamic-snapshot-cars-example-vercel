import { createServerFn } from "@tanstack/react-start";

import { contentIslandClient } from "#/common/api/content-island-client";

import type { CarDetailApiModel } from "./car-detail.api-model";

// I/O only, server side. The car is looked up by `slug` (unique in Content
// Island), so `getContentList` with a field filter is used instead of
// `getContent`: a missing car is an empty list rather than a transport error.
export const getCarBySlugApi = createServerFn()
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<CarDetailApiModel | null> => {
    const [car] = await contentIslandClient.getContentList<CarDetailApiModel>({
      contentType: "Car",
      "fields.slug": slug,
      includeRelatedContent: true,
    });

    return car ?? null;
  });
