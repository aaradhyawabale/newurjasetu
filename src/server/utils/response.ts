import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}

export function successResponse<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export function errorResponse(
  message: string,
  code = "BAD_REQUEST",
  status = 400,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

export function handleRouteError(error: unknown): NextResponse<ApiErrorResponse> {
  console.error("[API Error]", error);

  if (error instanceof ZodError) {
    return errorResponse("Validation failed", "VALIDATION_ERROR", 400, error.flatten());
  }

  if (error && typeof error === "object" && "code" in error && "statusCode" in error) {
    const typedErr = error as {
      message?: string;
      code: string;
      statusCode: number;
      details?: unknown;
    };
    return errorResponse(
      typedErr.message || "Analysis request failed",
      typedErr.code,
      typedErr.statusCode,
      typedErr.details
    );
  }

  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }
    if (error.message === "FORBIDDEN") {
      return errorResponse("Access denied", "FORBIDDEN", 403);
    }
    if (error.message === "NOT_FOUND") {
      return errorResponse("Resource not found", "NOT_FOUND", 404);
    }
    if (error.message.includes("Invalid site coordinates") || error.message.includes("Invalid footprint")) {
      return errorResponse(error.message, "INVALID_GEOMETRY", 400);
    }
    if (error.message.includes("Unknown infrastructure type") || error.message.includes("Unsupported infrastructure type")) {
      return errorResponse(error.message, "UNSUPPORTED_TYPE", 400);
    }
    return errorResponse(error.message, "SERVER_ERROR", 500);
  }

  return errorResponse("An unexpected server error occurred", "INTERNAL_ERROR", 500);
}

