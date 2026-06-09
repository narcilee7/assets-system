# 手写 SEO 审计 CLI

## 目标

实现一个简化版 SEO 审计 CLI 工具，支持：
1. 模拟爬虫抓取页面
2. 检测技术 SEO 问题（标题、描述、Canonical、Schema）
3. 检测 Core Web Vitals 相关性能指标
4. 输出审计报告

## 实现

```javascript
#!/usr/bin/env node
// seo-audit.js
const https = require('https');
const http = require('http');
const { URL } = require('url');

class SEOAuditor {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000;
    this.userAgent = options.userAgent || 'SEOAuditor/1.0';
    this.followRedirects = options.followRedirects !== false;
    this.maxRedirects = options.maxRedirects || 5;
  }

  async audit(url) {
    console.log(`🔍 Auditing: ${url}\n`);

    const startTime = Date.now();
    const { html, statusCode, headers, finalUrl } = await this._fetch(url);
    const fetchTime = Date.now() - startTime;

    const results = {
      url: finalUrl,
      statusCode,
      fetchTime: `${fetchTime}ms`,
      issues: [],
      warnings: [],
      passed: [],
    };

    // 1. 基本元数据检查
    this._checkMetaTags(html, results);

    // 2. 结构化数据检查
    this._checkStructuredData(html, results);

    // 3. 链接和 Canonical 检查
    this._checkCanonical(html, finalUrl, results);

    // 4. 性能相关检查
    this._checkPerformanceHints(html, headers, results);

    // 5. 可访问性检查
    this._checkAccessibility(html, results);

    // 6. GEO 相关检查
    this._checkGEOOptimization(html, results);

    return results;
  }

  _fetch(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.get(
        url,
        {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html',
          },
          timeout: this.timeout,
        },
        (res) => {
          if (this.followRedirects && [301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
            if (redirectCount >= this.maxRedirects) {
              reject(new Error('Too many redirects'));
              return;
            }
            const redirectUrl = new URL(res.headers.location, url).href;
            resolve(this._fetch(redirectUrl, redirectCount + 1));
            return;
          }

          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            resolve({
              html: data,
              statusCode: res.statusCode,
              headers: res.headers,
              finalUrl: url,
            });
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  _checkMetaTags(html, results) {
    const title = html.match(/<title>(.*?)<\/title>/i)?.[1];
    const description = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1];
    const robots = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i)?.[1];
    const viewport = html.match(/<meta[^>]*name=["']viewport["']/i);

    // Title
    if (!title) {
      results.issues.push({ category: 'Meta', message: 'Missing <title> tag' });
    } else if (title.length > 60) {
      results.warnings.push({ category: 'Meta', message: `Title too long (${title.length} chars, max 60)` });
    } else if (title.length < 10) {
      results.warnings.push({ category: 'Meta', message: `Title too short (${title.length} chars)` });
    } else {
      results.passed.push({ category: 'Meta', message: `Title: "${title}"` });
    }

    // Description
    if (!description) {
      results.warnings.push({ category: 'Meta', message: 'Missing meta description' });
    } else if (description.length > 160) {
      results.warnings.push({ category: 'Meta', message: `Description too long (${description.length} chars)` });
    } else {
      results.passed.push({ category: 'Meta', message: `Description: "${description.slice(0, 50)}..."` });
    }

    // Viewport
    if (!viewport) {
      results.issues.push({ category: 'Meta', message: 'Missing viewport meta tag (mobile-unfriendly)' });
    } else {
      results.passed.push({ category: 'Meta', message: 'Viewport meta tag present' });
    }

    // Robots
    if (robots?.includes('noindex')) {
      results.warnings.push({ category: 'Meta', message: 'Page has noindex directive' });
    }
  }

  _checkStructuredData(html, results) {
    const jsonLdScripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    const schemas = [];

    for (const match of jsonLdScripts) {
      try {
        const data = JSON.parse(match[1]);
        const type = Array.isArray(data) ? data[0]?.['@type'] : data['@type'];
        if (type) schemas.push(type);
      } catch {
        results.issues.push({ category: 'Schema', message: 'Invalid JSON-LD structured data' });
      }
    }

    if (schemas.length === 0) {
      results.warnings.push({ category: 'Schema', message: 'No JSON-LD structured data found' });
    } else {
      results.passed.push({ category: 'Schema', message: `Found schemas: ${schemas.join(', ')}` });
    }

    // 检查 Open Graph
    const ogTitle = html.match(/<meta[^>]*property=["']og:title["']/i);
    const ogImage = html.match(/<meta[^>]*property=["']og:image["']/i);
    if (!ogTitle) {
      results.warnings.push({ category: 'Social', message: 'Missing og:title tag' });
    }
    if (!ogImage) {
      results.warnings.push({ category: 'Social', message: 'Missing og:image tag' });
    }
    if (ogTitle && ogImage) {
      results.passed.push({ category: 'Social', message: 'Open Graph tags present' });
    }
  }

  _checkCanonical(html, currentUrl, results) {
    const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1]
      || html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i)?.[1];

    if (!canonical) {
      results.warnings.push({ category: 'URL', message: 'Missing canonical link' });
    } else if (canonical !== currentUrl) {
      results.warnings.push({
        category: 'URL',
        message: `Canonical mismatch: ${canonical} !== ${currentUrl}`,
      });
    } else {
      results.passed.push({ category: 'URL', message: `Canonical: ${canonical}` });
    }

    // 检查 hreflang
    const hreflangs = [...html.matchAll(/<link[^>]*rel=["']alternate["'][^>]*hreflang=["']([^"']*)["']/gi)];
    if (hreflangs.length > 0) {
      results.passed.push({ category: 'URL', message: `Found ${hreflangs.length} hreflang tags` });
    }
  }

  _checkPerformanceHints(html, headers, results) {
    // 检查图片优化
    const imgTags = [...html.matchAll(/<img[^>]*src=["']([^"']*)["']/gi)];
    const unoptimizedImages = imgTags.filter(([, src]) =>
      !src.endsWith('.webp') && !src.endsWith('.avif') && !src.includes('format=webp')
    );

    if (unoptimizedImages.length > 0) {
      results.warnings.push({
        category: 'Performance',
        message: `${unoptimizedImages.length}/${imgTags.length} images not using WebP/AVIF`,
      });
    }

    // 检查缺少尺寸的图
    const imgsWithoutSize = [...html.matchAll(/<img(?![^>]*width)(?![^>]*height)[^>]*>/gi)];
    if (imgsWithoutSize.length > 0) {
      results.warnings.push({
        category: 'Performance',
        message: `${imgsWithoutSize.length} images missing width/height (causes CLS)`,
      });
    }

    // 检查 Gzip/Brotli
    const encoding = headers['content-encoding'];
    if (!encoding) {
      results.warnings.push({ category: 'Performance', message: 'No compression (gzip/brotli) enabled' });
    } else {
      results.passed.push({ category: 'Performance', message: `Compression: ${encoding}` });
    }
  }

  _checkAccessibility(html, results) {
    // 检查图片 alt
    const imgsWithoutAlt = [...html.matchAll(/<img(?![^>]*alt=)[^>]*>/gi)];
    if (imgsWithoutAlt.length > 0) {
      results.warnings.push({
        category: 'A11y',
        message: `${imgsWithoutAlt.length} images missing alt text`,
      });
    }

    // 检查 heading 层级
    const h1s = html.match(/<h1[\s>]/gi);
    if (!h1s) {
      results.issues.push({ category: 'A11y', message: 'Missing H1 heading' });
    } else if (h1s.length > 1) {
      results.warnings.push({ category: 'A11y', message: `Multiple H1 headings (${h1s.length})` });
    }
  }

  _checkGEOOptimization(html, results) {
    // 检查 FAQ Schema（GEO 友好）
    const hasFAQ = html.includes('"@type": "FAQPage"') || html.includes("'@type': 'FAQPage'");
    const hasHowTo = html.includes('"@type": "HowTo"') || html.includes("'@type': 'HowTo'");

    if (!hasFAQ && !hasHowTo) {
      results.warnings.push({
        category: 'GEO',
        message: 'No FAQPage or HowTo structured data (reduces AI citation probability)',
      });
    } else {
      const types = [hasFAQ && 'FAQPage', hasHowTo && 'HowTo'].filter(Boolean);
      results.passed.push({ category: 'GEO', message: `GEO-friendly schemas: ${types.join(', ')}` });
    }

    // 检查是否有明确的问答格式
    const hasQAFormat = /<h[2-6][^>]*>.*\?.*<\/h[2-6]>/i.test(html);
    if (!hasQAFormat) {
      results.warnings.push({
        category: 'GEO',
        message: 'No question-format headings (AI engines prefer explicit Q&A structure)',
      });
    }

    // 检查数据引用
    const hasDataCitations = /\d{4}|\d+%|according to|cited from/i.test(html);
    if (!hasDataCitations) {
      results.warnings.push({
        category: 'GEO',
        message: 'No data citations or statistics (reduces content authority for AI)',
      });
    }
  }

  printReport(results) {
    console.log('='.repeat(60));
    console.log(`SEO Audit Report for ${results.url}`);
    console.log(`Status: ${results.statusCode} | Fetch Time: ${results.fetchTime}`);
    console.log('='.repeat(60));

    if (results.issues.length > 0) {
      console.log(`\n❌ Issues (${results.issues.length}):`);
      results.issues.forEach((i) => console.log(`   [${i.category}] ${i.message}`));
    }

    if (results.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${results.warnings.length}):`);
      results.warnings.forEach((w) => console.log(`   [${w.category}] ${w.message}`));
    }

    if (results.passed.length > 0) {
      console.log(`\n✅ Passed (${results.passed.length}):`);
      results.passed.forEach((p) => console.log(`   [${p.category}] ${p.message}`));
    }

    const score = Math.max(0, 100 - results.issues.length * 15 - results.warnings.length * 5);
    console.log(`\n📊 Score: ${score}/100`);
  }
}

