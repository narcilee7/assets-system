"""
mini_engine.py —— 一个 Mini 推理引擎（v0）

目标：用 ~300 行纯 PyTorch 复刻推理引擎的核心骨架，让"KV cache / Prefill-Decode 分离 /
GQA / 采样"从概念变成能跑的代码。

分层：
  层3 计算图:  RMSNorm / RoPE / GQA-Attention(SwiGLU MLP 的 Layer 循环)
  层4 内存:   KVCache —— 预分配大块显存，按位置写入/读出
  层5 调度:   Engine.generate —— prefill 整段一次过，decode 逐 token 追加

刻意没做的（v1 见 README 末尾）：
  - PagedAttention（block 化管理 KV cache）
  - Continuous Batching（多请求拼接调度）
  - 量化 / CUDA / 分布式
"""

import math
import time
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


# ---------------------------------------------------------------- 配置
@dataclass
class MiniConfig:
    vocab_size: int
    dim: int = 256          # 模型宽度
    n_layers: int = 4       # 层数
    n_heads: int = 4        # Q 头数
    n_kv_heads: int = 2     # KV 头数（< n_heads 即 GQA，KV cache 显存减半）
    max_seq_len: int = 256
    rope_theta: float = 10000.0

    @property
    def head_dim(self) -> int:
        return self.dim // self.n_heads


