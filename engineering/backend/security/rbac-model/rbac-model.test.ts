/**
 * RBAC Permission Model 测试。
 *
 * 运行：在 engineering/backend/ 目录执行 `npm test`
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  InMemoryRbacStore,
  RbacService,
  setupDefaultRoles,
  type Permission,
  type Action,
  type ResourceType,
} from "./impl.js";

/* ------------------------------------------------------------------ */
/*  InMemoryRbacStore 测试                                            */
/* ------------------------------------------------------------------ */

describe("InMemoryRbacStore", () => {
  let store: InMemoryRbacStore;

  beforeEach(() => {
    store = new InMemoryRbacStore();
    setupDefaultRoles(store);
  });

  describe("User operations", () => {
    it("创建用户", () => {
      const user = store.createUser({ username: "alice", email: "alice@test.com", isActive: true });
      assert.ok(user.id);
      assert.strictEqual(user.username, "alice");
      assert.strictEqual(user.isActive, true);
    });

    it("获取用户", () => {
      const created = store.createUser({ username: "bob", email: "bob@test.com", isActive: true });
      const found = store.getUser(created.id);
      assert.strictEqual(found?.username, "bob");
    });

    it("更新用户", () => {
      const user = store.createUser({ username: "charlie", email: "charlie@test.com", isActive: true });
      const updated = store.updateUser(user.id, { email: "new@test.com" });
      assert.strictEqual(updated?.email, "new@test.com");
    });

    it("删除用户", () => {
      const user = store.createUser({ username: "dave", email: "dave@test.com", isActive: true });
      assert.ok(store.deleteUser(user.id));
      assert.strictEqual(store.getUser(user.id), null);
    });

    it("停用用户", () => {
      const user = store.createUser({ username: "eve", email: "eve@test.com", isActive: true });
      store.updateUser(user.id, { isActive: false });
      assert.strictEqual(store.getUser(user.id)?.isActive, false);
    });
  });

  describe("Role operations", () => {
    it("获取所有角色", () => {
      const roles = store.getAllRoles();
      assert.ok(roles.length >= 4);  // admin, user_manager, editor, viewer
    });

    it("按名称获取角色", () => {
      const adminRole = store.getRoleByName("admin");
      assert.ok(adminRole);
      assert.strictEqual(adminRole.name, "admin");
    });

    it("创建自定义角色", () => {
      const customRole = store.createRole({
        name: "custom_role",
        description: "Custom role",
        parentRoleId: null,
        permissions: [],
        isSystem: false,
      });
      assert.ok(customRole.id);
      assert.strictEqual(customRole.name, "custom_role");
    });

    it("系统角色不可删除", () => {
      const adminRole = store.getRoleByName("admin");
      assert.ok(adminRole);
      assert.ok(!store.deleteRole(adminRole.id));
    });

    it("删除自定义角色", () => {
      const customRole = store.createRole({
        name: "temp_role",
        description: "Temp role",
        parentRoleId: null,
        permissions: [],
        isSystem: false,
      });
      assert.ok(store.deleteRole(customRole.id));
      assert.strictEqual(store.getRole(customRole.id), null);
    });
  });

  describe("Role inheritance", () => {
    it("子角色继承父角色权限", () => {
      const editor = store.getRoleByName("editor");
      assert.ok(editor);
      // editor 没有 admin 权限
      const hasAdminPerm = editor.permissions.some(p => p.action === "manage");
      assert.strictEqual(hasAdminPerm, false);

      // user_manager 继承自 admin
      const userManager = store.getRoleByName("user_manager");
      assert.ok(userManager);
      // 应该继承 admin 的 manage 权限
      const hasManagePerm = userManager.permissions.some(p => p.action === "manage");
      assert.strictEqual(hasManagePerm, true);
    });
  });

  describe("User-Role mapping", () => {
    it("分配角色给用户", () => {
      const user = store.createUser({ username: "test", email: "test@test.com", isActive: true });
      const editorRole = store.getRoleByName("editor");
      assert.ok(editorRole);

      assert.ok(store.assignRoleToUser(user.id, editorRole.id));

      const userRoles = store.getUserRoles(user.id);
      assert.strictEqual(userRoles.length, 1);
      assert.strictEqual(userRoles[0].name, "editor");
    });

    it("撤销用户角色", () => {
      const user = store.createUser({ username: "test", email: "test@test.com", isActive: true });
      const editorRole = store.getRoleByName("editor");
      store.assignRoleToUser(user.id, editorRole.id);

      assert.ok(store.removeRoleFromUser(user.id, editorRole.id));

      const userRoles = store.getUserRoles(user.id);
      assert.strictEqual(userRoles.length, 0);
    });
  });

  describe("Permission checking", () => {
    it("用户无角色无权限", () => {
      const user = store.createUser({ username: "lonely", email: "lonely@test.com", isActive: true });
      assert.ok(!store.hasPermission(user.id, { resourceType: "document", resourceId: "1", action: "read" }));
    });

    it("用户有角色有权限", () => {
      const user = store.createUser({ username: "editor1", email: "editor1@test.com", isActive: true });
      const editorRole = store.getRoleByName("editor");
      store.assignRoleToUser(user.id, editorRole!.id);

      assert.ok(store.hasPermission(user.id, { resourceType: "document", resourceId: "123", action: "read" }));
      assert.ok(store.hasPermission(user.id, { resourceType: "document", resourceId: "456", action: "create" }));
    });

    it("管理员可以做任何操作", () => {
      const user = store.createUser({ username: "admin1", email: "admin1@test.com", isActive: true });
      const adminRole = store.getRoleByName("admin");
      store.assignRoleToUser(user.id, adminRole!.id);

      assert.ok(store.hasPermission(user.id, { resourceType: "user", resourceId: "1", action: "manage" }));
      assert.ok(store.hasPermission(user.id, { resourceType: "document", resourceId: "1", action: "delete" }));
      assert.ok(store.hasPermission(user.id, { resourceType: "anything", resourceId: "1", action: "manage" }));
    });

    it("通配符资源匹配", () => {
      const viewerRole = store.getRoleByName("viewer");
      assert.ok(viewerRole);

      const viewer = store.createUser({ username: "viewer1", email: "viewer1@test.com", isActive: true });
      store.assignRoleToUser(viewer.id, viewerRole!.id);

      // viewer 可以读任何文档
      assert.ok(store.hasPermission(viewer.id, { resourceType: "document", resourceId: "any-id", action: "read" }));
      // 但不能写
      assert.ok(!store.hasPermission(viewer.id, { resourceType: "document", resourceId: "any-id", action: "create" }));
    });

    it("停用用户无权限", () => {
      const user = store.createUser({ username: "inactive", email: "inactive@test.com", isActive: false });
      const viewerRole = store.getRoleByName("viewer");
      store.assignRoleToUser(user.id, viewerRole!.id);

      assert.ok(!store.hasPermission(user.id, { resourceType: "document", resourceId: "1", action: "read" }));
    });
  });
});

