# 手写 RBAC 权限引擎

## 目标

实现一个简化版 RBAC 引擎，支持：
1. 用户-角色-权限模型
2. 角色继承（层级）
3. 权限检查（支持通配符）
4. 动态权限计算
5. 策略缓存

## 实现

### Node.js 版本

```javascript
// rbac-engine.js

class RBACEngine {
  constructor(options = {}) {
    this.users = new Map();       // userId -> Set(roleIds)
    this.roles = new Map();       // roleId -> { permissions: Set(), parent?: roleId }
    this.permissions = new Map(); // permissionId -> { resource, action }
    this.cache = new Map();       // cacheKey -> computed permissions
    this.cacheTTL = options.cacheTTL || 300000; // 5min
    this.useCache = options.useCache !== false;
  }

  // ========== 数据管理 ==========

  addRole(roleId, permissions = [], parentRoleId = null) {
    this.roles.set(roleId, {
      id: roleId,
      permissions: new Set(permissions),
      parent: parentRoleId,
    });
    this._invalidateCache();
    return this;
  }

  addPermission(permissionId, resource, action) {
    this.permissions.set(permissionId, { resource, action });
    return this;
  }

  assignRole(userId, roleId) {
    if (!this.users.has(userId)) {
      this.users.set(userId, new Set());
    }
    this.users.get(userId).add(roleId);
    this._invalidateUserCache(userId);
    return this;
  }

  removeRole(userId, roleId) {
    if (this.users.has(userId)) {
      this.users.get(userId).delete(roleId);
      this._invalidateUserCache(userId);
    }
    return this;
  }

  // ========== 权限计算 ==========

  getUserPermissions(userId) {
    if (this.useCache) {
      const cached = this._getCached(userId);
      if (cached) return cached;
    }

    const userRoles = this.users.get(userId);
    if (!userRoles) return new Set();

    const allPermissions = new Set();
    const visited = new Set();

    for (const roleId of userRoles) {
      this._collectRolePermissions(roleId, allPermissions, visited);
    }

    if (this.useCache) {
      this._setCached(userId, allPermissions);
    }

    return allPermissions;
  }

  _collectRolePermissions(roleId, permissions, visited) {
    if (visited.has(roleId)) return;
    visited.add(roleId);

    const role = this.roles.get(roleId);
    if (!role) return;

    for (const perm of role.permissions) {
      permissions.add(perm);
    }

    if (role.parent) {
      this._collectRolePermissions(role.parent, permissions, visited);
    }
  }

  // ========== 权限检查 ==========

  can(userId, resource, action) {
    const permissions = this.getUserPermissions(userId);

    for (const permId of permissions) {
      const perm = this.permissions.get(permId);
      if (!perm) continue;

      if (this._match(perm.resource, resource) && this._match(perm.action, action)) {
        return true;
      }
    }

    return false;
  }

  canAny(userId, checks) {
    return checks.some(({ resource, action }) => this.can(userId, resource, action));
  }

  canAll(userId, checks) {
    return checks.every(({ resource, action }) => this.can(userId, resource, action));
  }

  _match(pattern, value) {
    if (pattern === '*') return true;
    if (pattern === value) return true;

    // 通配符匹配: user:* 匹配 user:read, user:write
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return value.startsWith(prefix + ':');
    }

    return false;
  }

  // ========== 中间件适配 ==========

  middleware() {
    return (requiredResource, requiredAction) => {
      return (req, res, next) => {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!this.can(userId, requiredResource, requiredAction)) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        // 将权限附加到请求
        req.permissions = this.getUserPermissions(userId);
        next();
      };
    };
  }

  // ========== 缓存管理 ==========

  _getCached(userId) {
    const entry = this.cache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      return null;
    }
    return entry.permissions;
  }

  _setCached(userId, permissions) {
    this.cache.set(userId, {
      permissions: new Set(permissions),
      expiresAt: Date.now() + this.cacheTTL,
    });
  }

  _invalidateCache() {
    this.cache.clear();
  }

  _invalidateUserCache(userId) {
    this.cache.delete(userId);
  }

  // ========== 调试 ==========

  dump() {
    return {
      users: Object.fromEntries(
        Array.from(this.users.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      roles: Object.fromEntries(
        Array.from(this.roles.entries()).map(([k, v]) => [
          k,
          { ...v, permissions: Array.from(v.permissions) },
        ])
      ),
      permissions: Object.fromEntries(this.permissions),
    };
  }
}

// ========== 使用 ==========

const rbac = new RBACEngine({ cacheTTL: 60000 });

// 定义权限
rbac
  .addPermission('user:read', 'user', 'read')
  .addPermission('user:write', 'user', 'write')
  .addPermission('user:delete', 'user', 'delete')
  .addPermission('post:read', 'post', 'read')
  .addPermission('post:write', 'post', 'write')
  .addPermission('admin:all', '*', '*');

// 定义角色
rbac
  .addRole('guest', ['post:read'])
  .addRole('user', ['user:read', 'post:read', 'post:write'])
  .addRole('moderator', ['post:write'], 'user')  // 继承 user
  .addRole('admin', ['admin:all'], 'moderator');   // 继承 moderator

// 分配角色
rbac
  .assignRole('alice', 'admin')
  .assignRole('bob', 'user')
  .assignRole('charlie', 'guest');

// 权限检查
console.log(rbac.can('alice', 'user', 'delete'));  // true (admin:all 通配)
console.log(rbac.can('bob', 'post', 'write'));      // true
console.log(rbac.can('bob', 'user', 'delete'));     // false
console.log(rbac.can('charlie', 'post', 'read'));   // true

module.exports = { RBACEngine };
```

