# Eval API

Eval（评估）是 AI 应用的质量门禁，确保 LLM 输出满足准确性、安全性和格式要求。

## 评估维度

| 维度 | 指标 | 方法 |
| --- | --- | --- |
| 准确性 | BLEU、ROUGE、Exact Match | 与标准答案对比 |
| 相关性 | 用户满意度、点击率 | A/B Test |
| 安全性 | 越狱检测、毒性评分 | 分类器 + 规则 |
| 延迟 | TTFT、TPOT、总耗时 | 监控 |
| 成本 | Tokens / $ | 计费 |

## 核心实现

### 1. Eval Runner

```ts
// eval.service.ts
interface EvalCase {
  id: string;
  input: string;
  expected?: string;
  criteria: Array<{ type: 'exact' | 'contains' | 'llm-judge'; config: any }>;
}

interface EvalResult {
  caseId: string;
  output: string;
  passed: boolean;
  scores: Record<string, number>;
  durationMs: number;
  tokensUsed: number;
}

export class EvalService {
  async runCase(testCase: EvalCase, generate: (input: string) => Promise<string>): Promise<EvalResult> {
    const start = Date.now();
    const output = await generate(testCase.input);
    const durationMs = Date.now() - start;

    const scores: Record<string, number> = {};
    let passed = true;

    for (const criterion of testCase.criteria) {
      const score = await this.evaluateCriterion(criterion, output, testCase.expected);
      scores[criterion.type] = score;
      if (score < (criterion.config.threshold || 1)) passed = false;
    }

    return { caseId: testCase.id, output, passed, scores, durationMs, tokensUsed: 0 };
  }

  private async evaluateCriterion(
    criterion: EvalCase['criteria'][0],
    output: string,
    expected?: string,
  ): Promise<number> {
    switch (criterion.type) {
      case 'exact':
        return output === expected ? 1 : 0;
      case 'contains':
        return criterion.config.keywords.every((k: string) => output.includes(k)) ? 1 : 0;
      case 'llm-judge':
        return this.llmJudge(criterion.config.prompt, output);
      default:
        return 0;
    }
  }

  private async llmJudge(judgePrompt: string, output: string): Promise<number> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: '你是一个严格的评估员，只输出 0-10 的整数分数。' },
        { role: 'user', content: `${judgePrompt}\n\n待评估内容：\n${output}` },
      ],
    });
    const score = parseInt(response.choices[0].message.content || '0', 10);
    return score / 10;
  }
}
```

### 2. CI 集成

```ts
// eval.ci.ts
import { EvalService } from './eval.service';
import { loadTestCases } from './test-cases';

async function runEvalSuite() {
  const cases = await loadTestCases();
  const service = new EvalService();
  const results = await Promise.all(cases.map((c) => service.runCase(c, generate)));

  const passRate = results.filter((r) => r.passed).length / results.length;
  console.log(`Pass rate: ${(passRate * 100).toFixed(1)}%`);

  if (passRate < 0.9) {
    process.exit(1);
  }
}

runEvalSuite();
```

## 最佳实践

- Eval Case 应覆盖 happy path、edge case 和 adversarial case。
- 使用 LLM-as-a-Judge 时，提供清晰的评分标准和示例。
- 记录每次 eval 的完整输入输出，方便回归分析。
- 将 eval 集成到 CI/CD，作为发布门禁。
