# 模型优化

## 1. 量化（Quantization）

```
量化：将浮点数权重转为低精度整数

FP32 (32-bit) → FP16 (16-bit) → INT8 (8-bit) → INT4 (4-bit)
  ↓                ↓               ↓              ↓
精度最高          精度良好         精度可接受      精度下降明显
体积 100%         体积 50%         体积 25%        体积 12.5%
速度 1x           速度 2x          速度 4x         速度 8x

适用场景：
- FP16：大多数推理场景（推荐默认值）
- INT8：对速度要求高、精度可微调
- INT4：极致压缩（如 7B 模型 → 4GB）
```

```python
# PyTorch 模型量化（导出前）
import torch
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-2-7b")

# 动态量化
quantized_model = torch.quantization.quantize_dynamic(
    model, {torch.nn.Linear}, dtype=torch.qint8
)

# 导出 ONNX
torch.onnx.export(
    quantized_model,
    dummy_input,
    "model-quantized.onnx",
    opset_version=14,
)
```

```javascript
// Transformers.js 量化加载
import { pipeline } from '@huggingface/transformers';

// dtype 选项：'fp32' | 'fp16' | 'q8' | 'q4' | 'q4f16'
const classifier = await pipeline(
  'sentiment-analysis',
  'Xenova/distilbert-base-uncased',
  { dtype: 'q8' }  // 8-bit 量化
);
```

## 2. 模型剪枝（Pruning）

```python
# 结构化剪枝：移除整个神经元/通道
import torch.nn.utils.prune as prune

# 对线性层进行 30% 的 L1 非结构化剪枝
prune.l1_unstructured(
    module=model.layer[0],
    name='weight',
    amount=0.3,
)

# 移除剪枝掩码，使剪枝永久化
prune.remove(model.layer[0], 'weight')
```

## 3. 知识蒸馏（Distillation）

```python
# 用大模型（教师）训练小模型（学生）
# 学生不仅学习正确标签，还学习教师的软标签

class DistillationLoss(nn.Module):
    def __init__(self, temperature=4.0):
        super().__init__()
        self.temperature = temperature
        self.kl_div = nn.KLDivLoss(reduction='batchmean')

    def forward(self, student_logits, teacher_logits, labels):
        # 软目标损失（温度缩放）
        soft_loss = self.kl_div(
            F.log_softmax(student_logits / self.temperature, dim=-1),
            F.softmax(teacher_logits / self.temperature, dim=-1),
        ) * (self.temperature ** 2)

        # 硬目标损失
        hard_loss = F.cross_entropy(student_logits, labels)

        return 0.7 * soft_loss + 0.3 * hard_loss
```

## 4. 模型格式转换

```bash
# PyTorch → ONNX
python -m transformers.onnx --model=bert-base-uncased onnx/bert/

# PyTorch → TensorFlow.js
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  /path/to/saved_model \
  /path/to/tfjs_model

# HuggingFace → ONNX (Optimum)
pip install optimum[exporters]
optimum-cli export onnx --model bert-base-uncased onnx/bert/

# 量化 ONNX 模型
pip install onnxruntime-tools
python -m onnxruntime_tools.quantize \
  --input model.onnx \
  --output model-quantized.onnx \
  --quantize_type QInt8
```

## 5. 模型分片与流式加载

```javascript
// 大模型分片加载（避免单次下载过大）
class ModelShardLoader {
  constructor(baseUrl, shardSize = 50 * 1024 * 1024) {
    this.baseUrl = baseUrl;
    this.shardSize = shardSize;
    this.cache = new Map();
  }

  async loadModel(modelName) {
    // 1. 获取模型分片清单
    const manifest = await fetch(`${this.baseUrl}/${modelName}/manifest.json`).then(r => r.json());
    // manifest: { shards: ['model-00001-of-00004.bin', ...], totalSize: 200000000 }

    // 2. 检查 IndexedDB 缓存
    const cached = await this._checkCache(modelName);
    if (cached) return cached;

    // 3. 并行下载分片（限制并发数）
    const shards = await this._downloadShards(manifest.shards, 2);  // 最多 2 个并发

    // 4. 合并分片
    const modelBuffer = this._concatShards(shards);

    // 5. 存入缓存
    await this._saveCache(modelName, modelBuffer);

    return modelBuffer;
  }

  async _downloadShards(shardUrls, maxConcurrency) {
    const results = [];
    for (let i = 0; i < shardUrls.length; i += maxConcurrency) {
      const batch = shardUrls.slice(i, i + maxConcurrency);
      const buffers = await Promise.all(
        batch.map(url => fetch(url).then(r => r.arrayBuffer()))
      );
      results.push(...buffers);

      // 报告进度
      this._onProgress?.((i + batch.length) / shardUrls.length);
    }
    return results;
  }

  _concatShards(shards) {
    const totalSize = shards.reduce((sum, s) => sum + s.byteLength, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const shard of shards) {
      combined.set(new Uint8Array(shard), offset);
      offset += shard.byteLength;
    }
    return combined.buffer;
  }
}

// 使用
const loader = new ModelShardLoader('https://cdn.example.com/models');
loader._onProgress = (p) => console.log(`Loading: ${(p * 100).toFixed(1)}%`);

const modelBuffer = await loader.loadModel('tinyllama-q4');
```

## 6. 优化策略总结

| 技术 | 体积减少 | 速度提升 | 精度损失 | 复杂度 |
|------|---------|---------|---------|--------|
| **FP16** | 50% | 2x | 极小 | 低 |
| **INT8 量化** | 75% | 4x | 小 | 中 |
| **INT4 量化** | 87.5% | 8x | 中 | 高 |
| **剪枝 30%** | 30% | 1.4x | 小 | 高 |
| **蒸馏** | 70-90% | 3-10x | 可控 | 高 |
| **分片加载** | - | - | 无 | 中 |
