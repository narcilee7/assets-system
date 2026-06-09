# 手写密码哈希系统

## 目标

实现一个简化版密码哈希系统，支持：
1. PBKDF2（NIST 推荐）
2. Argon2id（现代推荐）
3. 随机盐值
4. 自适应成本因子
5. 哈希格式标准化（Modular Crypt Format）

## 实现

### Node.js 版本（基于 crypto）

```javascript
// password-hash.js

const crypto = require('crypto');

class PasswordHasher {
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'pbkdf2'; // pbkdf2 | scrypt | argon2
    this.pbkdf2Iterations = options.pbkdf2Iterations || 600000;
    this.pbkdf2KeyLen = options.pbkdf2KeyLen || 32;
    this.pbkdf2Digest = options.pbkdf2Digest || 'sha256';
    this.saltLength = options.saltLength || 16;
  }

  // 生成随机盐
  generateSalt(length = this.saltLength) {
    return crypto.randomBytes(length);
  }

  // PBKDF2 哈希
  hashPBKDF2(password, salt) {
    const hash = crypto.pbkdf2Sync(
      password,
      salt,
      this.pbkdf2Iterations,
      this.pbkdf2KeyLen,
      this.pbkdf2Digest
    );

    // Modular Crypt Format: $pbkdf2-sha256$iterations$salt$hash
    return `$pbkdf2-${this.pbkdf2Digest}$${this.pbkdf2Iterations}$${salt.toString('base64')}$${hash.toString('base64')}`;
  }

  // Scrypt 哈希
  hashScrypt(password, salt) {
    const hash = crypto.scryptSync(password, salt, 32, {
      N: 16384,
      r: 8,
      p: 1,
    });
    return `$scrypt$N=16384,r=8,p=1$${salt.toString('base64')}$${hash.toString('base64')}`;
  }

  // 通用哈希
  hash(password) {
    const salt = this.generateSalt();

    switch (this.algorithm) {
      case 'pbkdf2':
        return this.hashPBKDF2(password, salt);
      case 'scrypt':
        return this.hashScrypt(password, salt);
      default:
        throw new Error(`Unsupported algorithm: ${this.algorithm}`);
    }
  }

  // 验证
  verify(password, hashed) {
    const parsed = this.parse(hashed);
    if (!parsed) return false;

    let computed;
    switch (parsed.algorithm) {
      case 'pbkdf2-sha256':
        computed = crypto.pbkdf2Sync(
          password,
          parsed.salt,
          parsed.iterations,
          this.pbkdf2KeyLen,
          'sha256'
        );
        break;
      case 'scrypt':
        computed = crypto.scryptSync(password, parsed.salt, 32, {
          N: parsed.params.N,
          r: parsed.params.r,
          p: parsed.params.p,
        });
        break;
      default:
        return false;
    }

    return crypto.timingSafeEqual(computed, parsed.hash);
  }

  // 解析 MCF 格式
  parse(hashed) {
    const parts = hashed.split('$');
    if (parts.length < 2) return null;

    const algorithm = parts[1];

    if (algorithm.startsWith('pbkdf2')) {
      // $pbkdf2-sha256$600000$salt$hash
      return {
        algorithm,
        iterations: parseInt(parts[2], 10),
        salt: Buffer.from(parts[3], 'base64'),
        hash: Buffer.from(parts[4], 'base64'),
      };
    }

    if (algorithm === 'scrypt') {
      // $scrypt$N=16384,r=8,p=1$salt$hash
      const params = {};
      parts[2].split(',').forEach((p) => {
        const [k, v] = p.split('=');
        params[k] = parseInt(v, 10);
      });
      return {
        algorithm,
        params,
        salt: Buffer.from(parts[3], 'base64'),
        hash: Buffer.from(parts[4], 'base64'),
      };
    }

    return null;
  }

  // 检查是否需要重新哈希（参数升级）
  needsRehash(hashed) {
    const parsed = this.parse(hashed);
    if (!parsed) return true;

    if (parsed.algorithm.startsWith('pbkdf2')) {
      return parsed.iterations < this.pbkdf2Iterations;
    }

    return false;
  }
}

// ========== 使用 ==========

const hasher = new PasswordHasher({
  algorithm: 'pbkdf2',
  pbkdf2Iterations: 600000,
});

// 哈希
const hash = hasher.hash('user_password');
console.log('Hash:', hash);

// 验证
const isValid = hasher.verify('user_password', hash);
console.log('Valid:', isValid);

// 参数升级检查
if (hasher.needsRehash(hash)) {
  const newHash = hasher.hash('user_password');
  // 更新数据库
}

module.exports = { PasswordHasher };
```

