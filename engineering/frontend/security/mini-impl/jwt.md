# 手写 JWT

## 1. JWT 结构与编码

```javascript
// mini-jwt.js

function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  // 补全 padding
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return atob(base64);
}

// ============ JWT 生成 ============

function createJWT(payload, secret, expiresIn = 3600) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,                    // 签发时间
    exp: now + expiresIn,        // 过期时间
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const message = `${encodedHeader}.${encodedPayload}`;
  const signature = hmacSha256(message, secret);

  return `${message}.${signature}`;
}

// ============ HMAC-SHA256 ============

async function hmacSha256(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// ============ JWT 验证 ============

async function verifyJWT(token, secret) {
  const [headerB64, payloadB64, signature] = token.split('.');

  if (!headerB64 || !payloadB64 || !signature) {
    throw new Error('Invalid token format');
  }

  // 1. 验证签名
  const message = `${headerB64}.${payloadB64}`;
  const expectedSignature = await hmacSha256(message, secret);

  if (signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  // 2. 解析 payload
  const payload = JSON.parse(base64UrlDecode(payloadB64));

  // 3. 检查过期
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('Token expired');
  }

  // 4. 检查生效时间
  if (payload.nbf && payload.nbf > now) {
    throw new Error('Token not yet valid');
  }

  return payload;
}

// ============ 使用示例 ============

(async () => {
  const secret = 'your-256-bit-secret-key-here';

  const token = createJWT(
    { sub: 'user123', role: 'user' },
    secret,
    3600  // 1 小时过期
  );
  console.log('Token:', token);

  try {
    const payload = await verifyJWT(token, secret);
    console.log('Verified:', payload);
  } catch (err) {
    console.error('Invalid:', err.message);
  }
})();
```

## 2. 安全陷阱检测

```javascript
function safeDecodeJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');

  const header = JSON.parse(base64UrlDecode(parts[0]));

  // ❌ 检测 none 算法攻击
  if (header.alg === 'none') {
    throw new Error('Insecure algorithm: none');
  }

  // ❌ 检测弱算法
  const WEAK_ALGORITHMS = ['none', 'HS1', 'RS1'];
  if (WEAK_ALGORITHMS.includes(header.alg)) {
    throw new Error(`Weak algorithm: ${header.alg}`);
  }

  // ❌ 检测算法混淆（alg: RS256 但用 HMAC 验证）
  // 服务端应严格限定允许的算法列表
  const ALLOWED_ALGORITHMS = ['HS256', 'HS384', 'HS512', 'RS256'];
  if (!ALLOWED_ALGORITHMS.includes(header.alg)) {
    throw new Error(`Unsupported algorithm: ${header.alg}`);
  }

  return header;
}
```

## 3. Refresh Token 机制

```javascript
// 双 Token 体系

function createTokenPair(userId, accessSecret, refreshSecret) {
  const accessToken = createJWT(
    { sub: userId, type: 'access' },
    accessSecret,
    900  // 15 分钟
  );

  const refreshToken = createJWT(
    { sub: userId, type: 'refresh', jti: generateToken() },  // 唯一标识
    refreshSecret,
    7 * 24 * 3600  // 7 天
  );

  return { accessToken, refreshToken };
}

// Refresh Token 轮换（每次使用都生成新的）
// 服务端存储 refreshToken 的 jti -> userId 映射
// 检测到同一个 refreshToken 被使用两次 -> 盗用，吊销所有 Token
```