# ---------------------------------------------------------------- 层3: 组件
class RMSNorm(nn.Module):
    """为什么 LLM 用 RMSNorm 而不用 LayerNorm？
    推导：激活经过残差流后均值≈0，减不减均值差别极小；
    而少算一次均值 = 少一次 reduce kernel、少一次显存读写。
    结论：效果等价，成本更低 —— 这是'从硬件约束推导设计'的典型案例。"""

    def __init__(self, dim: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight


def precompute_rope(head_dim: int, max_seq_len: int, theta: float, device):
    """RoPE 的本质：把 q/k 的每对维度 (x_{2i}, x_{2i+1}) 视作复平面上的点，
    乘上旋转因子 e^{i·t·θ_i} —— 位置 t 被编码成"旋转角度"，点积自然带上相对位置信息。
    频率 θ_i = theta^(-2i/head_dim)：低频维度管长距离，高频维度管短距离。"""
    freqs = 1.0 / (theta ** (torch.arange(0, head_dim, 2, device=device).float() / head_dim))
    t = torch.arange(max_seq_len, device=device).float()
    freqs = torch.outer(t, freqs)                       # [max_seq, head_dim/2]
    return freqs.cos(), freqs.sin()


def apply_rope(x, cos, sin):
    """x: [B, T, H, D]；cos/sin: [1, T, 1, D/2]
    旋转公式：(x1, x2) -> (x1·cos - x2·sin, x2·cos + x1·sin)"""
    d = x.shape[-1] // 2
    x1, x2 = x[..., :d], x[..., d:]
    return torch.cat([x1 * cos - x2 * sin, x2 * cos + x1 * sin], dim=-1)


class KVCache:
    """推理引擎的显存心脏。
    预分配一整块 [n_layers, B, n_kv_heads, max_seq, head_dim]，
    每个 forward 步把新的 K/V 按当前长度写入，attention 只读到当前长度为止。
    为什么预分配：每步 malloc 会产生同步开销和碎片，真实引擎同样池化管理。"""

    def __init__(self, cfg: MiniConfig, batch: int, device, dtype):
        shape = (cfg.n_layers, batch, cfg.n_kv_heads, cfg.max_seq_len, cfg.head_dim)
        self.k = torch.empty(shape, device=device, dtype=dtype)
        self.v = torch.empty(shape, device=device, dtype=dtype)
        self.len = 0  # 已缓存的 token 数，相当于"显存水位线"

    def nbytes(self) -> int:
        return 2 * self.k.numel() * self.k.element_size()  # K 和 V 两份


class Attention(nn.Module):
    def __init__(self, cfg: MiniConfig, layer_idx: int):
        super().__init__()
        self.layer_idx = layer_idx
        self.n_heads, self.n_kv_heads = cfg.n_heads, cfg.n_kv_heads
        self.head_dim = cfg.head_dim
        self.wq = nn.Linear(cfg.dim, cfg.n_heads * cfg.head_dim, bias=False)
        self.wk = nn.Linear(cfg.dim, cfg.n_kv_heads * cfg.head_dim, bias=False)
        self.wv = nn.Linear(cfg.dim, cfg.n_kv_heads * cfg.head_dim, bias=False)
        self.wo = nn.Linear(cfg.n_heads * cfg.head_dim, cfg.dim, bias=False)

    def forward(self, x, cos, sin, cache: KVCache | None, start_pos: int):
        B, T, _ = x.shape
        q = self.wq(x).view(B, T, self.n_heads, self.head_dim)
        k = self.wk(x).view(B, T, self.n_kv_heads, self.head_dim)
        v = self.wv(x).view(B, T, self.n_kv_heads, self.head_dim)
        q, k = apply_rope(q, cos, sin), apply_rope(k, cos, sin)
        q, k, v = q.transpose(1, 2), k.transpose(1, 2), v.transpose(1, 2)  # -> [B, H, T, D]

        rep = self.n_heads // self.n_kv_heads
        if cache is None:
            # —— 训练路径：无缓存，标准因果注意力（同样要先把 KV 头复制到 Q 头数）——
            out = F.scaled_dot_product_attention(
                q, k.repeat_interleave(rep, dim=1), v.repeat_interleave(rep, dim=1),
                is_causal=True)
        else:
            # —— 推理路径：写入 KV cache，再读回全部历史 ——
            cache.k[self.layer_idx][:, :, start_pos:start_pos + T] = k
            cache.v[self.layer_idx][:, :, start_pos:start_pos + T] = v
            k_all = cache.k[self.layer_idx][:, :, :start_pos + T]
            v_all = cache.v[self.layer_idx][:, :, :start_pos + T]
            # GQA：多个 Q 头共享一个 KV 头。这里 repeat_interleave 是朴素写法，
            # 会真的复制显存；真实引擎用 enable_gqa 让 kernel 内部广播，零复制。
            k_all = k_all.repeat_interleave(rep, dim=1)
            v_all = v_all.repeat_interleave(rep, dim=1)
            if T == 1:
                # decode：query 只有 1 个位置，必然 attend 所有已缓存位置 —— 不需要 mask
                out = F.scaled_dot_product_attention(q, k_all, v_all)
            else:
                # prefill：query 位置 i 只能看 ≤ i —— 因果 mask
                out = F.scaled_dot_product_attention(q, k_all, v_all, is_causal=True)
        return self.wo(out.transpose(1, 2).reshape(B, T, -1))


class MLP(nn.Module):
    """SwiGLU：silu(W1 x) * (W3 x) 再过 W2。
    三个矩阵而非两个 —— 参数量会膨胀，所以 hidden 缩到 8/3·dim 对齐参数量。
    为什么用它：门控结构让激活更稀疏，训练更稳 —— 是经验 + 消融出来的结论。"""

    def __init__(self, cfg: MiniConfig):
        super().__init__()
        hidden = int(8 / 3 * cfg.dim)
        self.w1 = nn.Linear(cfg.dim, hidden, bias=False)
        self.w2 = nn.Linear(hidden, cfg.dim, bias=False)
        self.w3 = nn.Linear(cfg.dim, hidden, bias=False)

    def forward(self, x):
        return self.w2(F.silu(self.w1(x)) * self.w3(x))


class Block(nn.Module):
    """pre-norm 残差：x = x + attn(norm(x)); x = x + mlp(norm(x))。
    残差流是信息高速公路，梯度直通底层 —— 这是能堆几十层的前提。"""

    def __init__(self, cfg: MiniConfig, layer_idx: int):
        super().__init__()
        self.norm1 = RMSNorm(cfg.dim)
        self.attn = Attention(cfg, layer_idx)
        self.norm2 = RMSNorm(cfg.dim)
        self.mlp = MLP(cfg)

    def forward(self, x, cos, sin, cache, start_pos):
        x = x + self.attn(self.norm1(x), cos, sin, cache, start_pos)
        x = x + self.mlp(self.norm2(x))
        return x


class MiniLlama(nn.Module):
    def __init__(self, cfg: MiniConfig):
        super().__init__()
        self.cfg = cfg
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.dim)
        self.layers = nn.ModuleList([Block(cfg, i) for i in range(cfg.n_layers)])
        self.norm = RMSNorm(cfg.dim)
        self.lm_head = nn.Linear(cfg.dim, cfg.vocab_size, bias=False)
        self.lm_head.weight = self.tok_emb.weight   # 权重共享：推理时 lm_head 的显存直接省掉
        cos, sin = precompute_rope(cfg.head_dim, cfg.max_seq_len, cfg.rope_theta,
                                   torch.empty(0).device)
        self.register_buffer("rope_cos", cos, persistent=False)
        self.register_buffer("rope_sin", sin, persistent=False)

    def forward(self, tokens, cache=None, start_pos=0):
        """推理入口：返回 hidden states。lm_head 由 Engine 决定是否作用（且只作用最后位置）。"""
        T = tokens.shape[1]
        cos = self.rope_cos[start_pos:start_pos + T][None, :, None, :]
        sin = self.rope_sin[start_pos:start_pos + T][None, :, None, :]
        x = self.tok_emb(tokens)
        for blk in self.layers:
            x = blk(x, cos, sin, cache, start_pos)
        return self.norm(x)


