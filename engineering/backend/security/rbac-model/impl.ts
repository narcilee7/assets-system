/**
 * RBAC Permission Model：基于角色的访问控制实现。
 *
 * 包含：
 * - User、Role、Permission 实体
 * - 角色层级（继承）
 * - 权限检查
 * - 最小权限原则
 */

import { randomUUID } from "crypto";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Action = "create" | "read" | "update" | "delete" | "manage";
export type ResourceType = "user" | "role" | "permission" | "document" | "folder" | "admin";

export interface Permission {
  resourceType: ResourceType;
  resourceId: string | "*";  // "*" 表示匹配所有
  action: Action;
}

export interface User {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  parentRoleId: string | null;  // 角色继承
  permissions: Permission[];
  isSystem: boolean;  // 系统角色不可删除
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ */
/*  RBAC Store（内存实现）                                            */
/* ------------------------------------------------------------------ */

export interface IRbacStore {
  // User operations
  getUser(id: string): User | null;
  getUserByUsername(username: string): User | null;
  createUser(user: Omit<User, "id" | "createdAt" | "updatedAt">): User;
  updateUser(id: string, updates: Partial<User>): User | null;
  deleteUser(id: string): boolean;

  // Role operations
  getRole(id: string): Role | null;
  getRoleByName(name: string): Role | null;
  getAllRoles(): Role[];
  createRole(role: Omit<Role, "id" | "createdAt" | "updatedAt">): Role;
  updateRole(id: string, updates: Partial<Role>): Role | null;
  deleteRole(id: string): boolean;

  // User-Role mapping
  assignRoleToUser(userId: string, roleId: string): boolean;
  removeRoleFromUser(userId: string, roleId: string): boolean;
  getUserRoles(userId: string): Role[];

  // Permission checking
  getUserPermissions(userId: string): Permission[];
  hasPermission(userId: string, permission: Permission): boolean;
}

export class InMemoryRbacStore implements IRbacStore {
  private users = new Map<string, User>();
  private roles = new Map<string, Role>();
  private userRoles = new Map<string, Set<string>>();  // userId -> Set<roleId>

  // -------- User operations --------

  getUser(id: string): User | null {
    return this.users.get(id) ?? null;
  }

  getUserByUsername(username: string): User | null {
    return Array.from(this.users.values()).find(u => u.username === username) ?? null;
  }

