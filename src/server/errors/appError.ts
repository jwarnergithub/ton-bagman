export type AppErrorCode =
  | "BAG_LOOKUP_FAILED"
  | "BAG_PEERS_FAILED"
  | "BAG_PREPARE_FAILED"
  | "CONTRACT_LOOKUP_FAILED"
  | "CONTRACT_PREPARE_FAILED"
  | "MANAGED_BAG_SOURCE_FAILED"
  | "MANAGED_BAG_SOURCE_NOT_FOUND"
  | "PROVIDER_LOOKUP_FAILED"
  | "REMOTE_DELETE_FAILED"
  | "REMOTE_FILE_LIST_FAILED"
  | "REMOTE_TRANSFER_FAILED"
  | "SSH_TEST_UNAVAILABLE"
  | "TON_COMMAND_FAILED"
  | "TON_UNSUPPORTED_ACTION"
  | "UPLOAD_PLACEHOLDER_FAILED"
  | "VALIDATION_ERROR";

export class AppError extends Error {
  code: AppErrorCode;
  statusCode: number;

  constructor(code: AppErrorCode, message: string, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function createAppError(
  code: AppErrorCode,
  message: string,
  statusCode = 500,
) {
  return new AppError(code, message, statusCode);
}

export function toErrorResponse(error: AppError) {
  return {
    ok: false as const,
    error: {
      code: error.code,
      message: error.message,
    },
  };
}
