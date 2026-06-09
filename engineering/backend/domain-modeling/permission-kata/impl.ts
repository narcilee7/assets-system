/**
 * Permission Domain Model：权限系统领域建模。
 *
 * 展示：
 * - Entity: User, Role
 * - Value Object: Permission, ResourceId, Action
 * - Aggregate: UserRoleAssignment
 * - Domain Event: RoleAssigned, RoleRevoked
 * - Domain Service: PermissionService
 */

import { randomUUID } from "crypto";

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * 操作类型
 */
export type Action = "create" | "read" | "update" | "delete" | "admin";

/**
 * 资源标识（值对象）
 */
export class ResourceId {
  constructor(
    public readonly type: string,
    public readonly id: string
  ) {
    if (!type || !id) throw new Error("ResourceId requires type and id");
  }

  equals(other: ResourceId): boolean {
    return this.type === other.type && this.id === other.id;
  }

  /**
   * 检查是否匹配（支持通配符 *）
   */
  matches(other: ResourceId): boolean {
    const typeMatch = this.type === "*" || this.type === other.type;
    const idMatch = this.id === "*" || this.id === other.id;
    return typeMatch && idMatch;
  }

  toString(): string {
    return `${this.type}:${this.id}`;
  }

  static fromString(s: string): ResourceId {
    const [type, id] = s.split(":");
    return new ResourceId(type, id);
  }
}

/**
 * 权限（值对象）
 * 由资源 + 操作组成，无身份，靠值相等
 */
export class Permission {
  constructor(
    public readonly resource: ResourceId,
    public readonly action: Action
  ) {}

  equals(other: Permission): boolean {
    return this.resource.equals(other.resource) && this.action === other.action;
  }

  implies(other: Permission): boolean {
    // admin 可以做任何操作
    if (this.action === "admin") return true;
    // 资源必须匹配（支持通配符）
    if (!this.resource.matches(other.resource)) return false;
    // 相同资源，相同或更高权限
    // 权限层次：admin > delete > update > read > create
    const hierarchy: Record<Action, number> = {
      create: 1,
      read: 2,
      update: 3,
      delete: 4,
      admin: 5,
    };
    if (this.action === other.action) return true;
    // 高级权限隐含低级权限
    return hierarchy[this.action] > hierarchy[other.action];
  }

  toString(): string {
    return `${this.resource}:${this.action}`;
  }
}

/**
 * 角色类型（值对象）
 */
export type RoleType = "owner" | "admin" | "member" | "guest";

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * 用户（实体）
 */
export interface UserProps {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  updatedAt: number;
}

