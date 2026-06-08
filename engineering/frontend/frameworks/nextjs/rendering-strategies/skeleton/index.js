// ============================================================
// Next.js 渲染策略决策树
//
// 目标：理解 SSR/SSG/ISR/CSR/RSC 的核心差异和适用场景
// ============================================================

// ===================== 渲染策略定义 =====================

const RenderingStrategy = {
  SSG: 'SSG',   // Static Site Generation - Build 时渲染
  ISR: 'ISR',   // Incremental Static Regeneration - Build + 请求时
  SSR: 'SSR',   // Server-Side Rendering - 请求时渲染
  CSR: 'CSR',   // Client-Side Rendering - 浏览器渲染
  RSC: 'RSC',   // React Server Components - 服务器组件
};

// ===================== 性能参数（简化模型） =====================

const DEFAULT_PARAMS = {
  networkDelay: 100,      // ms
  dataFetchDelay: 200,    // ms
  htmlGenerateDelay: 50,  // ms
  jsBundleSize: 500,      // ms (下载+执行)
  browserRenderDelay: 100, // ms
};

// ===================== 场景定义 =====================

const scenarios = [
  {
    id: 'A',
    name: '电商产品详情页（库存实时更新）',
    answer: null, // TODO: 选择最合适的策略
    // 提示：需要考虑实时库存、SEO要求、个性化推荐
  },
  {
    id: 'B',
    name: '博客文章列表',
    answer: null, // TODO: 选择最合适的策略
    // 提示：静态内容、SEO友好、更新频率低
  },
  {
    id: 'C',
    name: '用户个人资料页',
    answer: null, // TODO: 选择最合适的策略
    // 提示：用户相关数据、完全个性化
  },
  {
    id: 'D',
    name: '搜索结果页',
    answer: null, // TODO: 选择最合适的策略
    // 提示：实时性要求高、个性化
  },
  {
    id: 'E',
    name: '营销落地页（一年改一次）',
    answer: null, // TODO: 选择最合适的策略
    // 提示：完全静态、SEO友好、高流量
  },
  {
    id: 'F',
    name: '实时股价展示',
    answer: null, // TODO: 选择最合适的策略
    // 提示：秒级更新、无SEO要求
  },
  {
    id: 'G',
    name: '带个性化推荐的首页',
    answer: null, // TODO: 选择最合适的策略
    // 提示：混合场景、需要 SEO、需要个性化
  },
  {
    id: 'H',
    name: '文档网站',
    answer: null, // TODO: 选择最合适的策略
    // 提示：静态为主、频繁更新、版本管理
  },
];

// ===================== 性能计算 =====================

