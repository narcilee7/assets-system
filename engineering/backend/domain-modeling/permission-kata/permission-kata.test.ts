/**
 * Permission Domain Model 测试。
 *
 * 运行：在 engineering/backend/ 目录执行 `npm test`
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  User,
  Role,
  UserRoleAssignment,
  Permission,
  ResourceId,
  PermissionService,
  InMemoryPermissionRepository,
  InMemoryEventStore,
  type Action,
  type RoleType,
} from "./impl.js";

/* ------------------------------------------------------------------ */
/*  Value Objects 测试                                                 */
/* ------------------------------------------------------------------ */

describe("ResourceId", () => {
  it("创建有效 ResourceId", () => {
    const resource = new ResourceId("document", "123");
    assert.strictEqual(resource.type, "document");
    assert.strictEqual(resource.id, "123");
  });

  it("空类型或 ID 抛出错误", () => {
    assert.throws(() => new ResourceId("", "123"));
    assert.throws(() => new ResourceId("doc", ""));
  });

  it("equals 比较", () => {
    const r1 = new ResourceId("doc", "123");
    const r2 = new ResourceId("doc", "123");
    const r3 = new ResourceId("doc", "456");
    assert.ok(r1.equals(r2));
    assert.ok(!r1.equals(r3));
  });

  it("toString / fromString", () => {
    const r = new ResourceId("doc", "123");
    assert.strictEqual(r.toString(), "doc:123");
    assert.ok(ResourceId.fromString("doc:123").equals(r));
  });
});

describe("Permission", () => {
  it("创建权限", () => {
    const resource = new ResourceId("document", "d1");
    const perm = new Permission(resource, "read");
    assert.strictEqual(perm.action, "read");
    assert.ok(perm.resource.equals(resource));
  });

  it("equals 比较", () => {
    const r1 = new ResourceId("doc", "1");
    const perm1 = new Permission(r1, "read");
    const perm2 = new Permission(r1, "read");
    const perm3 = new Permission(r1, "write");
    assert.ok(perm1.equals(perm2));
    assert.ok(!perm1.equals(perm3));
  });

  it("admin 权限隐含所有其他权限", () => {
    const r = new ResourceId("doc", "1");
    const admin = new Permission(r, "admin");
    const read = new Permission(r, "read");
    const write = new Permission(r, "write");
    assert.ok(admin.implies(read));
    assert.ok(admin.implies(write));
    assert.ok(!read.implies(admin));
  });

  it("delete 隐含 read 但不隐含 admin", () => {
    const r = new ResourceId("doc", "1");
    const del = new Permission(r, "delete");
    const read = new Permission(r, "read");
    const admin = new Permission(r, "admin");
    assert.ok(del.implies(read));
    assert.ok(!del.implies(admin));
  });
});

/* ------------------------------------------------------------------ */
/*  Entity 测试                                                        */
/* ------------------------------------------------------------------ */

describe("User", () => {
  it("create 工厂方法", () => {
    const user = User.create("Alice", "alice@example.com");
    assert.ok(user.id);
    assert.strictEqual(user.name, "Alice");
    assert.strictEqual(user.email, "alice@example.com");
    assert.ok(user.createdAt > 0);
  });

  it("updateName", () => {
    const user = User.create("Alice", "alice@example.com");
    user.updateName("Bob");
    assert.strictEqual(user.name, "Bob");
  });

  it("updateName 空字符串抛出错误", () => {
    const user = User.create("Alice", "alice@example.com");
    assert.throws(() => user.updateName(""));
  });
});

