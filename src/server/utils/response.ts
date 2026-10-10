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
    return errorResponse(error.message, "SERVER_ERROR", 500);
  }

  return errorResponse("An unexpected server error occurred", "INTERNAL_ERROR", 500);
}
