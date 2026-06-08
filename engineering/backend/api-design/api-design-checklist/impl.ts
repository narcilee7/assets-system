/**
 * API Design Checklist 实现：展示 REST API 设计的核心模式。
 *
 * 包含：
 * - 统一错误模型
 * - 分页设计（cursor + offset）
 * - 幂等性设计
 * - 资源 DTO 设计
 */

import { randomUUID } from "crypto";

/* ------------------------------------------------------------------ */
/*  统一错误模型                                                        */
/* ------------------------------------------------------------------ */

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  requestId?: string;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export const ErrorCodes = {
  // 4xx Client Errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",

  // 5xx Server Errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

function createError(
  code: ErrorCode,
  message: string,
  options: {
    retryable?: boolean;
    details?: Record<string, unknown>;
    requestId?: string;
  } = {}
): ApiError {
  return {
    code,
    message,
    retryable: options.retryable ?? isRetryable(code),
    details: options.details,
    requestId: options.requestId,
  };
}

function isRetryable(code: ErrorCode): boolean {
  // 5xx 都是可重试的，4xx 客户端错误不可重试
  return code.startsWith("SERVICE_") || code === "TIMEOUT" || code === "INTERNAL_ERROR";
}

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  toJSON(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        details: this.details,
        requestId: this.requestId,
      },
    };
  }

  static badRequest(message: string, details?: Record<string, unknown>, requestId?: string) {
    return new ApiError(ErrorCodes.VALIDATION_ERROR, message, false, details, requestId);
  }

  static notFound(resource: string, id: string, requestId?: string) {
    return new ApiError(
      ErrorCodes.NOT_FOUND,
      `${resource} not found: ${id}`,
      false,
      { resource, id },
      requestId
    );
  }

  static conflict(message: string, details?: Record<string, unknown>, requestId?: string) {
    return new ApiError(ErrorCodes.CONFLICT, message, false, details, requestId);
  }

  static unauthorized(requestId?: string) {
    return new ApiError(ErrorCodes.UNAUTHORIZED, "Unauthorized", false, undefined, requestId);
  }

  static forbidden(requestId?: string) {
    return new ApiError(ErrorCodes.FORBIDDEN, "Forbidden", false, undefined, requestId);
  }

  static rateLimited(retryAfterMs?: number, requestId?: string) {
    return new ApiError(
      ErrorCodes.RATE_LIMITED,
      "Rate limited",
      true,
      { retryAfterMs },
      requestId
    );
  }

  static internal(message = "Internal server error", requestId?: string) {
    return new ApiError(ErrorCodes.INTERNAL_ERROR, message, true, undefined, requestId);
  }

  static serviceUnavailable(requestId?: string) {
    return new ApiError(ErrorCodes.SERVICE_UNAVAILABLE, "Service unavailable", true, undefined, requestId);
  }

  static timeout(requestId?: string) {
    return new ApiError(ErrorCodes.TIMEOUT, "Request timeout", true, undefined, requestId);
  }
}

/* ------------------------------------------------------------------ */
/*  分页设计                                                           */
/* ------------------------------------------------------------------ */

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
  limit?: number;
}

export interface OffsetPaginationMeta {
  type: "offset";
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CursorPaginationMeta {
  type: "cursor";
  cursor: string | null;
  nextCursor: string | null;
  limit: number;
  hasMore: boolean;
}

export type PaginationMeta = OffsetPaginationMeta | CursorPaginationMeta;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Offset 分页：适合小数据集，简单易用
 */
export function createOffsetPagination(
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<unknown>["pagination"] {
  const totalPages = Math.ceil(total / pageSize);
  return {
    type: "offset",
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Cursor 分页：适合大数据集，性能稳定
 */
export function createCursorPagination(
  cursor: string | null,
  nextCursor: string | null,
  limit: number,
  hasMore: boolean
): CursorPaginationMeta {
  return {
    type: "cursor",
    cursor,
    nextCursor,
    limit,
    hasMore,
  };
}

/* ------------------------------------------------------------------ */
/*  幂等性设计                                                         */
/* ------------------------------------------------------------------ */

export interface IdempotencyRecord<T = unknown> {
  key: string;
  status: "processing" | "completed" | "failed";
  response?: T;
  createdAt: number;
  expiresAt: number;
}

export class IdempotencyStore {
  private store = new Map<string, IdempotencyRecord<unknown>>();

  async get<T>(key: string): Promise<IdempotencyRecord<T> | null> {
    const record = this.store.get(key) as IdempotencyRecord<T> | undefined;
    if (!record) return null;

    // 过期检查
    if (record.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return record;
  }

  async setProcessing(key: string, ttlMs: number): void {
    const now = Date.now();
    this.store.set(key, {
      key,
      status: "processing",
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  async setCompleted<T>(key: string, response: T, ttlMs: number): void {
    const now = Date.now();
    const existing = this.store.get(key);
    this.store.set(key, {
      key,
      status: "completed",
      response,
      createdAt: existing?.createdAt ?? now,
      expiresAt: now + ttlMs,
    });
  }

  async setFailed(key: string, ttlMs: number): void {
    const now = Date.now();
    const existing = this.store.get(key);
    this.store.set(key, {
      key,
      status: "failed",
      createdAt: existing?.createdAt ?? now,
      expiresAt: now + ttlMs,
    });
  }

  async clearExpired(): Promise<number> {
    const now = Date.now();
    let cleared = 0;
    for (const [key, record] of this.store.entries()) {
      if (record.expiresAt < now) {
        this.store.delete(key);
        cleared++;
      }
    }
    return cleared;
  }
}

/* ------------------------------------------------------------------ */
/*  资源 DTO 示例（User）                                              */
/* ------------------------------------------------------------------ */

export interface UserResource {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export interface UserListResponse {
  data: UserResource[];
  pagination: OffsetPaginationMeta;
}

export interface UserItemResponse {
  data: UserResource;
}

/* ------------------------------------------------------------------ */
/*  HTTP 状态码映射                                                    */
/* ------------------------------------------------------------------ */

export const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.IDEMPOTENCY_CONFLICT]: 409,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.TIMEOUT]: 504,
};

export function getHttpStatus(code: ErrorCode): number {
  return HTTP_STATUS_MAP[code] ?? 500;
}

/* ------------------------------------------------------------------ */
/*  请求 ID 生成                                                       */
/* ------------------------------------------------------------------ */

export function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/* ------------------------------------------------------------------ */
/*  参数校验辅助                                                        */
/* ------------------------------------------------------------------ */

export interface ValidationError {
  field: string;
  message: string;
}

export function validateCreateUser(req: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const r = req as Record<string, unknown>;

  if (!r.email || typeof r.email !== "string") {
    errors.push({ field: "email", message: "email is required" });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
    errors.push({ field: "email", message: "invalid email format" });
  }

  if (!r.name || typeof r.name !== "string" || r.name.length < 1) {
    errors.push({ field: "name", message: "name is required" });
  }

  if (!r.password || typeof r.password !== "string" || r.password.length < 8) {
    errors.push({ field: "password", message: "password must be at least 8 characters" });
  }

  return errors;
}