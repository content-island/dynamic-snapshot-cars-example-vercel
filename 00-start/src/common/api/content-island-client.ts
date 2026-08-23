import { createClient } from "@content-island/api-client";

const accessToken = process.env.CONTENT_ISLAND_ACCESS_TOKEN;

export const contentIslandClient = createClient({
  accessToken: accessToken ?? "",
});