describe("Role", () => {
  it("create 工厂方法", () => {
    const role = Role.create("Editor", "member");
    assert.ok(role.id);
    assert.strictEqual(role.name, "Editor");
    assert.strictEqual(role.type, "member");
    assert.deepStrictEqual(role.permissions, []);
  });

  it("addPermission", () => {
    const role = Role.create("Editor", "member");
    const perm = new Permission(new ResourceId("document", "1"), "read");
    role.addPermission(perm);
    assert.strictEqual(role.permissions.length, 1);
  });

  it("addPermission 幂等", () => {
    const role = Role.create("Editor", "member");
    const perm = new Permission(new ResourceId("document", "1"), "read");
    role.addPermission(perm);
    role.addPermission(perm);
    assert.strictEqual(role.permissions.length, 1);
  });

  it("removePermission", () => {
    const role = Role.create("Editor", "member");
    const perm = new Permission(new ResourceId("document", "1"), "read");
    role.addPermission(perm);
    role.removePermission(new ResourceId("document", "1"), "read");
    assert.strictEqual(role.permissions.length, 0);
  });

  it("hasPermission", () => {
    const role = Role.create("Admin", "admin");
    const adminPerm = new Permission(new ResourceId("*", "*"), "admin");
    const readPerm = new Permission(new ResourceId("doc", "1"), "read");
    role.addPermission(adminPerm);
    assert.ok(role.hasPermission(adminPerm));
    assert.ok(role.hasPermission(readPerm)); // admin 隐含所有
  });
});

/* ------------------------------------------------------------------ */
/*  Aggregate 测试                                                     */
/* ------------------------------------------------------------------ */

describe("UserRoleAssignment", () => {
  it("create 工厂方法", () => {
    const assignment = UserRoleAssignment.create("u1", "r1", "admin");
    assert.ok(assignment.id);
    assert.strictEqual(assignment.userId, "u1");
    assert.strictEqual(assignment.roleId, "r1");
    assert.strictEqual(assignment.grantedBy, "admin");
    assert.strictEqual(assignment.expiresAt, null);
  });

  it("带过期时间", () => {
    const future = Date.now() + 86400000;
    const assignment = UserRoleAssignment.create("u1", "r1", "admin", future);
    assert.strictEqual(assignment.expiresAt, future);
    assert.ok(!assignment.isExpired());
  });

  it("isExpired", () => {
    const past = Date.now() - 1000;
    const assignment = UserRoleAssignment.create("u1", "r1", "admin", past);
    assert.ok(assignment.isExpired());
  });

  it("永久分配不过期", () => {
    const assignment = UserRoleAssignment.create("u1", "r1", "admin");
    assert.ok(!assignment.isExpired());
  });
});

/* ------------------------------------------------------------------ */
/*  Domain Service 测试                                               */
/* ------------------------------------------------------------------ */

describe("PermissionService", () => {
  let repo: InMemoryPermissionRepository;
  let eventStore: InMemoryEventStore;
  let service: PermissionService;

  beforeEach(() => {
    repo = new InMemoryPermissionRepository();
    eventStore = new InMemoryEventStore();
    service = new PermissionService(repo, eventStore);
  });

  it("checkPermission 无角色返回 false", async () => {
    const result = await service.checkPermission(
      "u1",
      new ResourceId("doc", "1"),
      "read"
    );
    assert.strictEqual(result, false);
  });

  it("checkPermission 有角色返回 true", async () => {
    // 创建角色和权限
    const role = Role.create("Editor", "member");
    const perm = new Permission(new ResourceId("document", "1"), "read");
    role.addPermission(perm);
    repo.addRole(role);

    // 分配角色
    await service.assignRole("u1", role.id, "admin");

    // 检查权限
    const result = await service.checkPermission(
      "u1",
      new ResourceId("document", "1"),
      "read"
    );
    assert.strictEqual(result, true);
  });

  it("checkPermission 发布 PermissionDenied 事件", async () => {
    const result = await service.checkPermission(
      "u1",
      new ResourceId("doc", "1"),
      "read"
    );
    assert.strictEqual(result, false);

    const events = eventStore.getEvents("u1");
    assert.ok(events.some(e => e.eventType === "PermissionDenied"));
  });

  it("assignRole 发布 RoleAssigned 事件", async () => {
    const role = Role.create("Editor", "member");
    repo.addRole(role);

    const event = await service.assignRole("u1", role.id, "admin");

    assert.strictEqual(event.userId, "u1");
    assert.strictEqual(event.roleId, role.id);

    const events = eventStore.getEvents("u1");
    assert.ok(events.some(e => e.eventType === "RoleAssigned"));
  });

  it("revokeRole 发布 RoleRevoked 事件", async () => {
    const role = Role.create("Editor", "member");
    repo.addRole(role);

    const assigned = await service.assignRole("u1", role.id, "admin");
    const revoked = await service.revokeRole(
      assigned.assignmentId,
      "u1",
      role.id,
      "admin"
    );

    assert.strictEqual(revoked.eventType, "RoleRevoked");

    const events = eventStore.getEvents("u1");
    assert.ok(events.some(e => e.eventType === "RoleRevoked"));
  });

  it("getUserPermissions 返回所有权限", async () => {
    const role1 = Role.create("Role1", "member");
    role1.addPermission(new Permission(new ResourceId("doc", "1"), "read"));
    repo.addRole(role1);

    const role2 = Role.create("Role2", "member");
    role2.addPermission(new Permission(new ResourceId("doc", "1"), "write"));
    role2.addPermission(new Permission(new ResourceId("file", "1"), "admin"));
    repo.addRole(role2);

    await service.assignRole("u1", role1.id, "admin");
    await service.assignRole("u1", role2.id, "admin");

    const perms = await service.getUserPermissions("u1");

    assert.strictEqual(perms.length, 3);
  });

  it("过期角色不被返回", async () => {
    const role = Role.create("Editor", "member");
    role.addPermission(new Permission(new ResourceId("doc", "1"), "read"));
    repo.addRole(role);

    // 分配一个已过期的角色
    const past = Date.now() - 1000;
    const expiredAssignment = UserRoleAssignment.create("u2", role.id, "admin", past);
    await repo.saveAssignment(expiredAssignment);

    const roles = await service.getUserRoles("u2");
    assert.strictEqual(roles.length, 0);
  });
});

