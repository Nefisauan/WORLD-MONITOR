import type { FastifyInstance } from "fastify";
import type { ProbabilityEstimate } from "./types.js";

/** Read-only research contract. Diagnostics must never be consumed as forecasts. */
export function registerProbabilityResearch(
  app: FastifyInstance,
  read: () => ProbabilityEstimate[],
) {
  app.get("/api/v1/probability-research", async () => ({
    schemaVersion: 1,
    purpose: "unvalidated_research",
    estimates: read(),
  }));
}