  createUser(data: Omit<User, "id" | "createdAt" | "updatedAt">): User {
    const now = Date.now();
    const user: User = {
      ...data,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | null {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = {
      ...user,
      ...updates,
      id: user.id,  // 防止修改 id
      createdAt: user.createdAt,  // 防止修改 createdAt
      updatedAt: Date.now(),
    };
    this.users.set(id, updated);
    return updated;
  }

  deleteUser(id: string): boolean {
    this.userRoles.delete(id);  // 清理角色关联
    return this.users.delete(id);
  }

  // -------- Role operations --------

  getRole(id: string): Role | null {
    const role = this.roles.get(id);
    if (!role) return null;
    return this.enrichRoleWithInheritedPermissions(role);
  }

  getRoleByName(name: string): Role | null {
    const role = Array.from(this.roles.values()).find(r => r.name === name) ?? null;
    if (!role) return null;
    return this.enrichRoleWithInheritedPermissions(role);
  }

  getAllRoles(): Role[] {
    return Array.from(this.roles.values()).map(r => this.enrichRoleWithInheritedPermissions(r));
  }

  createRole(data: Omit<Role, "id" | "createdAt" | "updatedAt">): Role {
    const now = Date.now();
    const role: Role = {
      ...data,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.roles.set(role.id, role);
    return role;
  }

  updateRole(id: string, updates: Partial<Role>): Role | null {
    const role = this.roles.get(id);
    if (!role || role.isSystem) return null;  // 系统角色不可修改
    const updated = {
      ...role,
      ...updates,
      id: role.id,
      createdAt: role.createdAt,
      updatedAt: Date.now(),
    };
    this.roles.set(id, updated);
    return updated;
  }

  deleteRole(id: string): boolean {
    const role = this.roles.get(id);
    if (!role || role.isSystem) return false;  // 系统角色不可删除
    // 清理所有用户的此角色关联
    for (const [userId, roleIds] of this.userRoles.entries()) {
      roleIds.delete(id);
    }
    return this.roles.delete(id);
  }

  // -------- User-Role mapping --------

  assignRoleToUser(userId: string, roleId: string): boolean {
    if (!this.users.has(userId) || !this.roles.has(roleId)) return false;
    const userRoleSet = this.userRoles.get(userId) ?? new Set();
    userRoleSet.add(roleId);
    this.userRoles.set(userId, userRoleSet);
    return true;
  }

  removeRoleFromUser(userId: string, roleId: string): boolean {
    const userRoleSet = this.userRoles.get(userId);
    if (!userRoleSet) return false;
    return userRoleSet.delete(roleId);
  }

  getUserRoles(userId: string): Role[] {
    const roleIds = this.userRoles.get(userId);
    if (!roleIds) return [];
    return Array.from(roleIds)
      .map(rid => this.roles.get(rid))
      .filter((r): r is Role => r !== undefined)
      .map(r => this.enrichRoleWithInheritedPermissions(r));
  }

  // -------- Permission checking --------

  getUserPermissions(userId: string): Permission[] {
    const roles = this.getUserRoles(userId);
    const permMap = new Map<string, Permission>();

    for (const role of roles) {
      for (const perm of role.permissions) {
        const key = `${perm.resourceType}:${perm.resourceId}:${perm.action}`;
        permMap.set(key, perm);
      }
    }

    return Array.from(permMap.values());
  }

  hasPermission(userId: string, permission: Permission): boolean {
    const user = this.users.get(userId);
    if (!user || !user.isActive) return false;

    const permissions = this.getUserPermissions(userId);
    return permissions.some(p => this.permissionImplies(p, permission));
  }

  // -------- Private helpers --------

  /**
   * 递归获取角色继承的权限
   */
  private enrichRoleWithInheritedPermissions(role: Role): Role {
    if (!role.parentRoleId) return role;

    const parentRole = this.roles.get(role.parentRoleId);
    if (!parentRole) return role;

    const enrichedParent = this.enrichRoleWithInheritedPermissions(parentRole);
    const mergedPermissions = this.mergePermissions(
      role.permissions,
      enrichedParent.permissions
    );

    return {
      ...role,
      permissions: mergedPermissions,
    };
  }

  /**
   * 合并权限数组（去重）
   */
  private mergePermissions(base: Permission[], inherited: Permission[]): Permission[] {
    const permMap = new Map<string, Permission>();

    // 先加继承的
    for (const p of inherited) {
      permMap.set(this.permissionKey(p), p);
    }
    // 再加基础的（基础优先，因为更具体）
    for (const p of base) {
      permMap.set(this.permissionKey(p), p);
    }

    return Array.from(permMap.values());
  }

  private permissionKey(p: Permission): string {
    return `${p.resourceType}:${p.resourceId}:${p.action}`;
  }

  /**
   * 权限 A 是否隐含权限 B
   */
  private permissionImplies(a: Permission, b: Permission): boolean {
    // 资源类型必须匹配或 A 是 "*"
    if (a.resourceType !== "*" && a.resourceType !== b.resourceType) return false;
    // 资源 ID 必须匹配或 A 是 "*"
    if (a.resourceId !== "*" && a.resourceId !== b.resourceId) return false;
    // 操作必须匹配或 A 是 "manage"（管理权限隐含所有）
    if (a.action !== "manage" && a.action !== b.action) return false;
    return true;
  }
}

/* ------------------------------------------------------------------ */
/*  RBAC Service                                                       */
/* ------------------------------------------------------------------ */

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  result: "granted" | "denied";
  timestamp: number;
  ipAddress?: string;
}

export interface IRbacService {
  // Permission checks
  checkPermission(userId: string, resourceType: ResourceType, resourceId: string, action: Action): boolean;
  checkPermissionDetailed(userId: string, resourceType: ResourceType, resourceId: string, action: Action): {
    allowed: boolean;
    reason: string;
    matchedPermissions: Permission[];
  };

  // User management
  createUser(username: string, email: string): User;
  deactivateUser(userId: string): boolean;
  activateUser(userId: string): boolean;

  // Role management
  createRole(name: string, description: string, parentRoleName?: string): Role;
  assignRoleToUser(userId: string, roleName: string): boolean;
  revokeRoleFromUser(userId: string, roleName: string): boolean;

  // Permission management
  addPermissionToRole(roleName: string, permission: Permission): boolean;
  removePermissionFromRole(roleName: string, permission: Permission): boolean;

  // Audit
  getPermissionAuditLog(userId: string): AuditLog[];
}

export class RbacService implements IRbacService {
  constructor(
    private store: IRbacStore,
    private auditLogs: AuditLog[] = []
  ) {}

  checkPermission(userId: string, resourceType: ResourceType, resourceId: string, action: Action): boolean {
    const result = this.checkPermissionDetailed(userId, resourceType, resourceId, action);
    this.logAudit(userId, "check", resourceType, resourceId, action, result.allowed);
    return result.allowed;
  }

  checkPermissionDetailed(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
    action: Action
  ): { allowed: boolean; reason: string; matchedPermissions: Permission[] } {
    const user = this.store.getUser(userId);
    if (!user) {
      return { allowed: false, reason: "User not found", matchedPermissions: [] };
    }
    if (!user.isActive) {
      return { allowed: false, reason: "User is inactive", matchedPermissions: [] };
    }

    const permission: Permission = { resourceType, resourceId, action };
    const userPermissions = this.store.getUserPermissions(userId);
    const matchedPermissions = userPermissions.filter(p => this.permissionImplies(p, permission));

    if (matchedPermissions.length > 0) {
      return { allowed: true, reason: "Permission granted", matchedPermissions };
    }

    return { allowed: false, reason: "No matching permission found", matchedPermissions: [] };
  }

  createUser(username: string, email: string): User {
    return this.store.createUser({ username, email, isActive: true });
  }

  deactivateUser(userId: string): boolean {
    const user = this.store.updateUser(userId, { isActive: false });
    return user !== null;
  }

  activateUser(userId: string): boolean {
    const user = this.store.updateUser(userId, { isActive: true });
    return user !== null;
  }

  createRole(name: string, description: string, parentRoleName?: string): Role {
    let parentRoleId: string | null = null;

    if (parentRoleName) {
      const parentRole = this.store.getRoleByName(parentRoleName);
      if (parentRole) {
        parentRoleId = parentRole.id;
      }
    }

    return this.store.createRole({
      name,
      description,
      parentRoleId,
      permissions: [],
      isSystem: false,
    });
  }

  assignRoleToUser(userId: string, roleName: string): boolean {
    const role = this.store.getRoleByName(roleName);
    if (!role) return false;
    return this.store.assignRoleToUser(userId, role.id);
  }

  revokeRoleFromUser(userId: string, roleName: string): boolean {
    const role = this.store.getRoleByName(roleName);
    if (!role) return false;
    return this.store.removeRoleFromUser(userId, role.id);
  }

  addPermissionToRole(roleName: string, permission: Permission): boolean {
    const role = this.store.getRoleByName(roleName);
    if (!role) return false;

    const updatedPermissions = [...role.permissions, permission];
    return this.store.updateRole(role.id, { permissions: updatedPermissions }) !== null;
  }

  removePermissionFromRole(roleName: string, permission: Permission): boolean {
    const role = this.store.getRoleByName(roleName);
    if (!role) return false;

    const updatedPermissions = role.permissions.filter(
      p => !(p.resourceType === permission.resourceType &&
             p.resourceId === permission.resourceId &&
             p.action === permission.action)
    );
    return this.store.updateRole(role.id, { permissions: updatedPermissions }) !== null;
  }

  getPermissionAuditLog(userId: string): AuditLog[] {
    return this.auditLogs.filter(log => log.userId === userId);
  }

  private logAudit(
    userId: string,
    action: string,
    resourceType: ResourceType,
    resourceId: string,
    requestedAction: Action,
    result: boolean
  ): void {
    this.auditLogs.push({
      id: randomUUID(),
      userId,
      action,
      resource: resourceType,
      resourceId,
      result: result ? "granted" : "denied",
      timestamp: Date.now(),
    });
  }

  private permissionImplies(a: Permission, b: Permission): boolean {
    // 资源类型必须匹配或 A 是 "*"
    if (a.resourceType !== "*" && a.resourceType !== b.resourceType) return false;
    // 资源 ID 必须匹配或 A 是 "*"
    if (a.resourceId !== "*" && a.resourceId !== b.resourceId) return false;
    // manage 隐含所有操作
    if (a.action === "manage") return true;
    // 操作必须完全匹配
    if (a.action !== b.action) return false;
    return true;
  }
}

/* ------------------------------------------------------------------ */
/*  Default Roles Setup                                                */
/* ------------------------------------------------------------------ */

export function setupDefaultRoles(store: IRbacStore): void {
  // 系统管理员 - 最高权限
  const adminRole = store.createRole({
    name: "admin",
    description: "System administrator with full access",
    parentRoleId: null,
    permissions: [
      { resourceType: "*", resourceId: "*", action: "manage" },
    ],
    isSystem: true,
  });

  // 管理员 - 继承自 admin
  store.createRole({
    name: "user_manager",
    description: "User management administrator",
    parentRoleId: adminRole.id,
    permissions: [
      { resourceType: "user", resourceId: "*", action: "manage" },
      { resourceType: "role", resourceId: "*", action: "read" },
    ],
    isSystem: true,
  });

  // 内容编辑 - 文档读写
  store.createRole({
    name: "editor",
    description: "Content editor with document management access",
    parentRoleId: null,
    permissions: [
      { resourceType: "document", resourceId: "*", action: "read" },
      { resourceType: "document", resourceId: "*", action: "create" },
      { resourceType: "document", resourceId: "*", action: "update" },
      { resourceType: "folder", resourceId: "*", action: "read" },
      { resourceType: "folder", resourceId: "*", action: "create" },
    ],
    isSystem: false,
  });

  // 查看者 - 只读
  store.createRole({
    name: "viewer",
    description: "Read-only access",
    parentRoleId: null,
    permissions: [
      { resourceType: "document", resourceId: "*", action: "read" },
      { resourceType: "folder", resourceId: "*", action: "read" },
    ],
    isSystem: false,
  });
}