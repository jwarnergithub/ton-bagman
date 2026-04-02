import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AppError,
  createAppError,
  toErrorResponse,
  type AppErrorCode,
} from "@/src/server/errors/appError";

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ApiErrorResponse = ReturnType<typeof toErrorResponse>;

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccessResponse<T>>(
    {
      ok: true,
      data,
    },
    { status },
  );
}

export function toAppRouteError(
  error: unknown,
  fallback: {
    code: AppErrorCode;
    message: string;
    statusCode: number;
  },
) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return createAppError(
      "VALIDATION_ERROR",
      error.issues[0]?.message ?? fallback.message,
      400,
    );
  }

  if (error instanceof Error) {
    return createAppError(fallback.code, error.message, fallback.statusCode);
  }

  return createAppError(fallback.code, fallback.message, fallback.statusCode);
}

export function jsonError(
  error: unknown,
  fallback: {
    code: AppErrorCode;
    message: string;
    statusCode: number;
  },
) {
  const appError = toAppRouteError(error, fallback);

  return NextResponse.json<ApiErrorResponse>(toErrorResponse(appError), {
    status: appError.statusCode,
  });
}