export class User {
  constructor(private props: UserProps) {}

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get email(): string { return this.props.email; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  updateName(name: string): void {
    if (!name || name.length < 1) throw new Error("Name cannot be empty");
    this.props.name = name;
    this.props.updatedAt = Date.now();
  }

  toSnapshot(): UserProps {
    return { ...this.props };
  }

  static create(name: string, email: string): User {
    const now = Date.now();
    return new User({
      id: randomUUID(),
      name,
      email,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * 角色（实体）
 */
export interface RoleProps {
  id: string;
  name: string;
  type: RoleType;
  permissions: Permission[];
  createdAt: number;
  updatedAt: number;
}

export class Role {
  constructor(private props: RoleProps) {}

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get type(): RoleType { return this.props.type; }
  get permissions(): Permission[] { return [...this.props.permissions]; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  /**
   * 添加权限
   */
  addPermission(permission: Permission): void {
    if (this.props.permissions.some(p => p.equals(permission))) {
      return; // 已存在，幂等
    }
    this.props.permissions.push(permission);
    this.props.updatedAt = Date.now();
  }

  /**
   * 移除权限
   */
  removePermission(resource: ResourceId, action: Action): void {
    this.props.permissions = this.props.permissions.filter(
      p => !(p.resource.equals(resource) && p.action === action)
    );
    this.props.updatedAt = Date.now();
  }

  /**
   * 检查是否拥有指定权限
   */
  hasPermission(permission: Permission): boolean {
    return this.props.permissions.some(p => p.implies(permission));
  }

  toSnapshot(): RoleProps {
    return {
      ...this.props,
      permissions: [...this.props.permissions],
    };
  }

  static create(name: string, type: RoleType): Role {
    const now = Date.now();
    return new Role({
      id: randomUUID(),
      name,
      type,
      permissions: [],
      createdAt: now,
      updatedAt: now,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Aggregate Root: UserRoleAssignment                                 */
/* ------------------------------------------------------------------ */

export interface UserRoleAssignmentProps {
  id: string;
  userId: string;
  roleId: string;
  grantedAt: number;
  grantedBy: string;
  expiresAt: number | null;
}

export class UserRoleAssignment {
  constructor(private props: UserRoleAssignmentProps) {}

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get roleId(): string { return this.props.roleId; }
  get grantedAt(): number { return this.props.grantedAt; }
  get grantedBy(): string { return this.props.grantedBy; }
  get expiresAt(): number | null { return this.props.expiresAt; }

  /**
   * 检查是否过期
   */
  isExpired(): boolean {
    if (this.props.expiresAt === null) return false;
    return Date.now() > this.props.expiresAt;
  }

  toSnapshot(): UserRoleAssignmentProps {
    return { ...this.props };
  }

  static create(
    userId: string,
    roleId: string,
    grantedBy: string,
    expiresAt: number | null = null
  ): UserRoleAssignment {
    return new UserRoleAssignment({
      id: randomUUID(),
      userId,
      roleId,
      grantedAt: Date.now(),
      grantedBy,
      expiresAt,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Domain Events                                                      */
/* ------------------------------------------------------------------ */

export type DomainEvent =
  | RoleAssigned
  | RoleRevoked
  | PermissionGranted
  | PermissionDenied;

export class RoleAssigned {
  readonly occurredAt: number;
  readonly eventType = "RoleAssigned" as const;

  constructor(
    public readonly assignmentId: string,
    public readonly userId: string,
    public readonly roleId: string,
    public readonly grantedBy: string
  ) {
    this.occurredAt = Date.now();
  }
}

export class RoleRevoked {
  readonly occurredAt: number;
  readonly eventType = "RoleRevoked" as const;

  constructor(
    public readonly assignmentId: string,
    public readonly userId: string,
    public readonly roleId: string,
    public readonly revokedBy: string
  ) {
    this.occurredAt = Date.now();
  }
}

export class PermissionGranted {
  readonly occurredAt: number;
  readonly eventType = "PermissionGranted" as const;

  constructor(
    public readonly userId: string,
    public readonly permission: Permission,
    public readonly grantedBy: string
  ) {
    this.occurredAt = Date.now();
  }
}

export class PermissionDenied {
  readonly occurredAt: number;
  readonly eventType = "PermissionDenied" as const;

  constructor(
    public readonly userId: string,
    public readonly permission: Permission,
    public readonly reason: string
  ) {
    this.occurredAt = Date.now();
  }
}

/* ------------------------------------------------------------------ */
/*  Domain Service: PermissionService                                 */
/* ------------------------------------------------------------------ */

export interface PermissionRepository {
  findUserRoles(userId: string): Promise<UserRoleAssignment[]>;
  findRoleById(roleId: string): Promise<Role | null>;
  findRolesByIds(roleIds: string[]): Promise<Role[]>;
  saveAssignment(assignment: UserRoleAssignment): Promise<void>;
  deleteAssignment(assignmentId: string): Promise<void>;
}

export interface EventStore {
  append(event: DomainEvent): void;
  getEvents(userId: string): DomainEvent[];
}

export class PermissionService {
  constructor(
    private repository: PermissionRepository,
    private eventStore: EventStore
  ) {}

  /**
   * 检查用户是否有指定权限
   */
  async checkPermission(
    userId: string,
    resource: ResourceId,
    action: Action
  ): Promise<boolean> {
    const permission = new Permission(resource, action);
    const roles = await this.getUserRoles(userId);

    for (const role of roles) {
      if (role.hasPermission(permission)) {
        return true;
      }
    }

    this.eventStore.append(new PermissionDenied(userId, permission, "No matching role"));
    return false;
  }

  /**
   * 获取用户的所有有效角色
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const assignments = await this.repository.findUserRoles(userId);

    // 过滤过期分配
    const validAssignments = assignments.filter(a => !a.isExpired());

    if (validAssignments.length === 0) return [];

    const roleIds = validAssignments.map(a => a.roleId);
    return this.repository.findRolesByIds(roleIds);
  }

  /**
   * 获取用户的所有权限
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    const roles = await this.getUserRoles(userId);
    const permissionMap = new Map<string, Permission>();

    for (const role of roles) {
      for (const perm of role.permissions) {
        const key = perm.toString();
        if (!permissionMap.has(key)) {
          permissionMap.set(key, perm);
        }
      }
    }

    return Array.from(permissionMap.values());
  }

  /**
   * 分配角色给用户
   */
  async assignRole(
    userId: string,
    roleId: string,
    grantedBy: string,
    expiresAt: number | null = null
  ): Promise<RoleAssigned> {
    const assignment = UserRoleAssignment.create(userId, roleId, grantedBy, expiresAt);
    await this.repository.saveAssignment(assignment);

    const event = new RoleAssigned(assignment.id, userId, roleId, grantedBy);
    this.eventStore.append(event);

    return event;
  }

  /**
   * 撤销用户的角色
   */
  async revokeRole(
    assignmentId: string,
    userId: string,
    roleId: string,
    revokedBy: string
  ): Promise<RoleRevoked> {
    await this.repository.deleteAssignment(assignmentId);

    const event = new RoleRevoked(assignmentId, userId, roleId, revokedBy);
    this.eventStore.append(event);

    return event;
  }
}

/* ------------------------------------------------------------------ */
/*  In-Memory 实现（测试用）                                          */
/* ------------------------------------------------------------------ */

export class InMemoryPermissionRepository implements PermissionRepository {
  private roles = new Map<string, Role>();
  private assignments = new Map<string, UserRoleAssignment>();

  async findUserRoles(userId: string): Promise<UserRoleAssignment[]> {
    return Array.from(this.assignments.values()).filter(a => a.userId === userId);
  }

  async findRoleById(roleId: string): Promise<Role | null> {
    return this.roles.get(roleId) ?? null;
  }

  async findRolesByIds(roleIds: string[]): Promise<Role[]> {
    return roleIds
      .map(id => this.roles.get(id))
      .filter((r): r is Role => r !== undefined);
  }

  async saveAssignment(assignment: UserRoleAssignment): Promise<void> {
    this.assignments.set(assignment.id, assignment);
  }

  async deleteAssignment(assignmentId: string): Promise<void> {
    this.assignments.delete(assignmentId);
  }

  addRole(role: Role): void {
    this.roles.set(role.id, role);
  }

  clear(): void {
    this.roles.clear();
    this.assignments.clear();
  }
}

export class InMemoryEventStore implements EventStore {
  private events: DomainEvent[] = [];

  append(event: DomainEvent): void {
    this.events.push(event);
  }

  getEvents(userId: string): DomainEvent[] {
    return this.events.filter(e => {
      if (e instanceof RoleAssigned) return e.userId === userId;
      if (e instanceof RoleRevoked) return e.userId === userId;
      if (e instanceof PermissionGranted) return e.userId === userId;
      if (e instanceof PermissionDenied) return e.userId === userId;
      return false;
    });
  }

  clear(): void {
    this.events = [];
  }

  getAllEvents(): DomainEvent[] {
    return this.events;
  }
}