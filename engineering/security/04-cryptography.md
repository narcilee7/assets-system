# 密码学

## 1. 哈希算法

```
密码哈希要求：
├── 单向性：无法从哈希值反推原始密码
├── 抗碰撞：不同输入产生不同哈希
├── 慢速：增加暴力破解成本
└── 加盐：相同密码产生不同哈希

算法选择：
├── ❌ MD5 / SHA1：已过时，碰撞攻击可行
├── ⚠️ SHA256 / SHA512：快，适合数据完整性，不适合密码
├── ✅ bcrypt：自适应成本因子（默认 10 轮）
├── ✅ PBKDF2：NIST 推荐，可配置迭代次数（建议 600K+）
├── ✅ scrypt：内存困难，抗 GPU/ASIC
└── ✅ Argon2：密码哈希竞赛 winner（推荐 Argon2id）
```

```python
# Argon2（推荐）
from argon2 import PasswordHasher

ph = PasswordHasher(
    time_cost=3,      # 迭代次数
    memory_cost=65536, # 64 MB
    parallelism=4,     # 并行度
    hash_len=32,
    salt_len=16
)

# 哈希
hash_value = ph.hash("user_password")

# 验证
try:
    ph.verify(hash_value, "user_password")
    # 检查是否需要重新哈希（参数升级）
    if ph.check_needs_rehash(hash_value):
        new_hash = ph.hash("user_password")
        # 更新数据库
except argon2.exceptions.VerifyMismatchError:
    raise ValueError("Invalid password")

# bcrypt
import bcrypt

salt = bcrypt.gensalt(rounds=12)
hash_value = bcrypt.hashpw(b"user_password", salt)

if bcrypt.checkpw(b"user_password", hash_value):
    print("Valid")
```

## 2. 对称加密

```python
# AES-GCM（认证加密，推荐）
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

# 生成密钥（256-bit）
key = AESGCM.generate_key(bit_length=256)
aesgcm = AESGCM(key)

# 加密（每次使用新 nonce）
nonce = os.urandom(12)  # 96-bit for GCM
plaintext = b"sensitive data"
associated_data = b"user:123"  # 可选：绑定上下文

ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)

# 存储：nonce + ciphertext（nonce 不需要保密但需要唯一）
stored = nonce + ciphertext

# 解密
nonce = stored[:12]
ciphertext = stored[12:]
plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data)

# ChaCha20-Poly1305（移动/低功耗设备推荐）
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305

key = ChaCha20Poly1305.generate_key()
chacha = ChaCha20Poly1305(key)
nonce = os.urandom(12)
ciphertext = chacha.encrypt(nonce, b"data", None)
```

## 3. 非对称加密与签名

```python
# RSA 密钥生成
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization

private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=4096  # 最小 2048
)
public_key = private_key.public_key()

# 序列化
pem_private = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.BestAvailableEncryption(b'my-password')
)

pem_public = public_key.public_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PublicFormat.SubjectPublicKeyInfo
)

# RSA 加密（仅适合小数据，用于加密对称密钥）
message = b"secret key"
encrypted = public_key.encrypt(
    message,
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    )
)

decrypted = private_key.decrypt(
    encrypted,
    padding.OAEP(
        mgf=padding.MGF1(algorithm=hashes.SHA256()),
        algorithm=hashes.SHA256(),
        label=None
    )
)

# 数字签名
from cryptography.hazmat.primitives.asymmetric import utils

signature = private_key.sign(
    message,
    padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH
    ),
    hashes.SHA256()
)

# 验证签名
public_key.verify(
    signature,
    message,
    padding.PSS(
        mgf=padding.MGF1(hashes.SHA256()),
        salt_length=padding.PSS.MAX_LENGTH
    ),
    hashes.SHA256()
)
```

## 4. 密钥管理

```
密钥管理层次：
├── DEK（Data Encryption Key）：加密数据的密钥
├── KEK（Key Encryption Key）：加密 DEK 的密钥
└── MEK（Master Encryption Key）：由 HSM/KMS 保管

密钥管理策略：
├── 不使用硬编码密钥
├── 使用环境变量或密钥管理系统
├── 密钥轮换（定期更换）
├── 密钥分级（开发/测试/生产隔离）
└── 使用 HSM 或云 KMS

云 KMS 服务：
├── AWS KMS
├── Google Cloud KMS
├── Azure Key Vault
└── HashiCorp Vault（自托管）
```

```python
# AWS KMS 示例
import boto3

kms = boto3.client('kms')

# 生成数据密钥（DEK）
response = kms.generate_data_key(
    KeyId='alias/my-app-key',
    KeySpec='AES_256'
)
plaintext_dek = response['Plaintext']  # 内存中使用
crypted_dek = response['CiphertextBlob']  # 存储在数据库

# 加密数据
aesgcm = AESGCM(plaintext_dek)
nonce = os.urandom(12)
ciphertext = aesgcm.encrypt(nonce, b"sensitive data", None)

# 删除内存中的明文 DEK
del plaintext_dek

# 解密时先解密 DEK
response = kms.decrypt(CiphertextBlob=crypted_dek)
plaintext_dek = response['Plaintext']
```
