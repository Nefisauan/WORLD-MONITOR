import type { FastifyInstance } from "fastify";
import type { EventStore } from "./storage/events.js";

export function registerEventArchive(app: FastifyInstance, getStore: () => EventStore | null) {
  app.get<{ Params: { id: string }; Querystring: { before?: number; limit?: number } }>(
    "/api/v1/events/:id/timeline", {
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", minLength: 1, maxLength: 128 } }, additionalProperties: false },
        querystring: { type: "object", properties: {
          before: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        }, additionalProperties: false },
      },
    }, async (request, reply) => {
      const store = getStore();
      if (!store) return reply.code(503).send({ error: "Event archive unavailable" });
      try {
        if (!store.get(request.params.id)) return reply.code(404).send({ error: "Event not found" });
        return { schemaVersion: 1, eventId: request.params.id, ...store.timeline(request.params.id, request.query.before, request.query.limit) };
      } catch {
        return reply.code(503).send({ error: "Event archive could not be read" });
      }
    },
  );
}