# ---------------------------------------------------------------- 层5: 引擎（调度）
class Engine:
    """推理引擎 = 模型 + KV cache + 采样器 + prefill/decode 调度循环。"""

    def __init__(self, model: MiniLlama, device="cpu", dtype=torch.float32):
        self.model = model.to(device=device, dtype=dtype)
        self.device, self.dtype = device, dtype

    @torch.no_grad()
    def generate(self, prompt_ids, max_new=48, temperature=0.8, top_p=0.9, verbose=True):
        cfg = self.model.cfg
        assert len(prompt_ids) + max_new <= cfg.max_seq_len
        cache = KVCache(cfg, batch=1, device=self.device, dtype=self.dtype)
        prompt = torch.tensor([prompt_ids], device=self.device)

        # ---- Prefill：整段 prompt 一次 forward，KV cache 一次填满 ----
        t0 = time.perf_counter()
        h = self.model(prompt, cache, 0)
        cache.len = prompt.shape[1]
        logits = self.model.lm_head(h[:, -1])     # 只需最后一个位置的 logits —— 省一个大 GEMM
        t_prefill = time.perf_counter() - t0
        tok = sample(logits, temperature, top_p)

        out, decode_times = [tok.item()], []
        # ---- Decode：每步只送 1 个 token，KV cache 水位 +1 ----
        for _ in range(max_new - 1):
            t = time.perf_counter()
            h = self.model(tok[:, None], cache, cache.len)
            cache.len += 1
            logits = self.model.lm_head(h[:, -1])
            tok = sample(logits, temperature, top_p)
            decode_times.append(time.perf_counter() - t)
            out.append(tok.item())

        if verbose:
            n_params = sum(p.numel() for p in self.model.parameters())
            print(f"prefill: {t_prefill*1e3:7.2f} ms ({prompt.shape[1]} tokens, "
                  f"{t_prefill/prompt.shape[1]*1e3:.2f} ms/tok)")
            print(f"decode : {sum(decode_times)*1e3:7.2f} ms ({len(decode_times)} tokens, "
                  f"{sum(decode_times)/len(decode_times)*1e3:.2f} ms/tok)")
            print(f"params : {n_params/1e6:.2f} M | KV cache 占用: "
                  f"{cache.nbytes()/1024/1024:.2f} MB (上限, fp32)")
        return out


# ---------------------------------------------------------------- 采样
def sample(logits, temperature=0.8, top_p=0.9, top_k=0):
    """temperature→0 退化为贪心；top_p 截断累积概率尾部；top_k 截断尾部排名。"""
    if temperature <= 0:
        return logits.argmax(-1, keepdim=True)
    logits = logits / temperature
    if top_k > 0:
        v, _ = torch.topk(logits, top_k)
        logits = logits.masked_fill(logits < v[:, -1:], float("-inf"))
    if top_p < 1.0:
        sorted_logits, idx = torch.sort(logits, descending=True)
        probs = torch.softmax(sorted_logits, dim=-1)
        cum = torch.cumsum(probs, dim=-1)
        drop = cum - probs > top_p                 # 把"加了它才越过阈值"的尾部丢掉
        sorted_logits[drop] = float("-inf")
        logits = torch.full_like(logits, float("-inf")).scatter(-1, idx, sorted_logits)
    return torch.multinomial(torch.softmax(logits, dim=-1), 1)


# ---------------------------------------------------------------- 显存账
def kv_cache_bytes(cfg: MiniConfig, seq_len: int, batch: int = 1, dtype_bytes: int = 2) -> int:
    """KV cache 显存 = 层数 × batch × kv头数 × seq × head_dim × 2(K和V) × 每元素字节。
    关键结论：它和 batch、seq 成正比，和模型参数量无关 —
    — 所以长上下文 + 高并发时，KV cache 会反超权重成为显存大户。这就是 PagedAttention 存在的理由。"""
    return cfg.n_layers * batch * cfg.n_kv_heads * seq_len * cfg.head_dim * 2 * dtype_bytes


