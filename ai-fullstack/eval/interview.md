# Eval 面试深度问答

## 核心概念地图

1. **Golden Set**：人工标注的标准测试集，包含输入、期望输出、期望工具调用、期望检索结果。
2. **Judge**：评估模型输出的裁判，可以是规则、启发式、另一个模型或人工。
3. **Metric**：具体可量化的指标，如 accuracy、recall@k、faithfulness。
4. **Regression**：对比新版本与旧版本的指标变化，发现退化。
5. **Quality Gate**：CI/CD 中阻止低质量变更进入主干的阈值。

## 架构与数据流

```text
Golden Set
  → Runner（执行被测系统）
    → Predictions
      → Judge（打分）
        → Metrics
          → Report
            → Quality Gate
```

## 关键设计决策

### 1. Golden set 怎么构建？

- **覆盖度**：覆盖核心场景、边界 case、失败 case。
- **稳定性**：输入和期望输出要明确，避免主观判断。
- **规模**：小到能快读运行（如 100-500 条），大到能代表真实分布。
- **更新机制**：随产品迭代更新，旧 case 保留用于回归。

### 2. Judge 用规则还是模型？

| Judge | 优点 | 缺点 |
| --- | --- | --- |
| Rule-based | 快、稳定、可解释 | 只能处理结构化输出 |
| LLM Judge | 能评估开放性回答 | 慢、贵、可能有偏见 |
| Human | 最准确 | 慢、贵、不可持续 |
| Hybrid | 规则先筛，模型再判 | 复杂度高 |

**推荐**：先用 rule-based 覆盖可量化指标，再用 LLM Judge 覆盖开放性质量。

### 3. Metric 怎么选？

- **Retrieval**：recall@k、precision@k、MRR、NDCG。
- **Answer**：faithfulness、relevance、correctness、completeness、citation accuracy。
- **Tool**：tool selection accuracy、argument accuracy、success rate。
- **Agent**：task completion、step efficiency、recovery rate。

### 4. 如何防止 Eval 过拟合？

- Golden set 分为 public（开发时用）和 private（最终评估用）。
- 定期从线上采样新 case 加入测试集。
- 不只优化 aggregate metric，也要看 per-case 失败分析。

## 失败路径与恢复

| 失败 | 原因 | 恢复 |
| --- | --- | --- |
| Golden set 过时 | 产品功能变化 | 定期审查和更新测试集 |
| Judge 不稳定 | LLM Judge 每次打分波动 | 多次采样取平均；用更确定性 prompt |
| Metric 与用户体验不一致 | 指标不能反映真实满意度 | 补充用户反馈指标、A/B test |
| Eval 运行太慢 | case 太多或模型调用慢 | 分层评估：smoke / regression / full |
| 新版本指标提升但体验下降 | metric 设计有漏洞 | 增加 qualitative review |
| 数据泄露 | 测试集被用于训练 | 严格隔离训练/测试数据 |

## 面试题与应答脚本

### Q1：AI 应用为什么必须做 Eval？

**答**：
- LLM 输出不确定性高，不能仅靠单元测试。
- 需要量化系统迭代效果，防止 regression。
- 帮助定位薄弱环节（检索、工具、提示词）。
- 是质量门禁和发布决策的依据。

**追问**：
- 传统软件测试和 AI Eval 的区别？（传统测试期望输出固定；AI Eval 允许语义等价，需要 judge。）
- Eval 能不能完全替代人工测试？（不能；Eval 是筛选器，人工做最终把关。）

### Q2：Golden Set 应该怎么设计？

**答**：
- 覆盖核心用户意图和边界情况。
- 每个 case 包含：输入、期望输出、期望工具调用、期望检索片段、评分标准。
- 包含负例：应该拒答、应该请求澄清、应该失败的情况。
- 定期从线上 bad case 中补充。

**追问**：
- 开放性问题怎么写期望输出？（可以写评分要点，而不是 exact match；或用 reference answer + LLM judge。）
- Golden set 多大合适？（小到 5 分钟能跑完；大到能覆盖主要分布；通常 100-1000 条。）

### Q3：LLM Judge 的 prompt 怎么设计？

**答**：
- 明确评分维度和标准（如 1-5 分，每分有示例）。
- 提供 few-shot 示例，让 judge 理解标准。
- 要求先分析再评分，减少随机性。
- 对关键 case 做多次采样取平均。
- 定期校准 judge 与人类标注的一致性。

**追问**：
- LLM Judge 会不会偏袒自己生成的内容？（会；用不同模型做 judge，或让 judge 不知道答案来源。）
- 怎么降低 judge 成本？（先用 rule-based 过滤明显错误，只对模糊 case 用 LLM judge。）

### Q4：Retrieval 评估和 Answer 评估有什么区别？