/* ------------------------------------------------------------------ */
/*  RbacService 测试                                                   */
/* ------------------------------------------------------------------ */

describe("RbacService", () => {
  let store: InMemoryRbacStore;
  let service: RbacService;

  beforeEach(() => {
    store = new InMemoryRbacStore();
    setupDefaultRoles(store);
    service = new RbacService(store);
  });

  describe("Permission checks", () => {
    it("checkPermission 返回布尔值", () => {
      const user = service.createUser("testuser", "test@test.com");
      service.assignRoleToUser(user.id, "viewer");

      assert.strictEqual(
        service.checkPermission(user.id, "document", "1", "read"),
        true
      );
      assert.strictEqual(
        service.checkPermission(user.id, "document", "1", "delete"),
        false
      );
    });

    it("checkPermissionDetailed 返回详细信息", () => {
      const user = service.createUser("testuser", "test@test.com");
      service.assignRoleToUser(user.id, "editor");

      const result = service.checkPermissionDetailed(user.id, "document", "123", "read");

      assert.strictEqual(result.allowed, true);
      assert.ok(result.matchedPermissions.length > 0);
    });

    it("无权限时返回原因", () => {
      const user = service.createUser("lonely", "lonely@test.com");

      const result = service.checkPermissionDetailed(user.id, "document", "1", "read");

      assert.strictEqual(result.allowed, false);
      assert.ok(result.reason.includes("No matching permission"));
    });
  });

  describe("Role management", () => {
    it("创建角色", () => {
      const role = service.createRole("new_role", "A new role");
      assert.ok(role.id);
      assert.strictEqual(role.name, "new_role");
    });

    it("创建带父角色的角色", () => {
      const childRole = service.createRole("child_role", "Child role", "viewer");
      assert.ok(childRole.parentRoleId);
    });

    it("分配角色", () => {
      const user = service.createUser("test", "test@test.com");
      assert.ok(service.assignRoleToUser(user.id, "editor"));
    });

    it("撤销角色", () => {
      const user = service.createUser("test", "test@test.com");
      service.assignRoleToUser(user.id, "editor");
      assert.ok(service.revokeRoleFromUser(user.id, "editor"));
    });
  });

  describe("Permission management", () => {
    it("添加权限到角色", () => {
      const role = service.createRole("test_role", "Test role");
      const added = service.addPermissionToRole("test_role", {
        resourceType: "document",
        resourceId: "1",
        action: "delete",
      });
      assert.strictEqual(added, true);

      const updatedRole = store.getRoleByName("test_role");
      assert.ok(updatedRole?.permissions.some(p =>
        p.resourceType === "document" && p.resourceId === "1" && p.action === "delete"
      ));
    });

    it("移除角色权限", () => {
      const role = service.createRole("test_role2", "Test role 2");
      service.addPermissionToRole("test_role2", {
        resourceType: "document",
        resourceId: "1",
        action: "delete",
      });

      service.removePermissionFromRole("test_role2", {
        resourceType: "document",
        resourceId: "1",
        action: "delete",
      });

      const updatedRole = store.getRoleByName("test_role2");
      assert.strictEqual(
        updatedRole?.permissions.some(p => p.action === "delete"),
        false
      );
    });
  });

  describe("Audit logging", () => {
    it("记录权限检查日志", () => {
      const user = service.createUser("audited", "audited@test.com");
      service.assignRoleToUser(user.id, "viewer");
      service.checkPermission(user.id, "document", "1", "read");

      const logs = service.getPermissionAuditLog(user.id);
      assert.ok(logs.length > 0);
      assert.strictEqual(logs[0].result, "granted");
    });

    it("记录拒绝日志", () => {
      const user = service.createUser("denied", "denied@test.com");
      service.checkPermission(user.id, "document", "1", "delete");

      const logs = service.getPermissionAuditLog(user.id);
      assert.ok(logs.some(l => l.result === "denied"));
    });
  });
});

