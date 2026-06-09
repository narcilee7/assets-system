/**
 * API Design Checklist 测试。
 *
 * 运行：在 engineering/backend/ 目录执行 `npm test`
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  ApiError,
  ErrorCodes,
  HTTP_STATUS_MAP,
  getHttpStatus,
  generateRequestId,
  validateCreateUser,
  IdempotencyStore,
  createOffsetPagination,
  createCursorPagination,
  type PaginationParams,
} from "./impl.js";

/* ------------------------------------------------------------------ */
/*  错误模型测试                                                       */
/* ------------------------------------------------------------------ */

describe("ApiError", () => {
  it("badRequest 创建 400 错误", () => {
    const error = ApiError.badRequest("Invalid input", { field: "email" });
    assert.strictEqual(error.code, ErrorCodes.VALIDATION_ERROR);
    assert.strictEqual(error.message, "Invalid input");
    assert.strictEqual(error.retryable, false);
    assert.deepStrictEqual(error.details, { field: "email" });
  });

  it("notFound 创建 404 错误", () => {
    const error = ApiError.notFound("User", "u123");
    assert.strictEqual(error.code, ErrorCodes.NOT_FOUND);
    assert.strictEqual(error.retryable, false);
    assert.ok(error.message.includes("u123"));
  });

  it("conflict 创建 409 错误", () => {
    const error = ApiError.conflict("Email already exists", { email: "a@b.com" });
    assert.strictEqual(error.code, ErrorCodes.CONFLICT);
    assert.strictEqual(error.retryable, false);
  });

  it("rateLimited 创建 429 错误", () => {
    const error = ApiError.rateLimited(5000);
    assert.strictEqual(error.code, ErrorCodes.RATE_LIMITED);
    assert.strictEqual(error.retryable, true);
    assert.strictEqual(error.details?.retryAfterMs, 5000);
  });

  it("internal 创建 500 错误", () => {
    const error = ApiError.internal();
    assert.strictEqual(error.code, ErrorCodes.INTERNAL_ERROR);
    assert.strictEqual(error.retryable, true);
  });

  it("serviceUnavailable 创建 503 错误", () => {
    const error = ApiError.serviceUnavailable();
    assert.strictEqual(error.code, ErrorCodes.SERVICE_UNAVAILABLE);
    assert.strictEqual(error.retryable, true);
  });

  it("timeout 创建 504 错误", () => {
    const error = ApiError.timeout();
    assert.strictEqual(error.code, ErrorCodes.TIMEOUT);
    assert.strictEqual(error.retryable, true);
  });

  it("toJSON 返回标准错误格式", () => {
    const error = ApiError.badRequest("Bad", undefined, "req_123");
    const json = error.toJSON();
    assert.deepStrictEqual(json, {
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Bad",
        retryable: false,
        details: undefined,
        requestId: "req_123",
      },
    });
  });
});

describe("HTTP_STATUS_MAP", () => {
  it("所有错误码都有对应的 HTTP 状态码", () => {
    for (const code of Object.values(ErrorCodes)) {
      assert.ok(
        code in HTTP_STATUS_MAP,
        `Missing HTTP status for ${code}`
      );
    }
  });

  it("getHttpStatus 返回正确的状态码", () => {
    assert.strictEqual(getHttpStatus(ErrorCodes.NOT_FOUND), 404);
    assert.strictEqual(getHttpStatus(ErrorCodes.VALIDATION_ERROR), 400);
    assert.strictEqual(getHttpStatus(ErrorCodes.RATE_LIMITED), 429);
    assert.strictEqual(getHttpStatus(ErrorCodes.INTERNAL_ERROR), 500);
  });
});

/* ------------------------------------------------------------------ */
/*  分页测试                                                           */
/* ------------------------------------------------------------------ */