// 计算不同渲染策略的 TTFB 和 TTI
function calculateMetrics(strategy, params = DEFAULT_PARAMS) {
  // TODO: 实现性能计算
  // 返回 { ttfb, tti, dataFreshness, seoFriendly, userSpecific }

  const { networkDelay, dataFetchDelay, htmlGenerateDelay, jsBundleSize, browserRenderDelay } = params;

  // SSG: Build 时渲染，请求时只返回静态 HTML
  // TTFB = networkDelay, TTI = networkDelay + jsBundleSize + browserRenderDelay
  // 数据新鲜度：取决于 build 频率

  // ISR: SSG + revalidate
  // 类似 SSG，但有 stale-while-revalidate 机制

  // SSR: 请求时渲染
  // TTFB = networkDelay + dataFetchDelay + htmlGenerateDelay
  // TTI = networkDelay + dataFetchDelay + htmlGenerateDelay + jsBundleSize + browserRenderDelay

  // CSR: 浏览器渲染
  // TTFB = networkDelay（返回空壳 HTML）
  // TTI = networkDelay + dataFetchDelay + jsBundleSize + browserRenderDelay

  // RSC: 服务端组件 + 流式
  // TTFB 类似 SSR，但可以流式返回，边解析边渲染

  // TODO: 根据 strategy 返回对应的 metrics
  switch (strategy) {
    case RenderingStrategy.SSG:
      return {
        ttfb: networkDelay,
        tti: networkDelay + jsBundleSize + browserRenderDelay,
        dataFreshness: 'low', // build 时固定
        seoFriendly: true,
        userSpecific: false,
      };
    case RenderingStrategy.ISR:
      return {
        ttfb: networkDelay,
        tti: networkDelay + jsBundleSize + browserRenderDelay,
        dataFreshness: 'medium', // 可配置 revalidate
        seoFriendly: true,
        userSpecific: false,
      };
    case RenderingStrategy.SSR:
      return {
        ttfb: networkDelay + dataFetchDelay + htmlGenerateDelay,
        tti: networkDelay + dataFetchDelay + htmlGenerateDelay + jsBundleSize + browserRenderDelay,
        dataFreshness: 'high',
        seoFriendly: true,
        userSpecific: true,
      };
    case RenderingStrategy.CSR:
      return {
        ttfb: networkDelay,
        tti: networkDelay + dataFetchDelay + jsBundleSize + browserRenderDelay,
        dataFreshness: 'high',
        seoFriendly: false,
        userSpecific: true,
      };
    case RenderingStrategy.RSC:
      return {
        ttfb: networkDelay + dataFetchDelay + htmlGenerateDelay,
        tti: networkDelay + jsBundleSize + browserRenderDelay, // 流式，hydration 可并行
        dataFreshness: 'high',
        seoFriendly: true, // 服务端组件不增加 JS
        userSpecific: true,
      };
    default:
      return null;
  }
}

// ===================== 决策树 =====================

// 根据场景特征推荐渲染策略
function recommendStrategy(scenario) {
  // TODO: 实现决策逻辑
  // 输入：{ needSEO, needRealtime, needUserSpecific, updateFrequency, traffic }
  // 输出：推荐的策略组合

  const { needSEO, needRealtime, needUserSpecific, updateFrequency } = scenario;

  // 决策逻辑：
  // 1. 需要 SEO？→ 不能纯 CSR
  // 2. 需要实时数据？→ SSR 或 CSR
  // 3. 需要用户个性化？→ 结合 Client Component
  // 4. 更新频率低？→ SSG 或 ISR

  // 简化决策：
  if (needSEO && !needRealtime && !needUserSpecific) {
    return RenderingStrategy.SSG;
  }
  if (needSEO && !needRealtime && needUserSpecific) {
    return RenderingStrategy.RSC; // SSG + 个性化 Client Component
  }
  if (needRealtime && needUserSpecific) {
    return RenderingStrategy.CSR;
  }
  if (needRealtime && !needUserSpecific) {
    return RenderingStrategy.SSR;
  }

  return RenderingStrategy.ISR; // 默认
}

// ===================== 测试 =====================

