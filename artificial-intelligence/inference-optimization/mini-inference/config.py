from dataclasses import dataclass

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