### Python 版本

```python
# password_hash.py
import hashlib
import hmac
import os
import base64
import secrets
from typing import Optional


class PasswordHasher:
    """密码哈希器（PBKDF2 + Scrypt）"""

    def __init__(self,
                 algorithm: str = "pbkdf2",
                 pbkdf2_iterations: int = 600_000,
                 pbkdf2_keylen: int = 32,
                 pbkdf2_digest: str = "sha256",
                 salt_length: int = 16):
        self.algorithm = algorithm
        self.pbkdf2_iterations = pbkdf2_iterations
        self.pbkdf2_keylen = pbkdf2_keylen
        self.pbkdf2_digest = pbkdf2_digest
        self.salt_length = salt_length

    def _generate_salt(self) -> bytes:
        return secrets.token_bytes(self.salt_length)

    def hash(self, password: str) -> str:
        salt = self._generate_salt()

        if self.algorithm == "pbkdf2":
            return self._hash_pbkdf2(password, salt)
        elif self.algorithm == "scrypt":
            return self._hash_scrypt(password, salt)
        else:
            raise ValueError(f"Unsupported algorithm: {self.algorithm}")

    def _hash_pbkdf2(self, password: str, salt: bytes) -> str:
        hash_bytes = hashlib.pbkdf2_hmac(
            self.pbkdf2_digest,
            password.encode("utf-8"),
            salt,
            self.pbkdf2_iterations,
            dklen=self.pbkdf2_keylen,
        )
        return (
            f"$pbkdf2-{self.pbkdf2_digest}"
            f"${self.pbkdf2_iterations}"
            f"${base64.b64encode(salt).decode()}"
            f"${base64.b64encode(hash_bytes).decode()}"
        )

    def _hash_scrypt(self, password: str, salt: bytes) -> str:
        import hashlib
        hash_bytes = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=16384,
            r=8,
            p=1,
            dklen=32,
        )
        return (
            f"$scrypt$N=16384,r=8,p=1"
            f"${base64.b64encode(salt).decode()}"
            f"${base64.b64encode(hash_bytes).decode()}"
        )

    def verify(self, password: str, hashed: str) -> bool:
        parsed = self._parse(hashed)
        if not parsed:
            return False

        if parsed["algorithm"].startswith("pbkdf2"):
            computed = hashlib.pbkdf2_hmac(
                parsed["digest"],
                password.encode("utf-8"),
                parsed["salt"],
                parsed["iterations"],
                dklen=len(parsed["hash"]),
            )
        elif parsed["algorithm"] == "scrypt":
            computed = hashlib.scrypt(
                password.encode("utf-8"),
                salt=parsed["salt"],
                n=parsed["params"]["N"],
                r=parsed["params"]["r"],
                p=parsed["params"]["p"],
                dklen=32,
            )
        else:
            return False

        return hmac.compare_digest(computed, parsed["hash"])

    def _parse(self, hashed: str) -> Optional[dict]:
        parts = hashed.split("$")
        if len(parts) < 2:
            return None

        algorithm = parts[1]

        if algorithm.startswith("pbkdf2"):
            digest = algorithm.split("-")[1] if "-" in algorithm else "sha256"
            return {
                "algorithm": algorithm,
                "digest": digest,
                "iterations": int(parts[2]),
                "salt": base64.b64decode(parts[3]),
                "hash": base64.b64decode(parts[4]),
            }

        if algorithm == "scrypt":
            params = {}
            for p in parts[2].split(","):
                k, v = p.split("=")
                params[k] = int(v)
            return {
                "algorithm": algorithm,
                "params": params,
                "salt": base64.b64decode(parts[3]),
                "hash": base64.b64decode(parts[4]),
            }

        return None

    def needs_rehash(self, hashed: str) -> bool:
        parsed = self._parse(hashed)
        if not parsed:
            return True

        if parsed["algorithm"].startswith("pbkdf2"):
            return parsed["iterations"] < self.pbkdf2_iterations

        return False


# 使用
hasher = PasswordHasher(algorithm="pbkdf2", pbkdf2_iterations=600_000)
hash_value = hasher.hash("my_password")
print(f"Hash: {hash_value}")

assert hasher.verify("my_password", hash_value) is True
assert hasher.verify("wrong_password", hash_value) is False
```