function testRenderingStrategies() {
  console.log('\n=== Next.js Rendering Strategies ===\n');

  // Test 1: 计算各策略性能
  console.log('Test 1 - Performance Metrics:');
  console.log('─'.repeat(60));

  const strategies = [RenderingStrategy.SSG, RenderingStrategy.ISR, RenderingStrategy.SSR, RenderingStrategy.CSR, RenderingStrategy.RSC];

  for (const strategy of strategies) {
    const m = calculateMetrics(strategy);
    console.log(`  ${strategy}:`);
    console.log(`    TTFB: ${m.ttfb}ms`);
    console.log(`    TTI: ${m.tti}ms`);
    console.log(`    Data Freshness: ${m.dataFreshness}`);
    console.log(`    SEO Friendly: ${m.seoFriendly}`);
    console.log(`    User Specific: ${m.userSpecific}`);
  }

  console.log('\n');

  // Test 2: 场景策略选择
  console.log('Test 2 - Scenario Strategy Selection:');
  console.log('─'.repeat(60));

  const scenarioConfigs = [
    { id: 'A', needSEO: true, needRealtime: true, needUserSpecific: false, updateFrequency: 'high' },
    { id: 'B', needSEO: true, needRealtime: false, needUserSpecific: false, updateFrequency: 'low' },
    { id: 'C', needSEO: false, needRealtime: true, needUserSpecific: true, updateFrequency: 'low' },
    { id: 'D', needSEO: false, needRealtime: true, needUserSpecific: true, updateFrequency: 'high' },
    { id: 'E', needSEO: true, needRealtime: false, needUserSpecific: false, updateFrequency: 'very-low' },
    { id: 'F', needSEO: false, needRealtime: true, needUserSpecific: false, updateFrequency: 'realtime' },
    { id: 'G', needSEO: true, needRealtime: false, needUserSpecific: true, updateFrequency: 'medium' },
    { id: 'H', needSEO: true, needRealtime: false, needUserSpecific: false, updateFrequency: 'medium' },
  ];

  // TODO: 补全场景答案
  const answers = {
    A: RenderingStrategy.SSR,    // 实时库存 + SEO → SSR
    B: RenderingStrategy.SSG,    // 静态博客 → SSG
    C: RenderingStrategy.CSR,    // 个人信息 → CSR
    D: RenderingStrategy.CSR,    // 搜索结果 → CSR
    E: RenderingStrategy.SSG,    // 静态营销页 → SSG
    F: RenderingStrategy.CSR,    // 实时股价 → CSR (或 WebSocket)
    G: RenderingStrategy.RSC,    // 首页 → SSG + 个性化 Client Component
    H: RenderingStrategy.ISR,    // 文档 → ISR
  };

  for (const config of scenarioConfigs) {
    const recommended = recommendStrategy(config);
    const expected = answers[config.id];
    const correct = recommended === expected;

    console.log(`  Scenario ${config.id}: ${correct ? '✅' : '⚠️'} Recommended: ${recommended || 'TBD'}, Expected: ${expected}`);
  }

  console.log('\n✅ Rendering Strategies tests completed');
}

// ===================== 混合策略设计 =====================

// 电商详情页混合策略设计
function designEcommerceDetailPage() {
  console.log('\n=== E-commerce Detail Page Hybrid Strategy ===\n');

  // 页面区域和推荐策略
  const sections = [
    {
      name: '顶部 Banner（运营编辑）',
      recommend: 'ISR (revalidate=3600)',
      reason: '小时级更新，不需要实时，但需要 SEO',
    },
    {
      name: '商品基础信息（SPU 数据）',
      recommend: 'ISR (revalidate=86400)',
      reason: '天级更新，SPU 数据稳定',
    },
    {
      name: '实时库存',
      recommend: 'Client Component + SWR',
      reason: '秒级更新，必须 CSR',
    },
    {
      name: '个性化推荐',
      recommend: 'Client Component',
      reason: '用户相关，纯 CSR',
    },
    {
      name: '评论列表',
      recommend: 'RSC + Streaming',
      reason: 'SSR 获取数据 + 流式返回 + 客户端交互',
    },
  ];

  for (const s of sections) {
    console.log(`  ${s.name}:`);
    console.log(`    推荐: ${s.recommend}`);
    console.log(`    原因: ${s.reason}`);
    console.log();
  }
}

async function main() {
  console.log('Next.js Rendering Strategies exercises\n');

  let passed = 0;
  let failed = 0;

  try {
    testRenderingStrategies();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Test failed: ${e.message}`);
  }

  try {
    designEcommerceDetailPage();
    passed++;
  } catch (e) {
    failed++;
    console.error(`❌ Design test failed: ${e.message}`);
  }

  console.log(`\n${'='.repeat(60)}`);
  if (failed === 0) {
    console.log(`✅ ALL TESTS PASSED (${passed}/${passed})`);
  } else {
    console.log(`❌ ${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  }
}

main();