// CLI 入口
async function main() {
  const url = process.argv[2];
  if (!url) {
    console.log('Usage: node seo-audit.js <url>');
    console.log('Example: node seo-audit.js https://example.com');
    process.exit(1);
  }

  const auditor = new SEOAuditor();
  try {
    const results = await auditor.audit(url);
    auditor.printReport(results);
  } catch (err) {
    console.error('Audit failed:', err.message);
    process.exit(1);
  }
}

main();
```

## 使用

```bash
node seo-audit.js https://example.com/blog/react-18

# 输出示例：
# 🔍 Auditing: https://example.com/blog/react-18
#
# ============================================================
# SEO Audit Report for https://example.com/blog/react-18
# Status: 200 | Fetch Time: 245ms
# ============================================================
#
# ⚠️  Warnings (3):
#    [Schema] No JSON-LD structured data found
#    [Performance] 2/5 images not using WebP/AVIF
#    [GEO] No FAQPage or HowTo structured data
#
# ✅ Passed (5):
#    [Meta] Title: "React 18 并发渲染详解 - TechBlog"
#    [Meta] Description: "深入理解 React 18..."
#    [URL] Canonical: https://example.com/blog/react-18
#    [Performance] Compression: br
#    [Social] Open Graph tags present
#
# 📊 Score: 85/100
```