/* ------------------------------------------------------------------ */
/*  集成测试                                                           */
/* ------------------------------------------------------------------ */

describe("RBAC 集成场景", () => {
  let store: InMemoryRbacStore;
  let service: RbacService;

  beforeEach(() => {
    store = new InMemoryRbacStore();
    setupDefaultRoles(store);
    service = new RbacService(store);
  });

  it("多角色权限取并集", () => {
    const user = service.createUser("multi_role", "multi@test.com");
    service.assignRoleToUser(user.id, "viewer");
    service.assignRoleToUser(user.id, "editor");

    // viewer 有读权限
    assert.ok(service.checkPermission(user.id, "document", "1", "read"));
    // editor 有写权限
    assert.ok(service.checkPermission(user.id, "document", "1", "create"));
    // 两个角色都没有删除权限
    assert.ok(!service.checkPermission(user.id, "document", "1", "delete"));
  });

  it("角色继承权限累积", () => {
    // user_manager 继承自 admin
    const user = service.createUser("manager", "manager@test.com");
    service.assignRoleToUser(user.id, "user_manager");

    // 有 user 管理的权限
    assert.ok(service.checkPermission(user.id, "user", "1", "manage"));
    // 也继承 admin 的权限 - 可以管理任何资源
    assert.ok(service.checkPermission(user.id, "document", "1", "manage"));
  });

  it("用户激活状态影响权限", () => {
    const user = service.createUser("toggle", "toggle@test.com");
    service.assignRoleToUser(user.id, "admin");

    assert.ok(service.checkPermission(user.id, "user", "1", "manage"));

    service.deactivateUser(user.id);
    assert.ok(!service.checkPermission(user.id, "user", "1", "manage"));

    service.activateUser(user.id);
    assert.ok(service.checkPermission(user.id, "user", "1", "manage"));
  });

  it("完整的用户-角色-权限流程", () => {
    // 1. 创建新角色
    const customRole = service.createRole("content_admin", "Content administrator");
    service.addPermissionToRole("content_admin", {
      resourceType: "document",
      resourceId: "*",
      action: "delete",
    });
    service.addPermissionToRole("content_admin", {
      resourceType: "document",
      resourceId: "*",
      action: "read",
    });

    // 2. 创建用户并分配角色
    const user = service.createUser("content_mgr", "content@test.com");
    service.assignRoleToUser(user.id, "content_admin");

    // 3. 验证权限
    assert.ok(service.checkPermission(user.id, "document", "any-doc", "delete"));
    assert.ok(service.checkPermission(user.id, "document", "any-doc", "read"));
    assert.ok(!service.checkPermission(user.id, "user", "1", "manage"));

    // 4. 审计日志
    const logs = service.getPermissionAuditLog(user.id);
    assert.ok(logs.length > 0);
  });
});