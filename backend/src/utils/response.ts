export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: string;
}

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE'
  | 'PARSE_ERROR'
  | 'DATABASE_ERROR'
  | 'RATE_LIMITED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_EXPIRED'
  | 'INVALID_TOKEN'
  | 'OWNERSHIP_ERROR';

export function successResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(
  error: string,
  code: ErrorCode,
  statusCode?: number
): ErrorResponse {
  return {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
  };
}