**答**：
- **Retrieval eval**：评估检索器是否找对了文档，指标如 recall@k、MRR。
- **Answer eval**：评估最终回答是否正确、忠实、完整，指标如 faithfulness、relevance。
- 检索好但回答差：可能是 generator 问题；检索差但回答好：可能是模型靠记忆回答。

**追问**：
- 检索对了但答案没引用，怎么评估？（citation accuracy：检查答案中的 claim 是否被检索文档支持。）
- 答案对了但检索错了，怎么办？（说明模型可能 memorized，需要警惕幻觉；强制要求 citation。）

### Q5：Faithfulness 怎么算？

**答**：
- 把回答拆成多个 claim。
- 检查每个 claim 是否能被检索文档或上下文支持。
- faithful claims / total claims。
- 可用规则（字符串匹配）或 LLM 判断支持关系。

**追问**：
- 如果回答里做了合理推断，算不算 faithful？（视业务而定；通常只允许基于证据的推断，不允许引入外部知识。）
- 多步推理怎么评估？（检查中间结论是否都有依据。）

### Q6：Tool Calling 怎么评估？

**答**：
- **Selection accuracy**：是否选对了工具。
- **Argument accuracy**：参数是否正确（精确匹配或语义等价）。
- **Execution success**：工具执行是否成功。
- **Recovery**：失败后是否能正确重试或 fallback。

**追问**：
- 参数是 JSON，怎么定义正确？（必填字段存在、类型正确、值在合理范围；对字符串可做语义匹配。）
- 多个 tool call 怎么评估？（分别评估每个调用，再看整体是否完成任务。）

### Q7：Eval 如何集成到 CI？

**答**：
- 每次 PR 触发 smoke eval（小批量、快）。
- 每日/每周触发 full eval（完整 golden set）。
- 设定 quality gate：关键指标不能下降超过阈值（如 2%）。
- 生成 report，标注退化 case。

**追问**：
- 指标波动导致频繁失败怎么办？（设置统计显著性检验；用多次运行平均。）
- 生成 eval 报告后谁来看？（指定 owner 负责审查退化 case 并决定是否放行。）

### Q8：Regression 测试怎么做？

**答**：
- 保存每个版本的 eval metrics 历史。
- 新版本跑完后与基线对比。
- 不仅看 aggregate，还要看 per-category 和 per-case 差异。
- 对退化 case 做 root cause 分析。

**追问**：
- 基线选哪个版本？（通常选上一个稳定 release 或线上版本。）
- 某个指标轻微下降但其他指标上升，怎么决策？（看业务优先级；必要时人工 review。）

### Q9：Eval 会不会被作弊？

**答**：
- 可能：模型在训练时见过 golden set，或 prompt 被优化到只迎合 judge。
- 防范：保持 golden set 私密、定期更新、引入多样性 judge、结合人工抽查。

**追问**：
- 如果 LLM Judge 和被测模型是同一个模型，怎么避免偏见？（用更强模型做 judge，或隔离 judge 与答案来源信息。）

### Q10：线上 bad case 怎么回流到 Eval？

**答**：
- 收集用户反馈（点赞/点踩、举报、客服记录）。
- 定期抽样人工标注。
- 自动聚类相似 bad case，挑选代表性样本。
- 加入 golden set 前做脱敏和合规审查。

**追问**：
- 用户点踩不一定代表回答错，怎么处理？（结合多信号：点踩 + 未采纳 + 客服介入。）
- 如何防止 bad case 过多导致 golden set 失衡？（保持正负样本比例；分层抽样。）

## 开放设计题

1. **设计一个 RAG 系统的 Eval 体系**：包括 retrieval eval、answer eval、citation eval。说明 golden set 构建、judge 选择、CI 集成、退化分析。

2. **设计一个 Agent 的端到端 Eval 平台**：输入用户任务，评估 task completion、step efficiency、tool accuracy、recovery。说明如何构造可复现的测试环境。

3. **设计一个 LLM Judge 的校准流程**：如何让 LLM Judge 的打分与人类标注保持高一致性？说明 prompt 迭代、few-shot、采样、一致性检验。

## 与其他模块的关系

- **Agent Runtime**：Eval 评估 Agent 的 planning、execution、recovery 能力。
- **Tool Calling**：Tool selection 和 argument accuracy 是 Eval 的重要指标。
- **RAG**：Retrieval 和 answer quality 是 Eval 的核心对象。
- **Observability**：Eval 需要 trace 数据做 case-level 分析。
- **Streaming UI**：UI 层面的 latency、cancel success 也可纳入 Eval。
- **Safety**：Safety 违规 case 必须加入 golden set。
- **Model Serving**：模型路由和 fallback 的效果需要通过 Eval 验证。
