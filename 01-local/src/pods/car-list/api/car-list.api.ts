import { createServerFn } from "@tanstack/react-start";

import { contentIslandClient } from "#/common/api/content-island-client";

import type { CarSummaryApiModel } from "./car-list.api-model";

// I/O only. Runs on the server (both during SSR and on client-side navigation),
// so the Content Island access token never reaches the browser.
// `includeRelatedContent` is required for `image` to arrive resolved instead of
// as a bare reference.
export const getCarListApi = createServerFn().handler(
  async (): Promise<Array<CarSummaryApiModel>> => {
    return contentIslandClient.getContentList<CarSummaryApiModel>({
      contentType: "Car",
      includeRelatedContent: true,
      sort: { "fields.brand": "asc" },
      // pagination: { take: 20 }
    });
  },
);