def report_memory(cfg: MiniConfig):
    print(f"{'seq':>6} | {'GQA(kv=2)':>12} | {'MHA(kv=4)':>12}")
    for s in (128, 2048, 32768, 131072):
        gqa = kv_cache_bytes(cfg, s)
        mha_cfg = MiniConfig(**{**cfg.__dict__, "n_kv_heads": cfg.n_heads})
        mha = kv_cache_bytes(mha_cfg, s)
        print(f"{s:>6} | {gqa/2**20:>10.1f} MB | {mha/2**20:>10.1f} MB")


# ---------------------------------------------------------------- 字符级 tokenizer
class CharTokenizer:
    def __init__(self, text: str):
        chars = sorted(set(text))
        self.stoi = {c: i for i, c in enumerate(chars)}
        self.itos = {i: c for c, i in self.stoi.items()}

    def encode(self, s): return [self.stoi[c] for c in s]

    def decode(self, ids): return "".join(self.itos[i] for i in ids)

    def __len__(self): return len(self.stoi)


# ---------------------------------------------------------------- Demo
DEMO_TEXT = (
    "夜里的海是另一种语言。浪一层叠着一层，把白日的喧嚣揉碎了咽进深处。"
    "灯塔的光每隔七秒扫过一次，像有人在黑暗里反复确认什么。船不多，但都走得很慢，"
    "仿佛怕惊醒水里沉睡的星。岸边的礁石被磨得圆润，它们用很多年学会不再锋利。"
    "风从北面来，带着盐味，也带着远处渔火的温度。坐在防波堤上的人会想："
    "所谓辽阔，不过是孤独换了一种更大的容器。潮水退去时，沙滩留下细密的花纹，"
    "像某种只有海才读得懂的文字。我们站在这里，听，或者不听，海都在说。"
    "它说的不是答案，它说的是：来过，活过，被光扫过，就已经足够。"
    "深夜的巴士空空荡荡，玻璃上叠着路灯与雨滴。乘客靠着车窗睡着，眉头舒展，"
    "仿佛整座城市终于肯对他温柔一点。下一站没有人上车，司机也没有停太久。"
    "有些旅程就是这样，明知道空座很多，还是只想把自己交给惯性。"
    "巷口的面馆还亮着灯，老板娘在打盹，锅里的高汤咕嘟咕嘟，白汽把玻璃窗糊成毛玻璃。"
    "推门进去，铃铛响了一声，她抬起头笑：还是老样子？老样子。葱花多放一点。"
)


def train_demo(steps=300, batch=8, seq=48, lr=3e-4, seed=0):
    """花 20 秒训一个字符级小模型 —— 目的不是训好，而是给引擎一副'会输出文本'的权重，
    证明整条链路（tokenizer → forward → KV cache → 采样）端到端正确。"""
    torch.manual_seed(seed)
    tok = CharTokenizer(DEMO_TEXT)
    cfg = MiniConfig(vocab_size=len(tok))
    model = MiniLlama(cfg)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    data = torch.tensor(tok.encode(DEMO_TEXT))

    for step in range(steps):
        ix = torch.randint(0, len(data) - seq - 1, (batch,))
        x = torch.stack([data[i:i + seq] for i in ix])
        y = torch.stack([data[i + 1:i + seq + 1] for i in ix])
        logits = model.lm_head(model(x))          # 训练需要全部位置的 logits
        loss = F.cross_entropy(logits.view(-1, cfg.vocab_size), y.view(-1))
        opt.zero_grad(); loss.backward(); opt.step()
        if step % 100 == 0 or step == steps - 1:
            print(f"step {step:4d} | loss {loss.item():.3f}")
    return model, tok


if __name__ == "__main__":
    print("=" * 60)
    print("KV cache 显存账（dim=256, 4层, head_dim=64, fp16）")
    print("=" * 60)
    report_memory(MiniConfig(vocab_size=1))

    print("\n" + "=" * 60)
    print("训练 demo 权重（字符级，~20 秒）")
    print("=" * 60)
    model, tok = train_demo()

    print("\n" + "=" * 60)
    print("推理：prefill + decode")
    print("=" * 60)
    engine = Engine(model)
    prompt = "夜里的海"
    ids = engine.generate(tok.encode(prompt), max_new=80, temperature=0.8, top_p=0.9)
    print("\n生成结果：")
    print(prompt + tok.decode(ids))