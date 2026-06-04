# Tokenizer 详解

Tokenizer 是 LLM 的"守门员"。它将原始文本映射为模型可处理的整数序列，直接影响模型能力、效率和成本。

## 为什么 Tokenizer 重要？

```
同样的模型：
- 英文："Hello" → 1 token
- 中文："你好" → 2-3 tokens
- 代码："   "（3空格）→ 可能是 1 个特殊 token

直接影响：推理成本、上下文长度、多语言能力
```

## 核心算法

### BPE (Byte-Pair Encoding)

```
1. 从字符级词汇表开始
2. 统计相邻 token 对频率
3. 合并频率最高的对
4. 重复直到达到目标 vocab size
```

**示例**：
```
初始:  l o w </w>  l o w e r </w>  ...
第1轮: "er" 频率最高 → 合并
词汇:  l o w </w>  l o w er </w>  ...
第2轮: "lo" 频率高 → 合并
...直到 vocab = 50K
```

**特点**：
- 贪婪合并，无法回退
- GPT-2、RoBERTa 使用
- 实现库：`tokenizers` (Hugging Face)

### WordPiece

```
类似 BPE，但用似然增益而非频率选择合并：
合并候选 = argmax P(merged) / [P(a) · P(b)]
```

- BERT、DistilBERT 使用
- 与 BPE 效果接近，合并标准略有不同

### SentencePiece / Unigram

```
SentencePiece:
- 将空格视为特殊字符（▁）
- 支持 BPE 或 Unigram 算法
- 语言无关，CJK 友好

Unigram:
- 从超大词汇表开始，逐步删除 token
- 删除标准：最小化损失函数（基于子词概率）
- 一个 token 可以有多种分词方式，用 Viterbi 选最优
```

- T5、ALBERT、XLNet 使用
- **多语言模型的首选**

## Tokenizer 对比

| 维度 | BPE | WordPiece | SentencePiece/Unigram |
|------|-----|-----------|----------------------|
| 语言 | 英文为主 | 英文为主 | 多语言 |
| 空格处理 | 预分词 | 预分词 | 将空格编码为 ▁ |
| 词汇生成 | 自底向上合并 | 自底向上 | 自顶向下删除 |
| 多编码 | 无（确定性） | 无 | 可能（取概率最大） |
| 代表 | GPT, LLaMA | BERT | T5, XLM-R |

## 特殊 Token

| Token | 作用 | 示例 |
|-------|------|------|
| `<|endoftext|>` | 文本结束、Padding | GPT-2 |
| `<s>`, `</s>` | 序列开始/结束 | LLaMA, T5 |
| `<pad>` | 批次对齐 | BERT |
| `<unk>` | 未知词 | 旧模型 |
| `<mask>` | MLM 遮罩 | BERT |
| `<|im_start|>` | 对话角色标记 | ChatML |
| `<|tool_call|>` | 工具调用标记 | 工具模型 |

## Tokenizer 对模型的影响

### 上下文长度

```
中文：1 token ≈ 0.6 个汉字
英文：1 token ≈ 0.75 个单词
代码：1 token ≈ 0.5 个 token（符号密集）

8K context:
- 英文论文：~6000 词
- 中文论文：~3000 字
- 代码文件：~2000 tokens
```

### 多语言能力

| 问题 | 原因 | 解决 |
|------|------|------|
| CJK token 数多 | 字符集大，每个字符独立编码 | 扩大 vocab、SentencePiece |
| 数字分裂 | "12345" → ["12", "345"] | 预训练数字处理 |
| 大小写敏感 | "Hello" ≠ "hello" | 设计 vocab 时考虑 |

## Tokenizer 训练流程

```
1. 收集语料（与预训练语料分布一致）
2. 确定 vocab size（通常 32K-100K）
3. 运行 BPE/Unigram 训练
4. 验证关键指标：
   - 压缩率（tokens / characters）
   - 未知 token 比例
   - 多语言覆盖率
5. 与模型联合测试
```

## 常见误区

| 误区 | 正解 |
|------|------|
| Tokenizer 不影响模型能力 | ❌ 分词方式直接影响学习难度和上下文利用率 |
| 词汇越大越好 | ❌ 太大增加嵌入参数，且低频 token 学不好 |
| 不同模型 tokenizer 可互换 | ❌ 必须与训练时的 tokenizer 完全一致 |
| Token 数 = 字数 | ❌ 因语言和文本类型差异巨大 |

## 快速检查清单

- [ ] 理解 BPE 的合并过程
- [ ] 知道 SentencePiece 与 BPE 的关键区别
- [ ] 能估算不同语言的 tokens/字比例
- [ ] 理解为什么 tokenizer 必须与模型配套使用