/* ------------------------------------------------------------------ */
/*  集成测试                                                           */
/* ------------------------------------------------------------------ */

describe("权限系统集成", () => {
  let repo: InMemoryPermissionRepository;
  let eventStore: InMemoryEventStore;
  let service: PermissionService;
  let adminRole: Role;
  let editorRole: Role;

  beforeEach(() => {
    repo = new InMemoryPermissionRepository();
    eventStore = new InMemoryEventStore();
    service = new PermissionService(repo, eventStore);

    // 创建管理员角色
    adminRole = Role.create("Admin", "admin");
    adminRole.addPermission(new Permission(new ResourceId("*", "*"), "admin"));
    repo.addRole(adminRole);

    // 创建编辑角色
    editorRole = Role.create("Editor", "member");
    editorRole.addPermission(new Permission(new ResourceId("document", "*"), "read"));
    editorRole.addPermission(new Permission(new ResourceId("document", "*"), "write"));
    repo.addRole(editorRole);
  });

  it("管理员可以做任何操作", async () => {
    await service.assignRole("adminUser", adminRole.id, "system");

    assert.ok(await service.checkPermission("adminUser", new ResourceId("anything", "1"), "admin"));
    assert.ok(await service.checkPermission("adminUser", new ResourceId("doc", "1"), "delete"));
  });

  it("编辑可以读写文档", async () => {
    await service.assignRole("editorUser", editorRole.id, "system");

    assert.ok(await service.checkPermission("editorUser", new ResourceId("document", "123"), "read"));
    assert.ok(await service.checkPermission("editorUser", new ResourceId("document", "123"), "write"));
    assert.ok(!await service.checkPermission("editorUser", new ResourceId("document", "123"), "delete"));
  });

  it("撤销角色后失去权限", async () => {
    const assigned = await service.assignRole("editorUser", editorRole.id, "system");

    assert.ok(await service.checkPermission("editorUser", new ResourceId("document", "123"), "read"));

    await service.revokeRole(assigned.assignmentId, "editorUser", editorRole.id, "system");

    assert.ok(!await service.checkPermission("editorUser", new ResourceId("document", "123"), "read"));
  });

  it("所有事件被记录", async () => {
    const assigned = await service.assignRole("user1", editorRole.id, "admin");
    await service.assignRole("user1", adminRole.id, "admin");
    await service.revokeRole(assigned.assignmentId, "user1", editorRole.id, "admin");

    const events = eventStore.getEvents("user1");
    assert.strictEqual(events.length, 3);
    assert.strictEqual(events[0].eventType, "RoleAssigned");
    assert.strictEqual(events[1].eventType, "RoleAssigned");
    assert.strictEqual(events[2].eventType, "RoleRevoked");
  });
});