### Python 版本

```python
# rbac_engine.py
from typing import Set, Dict, List, Optional
from dataclasses import dataclass, field
from fnmatch import fnmatch


@dataclass
class Permission:
    id: str
    resource: str
    action: str


@dataclass
class Role:
    id: str
    permissions: Set[str] = field(default_factory=set)
    parent: Optional[str] = None


class RBACEngine:
    def __init__(self, cache_ttl: float = 300):
        self.users: Dict[str, Set[str]] = {}
        self.roles: Dict[str, Role] = {}
        self.permissions: Dict[str, Permission] = {}
        self._cache: Dict[str, Set[str]] = {}
        self._cache_ttl = cache_ttl
        self._cache_expiry: Dict[str, float] = {}

    def add_role(self, role_id: str, permissions: List[str] = None, parent: Optional[str] = None):
        self.roles[role_id] = Role(
            id=role_id,
            permissions=set(permissions or []),
            parent=parent,
        )
        self._invalidate_cache()

    def add_permission(self, perm_id: str, resource: str, action: str):
        self.permissions[perm_id] = Permission(id=perm_id, resource=resource, action=action)

    def assign_role(self, user_id: str, role_id: str):
        if user_id not in self.users:
            self.users[user_id] = set()
        self.users[user_id].add(role_id)
        self._invalidate_user_cache(user_id)

    def remove_role(self, user_id: str, role_id: str):
        if user_id in self.users:
            self.users[user_id].discard(role_id)
            self._invalidate_user_cache(user_id)

    def get_user_permissions(self, user_id: str) -> Set[str]:
        cached = self._get_cached(user_id)
        if cached is not None:
            return cached

        user_roles = self.users.get(user_id, set())
        all_perms = set()
        visited = set()

        for role_id in user_roles:
            self._collect_permissions(role_id, all_perms, visited)

        self._set_cached(user_id, all_perms)
        return all_perms

    def _collect_permissions(self, role_id: str, perms: Set[str], visited: Set[str]):
        if role_id in visited:
            return
        visited.add(role_id)

        role = self.roles.get(role_id)
        if not role:
            return

        perms.update(role.permissions)

        if role.parent:
            self._collect_permissions(role.parent, perms, visited)

    def can(self, user_id: str, resource: str, action: str) -> bool:
        permissions = self.get_user_permissions(user_id)

        for perm_id in permissions:
            perm = self.permissions.get(perm_id)
            if not perm:
                continue

            if self._match(perm.resource, resource) and self._match(perm.action, action):
                return True

        return False

    def can_any(self, user_id: str, checks: List[dict]) -> bool:
        return any(self.can(user_id, c["resource"], c["action"]) for c in checks)

    def can_all(self, user_id: str, checks: List[dict]) -> bool:
        return all(self.can(user_id, c["resource"], c["action"]) for c in checks)

    def _match(self, pattern: str, value: str) -> bool:
        if pattern == "*":
            return True
        if pattern == value:
            return True
        return fnmatch(value, pattern)

    def _get_cached(self, user_id: str) -> Optional[Set[str]]:
        import time
        if user_id not in self._cache:
            return None
        if time.time() > self._cache_expiry.get(user_id, 0):
            del self._cache[user_id]
            return None
        return set(self._cache[user_id])

    def _set_cached(self, user_id: str, perms: Set[str]):
        import time
        self._cache[user_id] = perms
        self._cache_expiry[user_id] = time.time() + self._cache_ttl

    def _invalidate_cache(self):
        self._cache.clear()
        self._cache_expiry.clear()

    def _invalidate_user_cache(self, user_id: str):
        self._cache.pop(user_id, None)
        self._cache_expiry.pop(user_id, None)


# 使用
rbac = RBACEngine(cache_ttl=60)

rbac.add_permission("user:read", "user", "read")
rbac.add_permission("user:write", "user", "write")
rbac.add_permission("admin:all", "*", "*")

rbac.add_role("user", ["user:read"])
rbac.add_role("admin", ["admin:all"], parent="user")

rbac.assign_role("alice", "admin")
rbac.assign_role("bob", "user")

assert rbac.can("alice", "user", "write") is True
assert rbac.can("bob", "user", "write") is False
assert rbac.can("alice", "any-resource", "any-action") is True
```
