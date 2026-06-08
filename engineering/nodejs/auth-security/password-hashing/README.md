# Password Hashing

密码是用户最敏感的数据，必须使用单向哈希 + 盐值存储，绝不能明文或可逆加密。

## 方案对比

| 算法 | 推荐 | 说明 |
| --- | --- | --- |
| bcrypt | ✅ 通用 | 基于 Blowfish，成本因子可调 |
| argon2 | ✅ 新系统首选 | 内存困难，抗 GPU/ASIC |
| scrypt | ✅ | 内存困难，早期方案 |
| PBKDF2 | ⚠️ legacy | 迭代次数需足够高（> 100K） |
| MD5/SHA1/SHA256 | ❌ 禁用 | 太快，易被暴力破解 |

## 实现

### bcrypt

```ts
// bcrypt.service.ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // 成本因子，每+1耗时翻倍

export class PasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async needsRehash(hash: string): Promise<boolean> {
    return bcrypt.getRounds(hash) < SALT_ROUNDS;
  }
}
```

### argon2（推荐）

```ts
// argon2.service.ts
import argon2 from 'argon2';

export class Argon2PasswordService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64MB
      timeCost: 3,        // 迭代次数
      parallelism: 4,     // 并行度
    });
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
```

### 密码策略

```ts
// password-policy.ts
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[0-9]/, 'Must contain digit')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character');

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const result = passwordSchema.safeParse(password);
  if (result.success) return { valid: true, errors: [] };
  return { valid: false, errors: result.error.issues.map((i) => i.message) };
}
```

## 最佳实践

- 永远不在日志中记录密码（即使错误日志）。
- 使用 `timingSafeEqual` 比较 token，防止时序攻击。
- 定期评估成本因子，随硬件提升而增加。
- 登录失败做速率限制，防止暴力破解。
- 考虑集成 Have I Been Pwned API 检测密码是否已泄露。
