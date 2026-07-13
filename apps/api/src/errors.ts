import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 500,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    sendError(reply, request, normalizeError(error));
  });

  app.setNotFoundHandler((request, reply) => {
    sendError(
      reply,
      request,
      new ApiError("NOT_FOUND", `Route ${request.method} ${request.url} was not found`, 404)
    );
  });
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ZodError) {
    return new ApiError("VALIDATION_ERROR", "Request validation failed", 400, {
      issues: error.issues
    });
  }

  if (!(error instanceof Error)) {
    return new ApiError("INTERNAL_SERVER_ERROR", String(error), 500);
  }

  return new ApiError(
    "INTERNAL_SERVER_ERROR",
    error.message || "Unexpected API error",
    "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500
  );
}

function sendError(reply: FastifyReply, request: FastifyRequest, error: ApiError) {
  reply.status(error.statusCode).send({
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      request_id: request.id
    }
  });
}