describe("分页", () => {
  describe("Offset Pagination", () => {
    it("第一页有更多数据", () => {
      const meta = createOffsetPagination(1, 10, 25);
      assert.strictEqual(meta.type, "offset");
      assert.strictEqual(meta.page, 1);
      assert.strictEqual(meta.pageSize, 10);
      assert.strictEqual(meta.total, 25);
      assert.strictEqual(meta.totalPages, 3);
      assert.strictEqual(meta.hasMore, true);
    });

    it("最后一页无更多数据", () => {
      const meta = createOffsetPagination(3, 10, 25);
      assert.strictEqual(meta.hasMore, false);
    });

    it("空结果", () => {
      const meta = createOffsetPagination(1, 10, 0);
      assert.strictEqual(meta.total, 0);
      assert.strictEqual(meta.totalPages, 0);
      assert.strictEqual(meta.hasMore, false);
    });
  });

  describe("Cursor Pagination", () => {
    it("有下一页", () => {
      const meta = createCursorPagination("abc", "def", 10, true);
      assert.strictEqual(meta.type, "cursor");
      assert.strictEqual(meta.cursor, "abc");
      assert.strictEqual(meta.nextCursor, "def");
      assert.strictEqual(meta.hasMore, true);
    });

    it("无下一页", () => {
      const meta = createCursorPagination("abc", null, 10, false);
      assert.strictEqual(meta.nextCursor, null);
      assert.strictEqual(meta.hasMore, false);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  幂等性测试                                                         */
/* ------------------------------------------------------------------ */

describe("IdempotencyStore", () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    store = new IdempotencyStore();
  });

  it("设置并获取 processing 状态", async () => {
    await store.setProcessing("key1", 60000);
    const record = await store.get("key1");
    assert.strictEqual(record?.status, "processing");
  });

  it("设置并获取 completed 状态", async () => {
    await store.setCompleted("key1", { id: "123" }, 60000);
    const record = await store.get<{ id: string }>("key1");
    assert.strictEqual(record?.status, "completed");
    assert.strictEqual(record?.response?.id, "123");
  });

  it("设置并获取 failed 状态", async () => {
    await store.setFailed("key1", 60000);
    const record = await store.get("key1");
    assert.strictEqual(record?.status, "failed");
  });

  it("不存在的 key 返回 null", async () => {
    const record = await store.get("non-existent");
    assert.strictEqual(record, null);
  });

  it("清理过期记录", async () => {
    // 直接操作内部 store 模拟过期
    const now = Date.now();
    (store as unknown as Map<string, { key: string; status: string; expiresAt: number }>).store.set("expired", {
      key: "expired",
      status: "completed",
      expiresAt: now - 1000, // 已过期
    });

    const cleared = await store.clearExpired();
    assert.strictEqual(cleared, 1);
  });
});

/* ------------------------------------------------------------------ */
/*  参数校验测试                                                       */
/* ------------------------------------------------------------------ */

describe("validateCreateUser", () => {
  it("有效输入通过校验", () => {
    const errors = validateCreateUser({
      email: "a@b.com",
      name: "Alice",
      password: "password123",
    });
    assert.strictEqual(errors.length, 0);
  });

  it("缺少 email", () => {
    const errors = validateCreateUser({
      name: "Alice",
      password: "password123",
    });
    assert.ok(errors.some((e) => e.field === "email"));
  });

  it("无效 email 格式", () => {
    const errors = validateCreateUser({
      email: "not-an-email",
      name: "Alice",
      password: "password123",
    });
    assert.ok(errors.some((e) => e.field === "email" && e.message.includes("email")));
  });

  it("缺少 name", () => {
    const errors = validateCreateUser({
      email: "a@b.com",
      password: "password123",
    });
    assert.ok(errors.some((e) => e.field === "name"));
  });

  it("密码太短", () => {
    const errors = validateCreateUser({
      email: "a@b.com",
      name: "Alice",
      password: "short",
    });
    assert.ok(errors.some((e) => e.field === "password"));
  });
});

/* ------------------------------------------------------------------ */
/*  请求 ID 测试                                                       */
/* ------------------------------------------------------------------ */

describe("generateRequestId", () => {
  it("生成唯一 ID", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    assert.notStrictEqual(id1, id2);
  });

  it("ID 以 req_ 前缀", () => {
    const id = generateRequestId();
    assert.ok(id.startsWith("req_"));
  });

  it("ID 长度一致", () => {
    const id = generateRequestId();
    assert.strictEqual(id.length, 20); // req_ + 16 char
  });
});