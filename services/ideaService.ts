// services/ideaService.ts
import { apiClient } from "../lib/api/client";

export type CreateIdeaPayload = {
  title: string;
  type: string;
  entity?: string;
  tags?: string;
  todos?: string;
  linkedContactIds?: string;
};

export const ideaService = {
  create: (payload: CreateIdeaPayload) => apiClient.post("/api/ideas", payload),
  list: () => apiClient.get("/api/ideas"),
};
