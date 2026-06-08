# 手写 JWT 实现

## 目标

实现一个简化版 JWT 生成与验证，支持：
1. HS256 / RS256 签名
2. Header / Payload / Signature 三段结构
3. 过期时间验证
4. 基础声明（iss, sub, aud, exp, iat, nbf）

## 实现

### Node.js 版本

```javascript
// jwt-lite.js

const crypto = require('crypto');

class JWTLite {
  constructor(secretOrKey, options = {}) {
    this.algorithm = options.algorithm || 'HS256';
    this.secret = secretOrKey; // HS256: string, RS256: { privateKey, publicKey }
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.clockTolerance = options.clockTolerance || 0;
  }

  static base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  static base64UrlDecode(str) {
    str += new Array(5 - (str.length % 4)).join('=');
    return Buffer.from(str.replace(/\-/g, '+').replace(/\_/g, '/'), 'base64');
  }

  sign(payload, options = {}) {
    const header = {
      alg: this.algorithm,
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const claims = {
      ...payload,
      iat: payload.iat || now,
    };

    if (options.expiresIn) {
      claims.exp = now + options.expiresIn;
    }
    if (options.notBefore) {
      claims.nbf = now + options.notBefore;
    }
    if (this.issuer) {
      claims.iss = this.issuer;
    }
    if (this.audience) {
      claims.aud = this.audience;
    }

    const headerB64 = JWTLite.base64UrlEncode(JSON.stringify(header));
    const payloadB64 = JWTLite.base64UrlEncode(JSON.stringify(claims));
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = this._sign(signingInput);

    return `${signingInput}.${signature}`;
  }

  verify(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signature] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;

    // 验证签名
    if (!this._verify(signingInput, signature)) {
      throw new Error('Invalid signature');
    }

    // 解析 payload
    const payload = JSON.parse(JWTLite.base64UrlDecode(payloadB64).toString());

    // 验证时间
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && now > payload.exp + this.clockTolerance) {
      throw new Error('Token expired');
    }
    if (payload.nbf && now < payload.nbf - this.clockTolerance) {
      throw new Error('Token not active');
    }
    if (this.issuer && payload.iss !== this.issuer) {
      throw new Error('Invalid issuer');
    }
    if (this.audience && payload.aud !== this.audience) {
      throw new Error('Invalid audience');
    }

    return payload;
  }

  decode(token) {
    const parts = token.split('.');
    return JSON.parse(JWTLite.base64UrlDecode(parts[1]).toString());
  }

  _sign(data) {
    if (this.algorithm === 'HS256') {
      return JWTLite.base64UrlEncode(
        crypto.createHmac('sha256', this.secret).update(data).digest()
      );
    }
    if (this.algorithm === 'RS256') {
      return JWTLite.base64UrlEncode(
        crypto.createSign('RSA-SHA256')
          .update(data)
          .sign(this.secret.privateKey, 'base64')
      );
    }
    throw new Error(`Unsupported algorithm: ${this.algorithm}`);
  }

  _verify(data, signature) {
    if (this.algorithm === 'HS256') {
      const expected = this._sign(data);
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    }
    if (this.algorithm === 'RS256') {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(data);
      return verifier.verify(
        this.secret.publicKey,
        JWTLite.base64UrlDecode(signature)
      );
    }
    throw new Error(`Unsupported algorithm: ${this.algorithm}`);
  }
}

// ========== 使用 ==========

const jwt = new JWTLite('my-secret-key', {
  algorithm: 'HS256',
  issuer: 'my-app',
  audience: 'my-api',
});

const token = jwt.sign({ sub: 'user-123', role: 'admin' }, { expiresIn: 900 });
console.log('Token:', token);

try {
  const payload = jwt.verify(token);
  console.log('Verified:', payload);
} catch (err) {
  console.error('Verify failed:', err.message);
}

module.exports = { JWTLite };
```

### Python 版本

```python
# jwt_lite.py
import json
import base64
import hmac
import hashlib
import time
from typing import Optional, Dict, Any, Union


class JWTLite:
    def __init__(self, secret: Union[str, bytes], algorithm: str = "HS256",
                 issuer: Optional[str] = None, audience: Optional[str] = None,
                 clock_tolerance: int = 0):
        self.secret = secret.encode() if isinstance(secret, str) else secret
        self.algorithm = algorithm
        self.issuer = issuer
        self.audience = audience
        self.clock_tolerance = clock_tolerance

    @staticmethod
    def _base64url_encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

    @staticmethod
    def _base64url_decode(data: str) -> bytes:
        padding = 4 - len(data) % 4
        if padding != 4:
            data += '=' * padding
        return base64.urlsafe_b64decode(data)

    def sign(self, payload: Dict[str, Any], expires_in: Optional[int] = None) -> str:
        header = {"alg": self.algorithm, "typ": "JWT"}
        now = int(time.time())

        claims = {**payload, "iat": payload.get("iat", now)}
        if expires_in:
            claims["exp"] = now + expires_in
        if self.issuer:
            claims["iss"] = self.issuer
        if self.audience:
            claims["aud"] = self.audience

        header_b64 = self._base64url_encode(json.dumps(header, separators=(',', ':')).encode())
        payload_b64 = self._base64url_encode(json.dumps(claims, separators=(',', ':')).encode())
        signing_input = f"{header_b64}.{payload_b64}"

        signature = self._sign(signing_input.encode())
        return f"{signing_input}.{signature}"

    def verify(self, token: str) -> Dict[str, Any]:
        parts = token.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid token format")

        header_b64, payload_b64, signature = parts
        signing_input = f"{header_b64}.{payload_b64}"

        if not self._verify(signing_input.encode(), signature):
            raise ValueError("Invalid signature")

        payload = json.loads(self._base64url_decode(payload_b64))
        now = int(time.time())

        if payload.get("exp") and now > payload["exp"] + self.clock_tolerance:
            raise ValueError("Token expired")
        if payload.get("nbf") and now < payload["nbf"] - self.clock_tolerance:
            raise ValueError("Token not active")
        if self.issuer and payload.get("iss") != self.issuer:
            raise ValueError("Invalid issuer")
        if self.audience and payload.get("aud") != self.audience:
            raise ValueError("Invalid audience")

        return payload

    def decode(self, token: str) -> Dict[str, Any]:
        parts = token.split('.')
        return json.loads(self._base64url_decode(parts[1]))

    def _sign(self, data: bytes) -> str:
        if self.algorithm == "HS256":
            sig = hmac.new(self.secret, data, hashlib.sha256).digest()
            return self._base64url_encode(sig)
        raise ValueError(f"Unsupported algorithm: {self.algorithm}")

    def _verify(self, data: bytes, signature: str) -> bool:
        if self.algorithm == "HS256":
            expected = self._sign(data)
            return hmac.compare_digest(expected, signature)
        raise ValueError(f"Unsupported algorithm: {self.algorithm}")


# 使用
jwt = JWTLite("my-secret-key", issuer="my-app", audience="my-api")
token = jwt.sign({"sub": "user-123", "role": "admin"}, expires_in=900)
payload = jwt.verify(token)
```
