# 手写 RTL 布局适配器

## 目标

实现一个简化版 RTL 布局适配器，支持：
1. 自动检测 RTL 语言
2. CSS 逻辑属性转换
3. 图标/图片镜像
4. 滚动方向适配

## 实现

```javascript
// rtl-layout.js

const RTL_LOCALES = new Set([
  'ar', 'ar-SA', 'ar-AE', 'ar-EG',
  'he', 'he-IL',
  'fa', 'fa-IR',
  'ur', 'ur-PK',
  'yi',
]);

class RTLAdapter {
  constructor(options = {}) {
    this.mirrorSelectors = options.mirrorSelectors || [
      '[dir="auto"]',
      '.mirror-rtl',
      '[data-mirror-rtl]',
    ];
    this.rtlClassName = options.rtlClassName || 'is-rtl';
    this.ltrClassName = options.ltrClassName || 'is-ltr';
  }

  // 检测是否为 RTL 语言
  static isRTL(locale) {
    return RTL_LOCALES.has(locale) || RTL_LOCALES.has(locale.split('-')[0]);
  }

  // 设置文档方向
  setDocumentDirection(locale) {
    const isRTL = RTLAdapter.isRTL(locale);
    const dir = isRTL ? 'rtl' : 'ltr';

    document.documentElement.dir = dir;
    document.documentElement.lang = locale;

    // 添加 CSS 类
    document.body.classList.remove(this.rtlClassName, this.ltrClassName);
    document.body.classList.add(isRTL ? this.rtlClassName : this.ltrClassName);

    // 处理需要镜像的元素
    this._applyMirroring(isRTL);

    // 调整滚动位置
    this._adjustScrollPosition(isRTL);

    return dir;
  }

  // 应用镜像
  _applyMirroring(isRTL) {
    const elements = document.querySelectorAll(this.mirrorSelectors.join(', '));

    for (const el of elements) {
      if (isRTL) {
        el.style.transform = 'scaleX(-1)';
        el.setAttribute('data-rtl-mirrored', 'true');
      } else {
        el.style.transform = '';
        el.removeAttribute('data-rtl-mirrored');
      }
    }
  }

  // 调整滚动位置（防止切换方向时跳变）
  _adjustScrollPosition(isRTL) {
    const scrollContainers = document.querySelectorAll(
      '[data-scroll-reverse], .scroll-container'
    );

    for (const container of scrollContainers) {
      if (isRTL) {
        // RTL 时滚动到最右
        container.scrollLeft = container.scrollWidth - container.clientWidth;
      } else {
        container.scrollLeft = 0;
      }
    }
  }

  // 生成 RTL CSS（将物理属性转为逻辑属性）
  static generateLogicalCSS(css) {
    const replacements = [
      // 边距
      { from: /margin-left/g, to: 'margin-inline-start' },
      { from: /margin-right/g, to: 'margin-inline-end' },
      { from: /padding-left/g, to: 'padding-inline-start' },
      { from: /padding-right/g, to: 'padding-inline-end' },

      // 边框
      { from: /border-left/g, to: 'border-inline-start' },
      { from: /border-right/g, to: 'border-inline-end' },

      // 定位
      { from: /left\s*:/g, to: 'inset-inline-start:' },
      { from: /right\s*:/g, to: 'inset-inline-end:' },

      // 文本
      { from: /text-align:\s*left/g, to: 'text-align: start' },
      { from: /text-align:\s*right/g, to: 'text-align: end' },

      // 浮动
      { from: /float:\s*left/g, to: 'float: inline-start' },
      { from: /float:\s*right/g, to: 'float: inline-end' },

      // 清除浮动
      { from: /clear:\s*left/g, to: 'clear: inline-start' },
      { from: /clear:\s*right/g, to: 'clear: inline-end' },
    ];

    let result = css;
    for (const { from, to } of replacements) {
      result = result.replace(from, to);
    }

    return result;
  }

  // 观察动态添加的元素并应用 RTL
  observeDynamicContent(container = document.body) {
    const observer = new MutationObserver((mutations) => {
      const isRTL = document.documentElement.dir === 'rtl';
      if (!isRTL) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this._processElement(node);
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    return observer;
  }

  _processElement(el) {
    // 处理 data-mirror-rtl 属性
    if (el.hasAttribute('data-mirror-rtl')) {
      el.style.transform = 'scaleX(-1)';
    }

    // 处理 dir="auto"
    if (el.getAttribute('dir') === 'auto') {
      const text = el.textContent || '';
      if (this._isRTLText(text)) {
        el.dir = 'rtl';
      } else {
        el.dir = 'ltr';
      }
    }
  }

  // 检测文本是否为 RTL 语言
  _isRTLText(text) {
    // 检查是否包含 RTL 字符（阿拉伯语、希伯来语等）
    const rtlRegex = /[\u0591-\u07FF]/;
    return rtlRegex.test(text);
  }
}

// ========== CSS 注入 ==========

function injectRTLCSS() {
  const style = document.createElement('style');
  style.textContent = `
    /* RTL 基础样式 */
    [dir="rtl"] {
      direction: rtl;
    }

    [dir="rtl"] .flex-row {
      flex-direction: row-reverse;
    }

    [dir="rtl"] .text-start {
      text-align: right;
    }

    [dir="rtl"] .text-end {
      text-align: left;
    }

    [dir="rtl"] .ml-auto {
      margin-left: 0;
      margin-right: auto;
    }

    [dir="rtl"] .mr-auto {
      margin-right: 0;
      margin-left: auto;
    }

    /* 逻辑属性（现代浏览器） */
    .logical-margin-start {
      margin-inline-start: 1rem;
    }

    .logical-margin-end {
      margin-inline-end: 1rem;
    }

    .logical-padding-start {
      padding-inline-start: 1rem;
    }

    .logical-padding-end {
      padding-inline-end: 1rem;
    }

    .logical-border-start {
      border-inline-start: 1px solid;
    }

    .logical-border-end {
      border-inline-end: 1px solid;
    }

    .logical-text-start {
      text-align: start;
    }

    .logical-text-end {
      text-align: end;
    }

    .logical-float-start {
      float: inline-start;
    }

    .logical-float-end {
      float: inline-end;
    }

    .logical-inset-start {
      inset-inline-start: 0;
    }

    .logical-inset-end {
      inset-inline-end: 0;
    }
  `;
  document.head.appendChild(style);
}

// ========== 使用示例 ==========

const adapter = new RTLAdapter();

// 切换到阿拉伯语
adapter.setDocumentDirection('ar');
// 文档变为 RTL，镜像元素自动翻转

// 切换到英语
adapter.setDocumentDirection('en');
// 文档恢复 LTR

// 观察动态内容
const observer = adapter.observeDynamicContent();

// 生成逻辑属性 CSS
const originalCSS = `
  .button {
    margin-left: 10px;
    padding-right: 20px;
    text-align: left;
    float: left;
  }
`;

console.log(RTLAdapter.generateLogicalCSS(originalCSS));
// .button {
//   margin-inline-start: 10px;
//   padding-inline-end: 20px;
//   text-align: start;
//   float: inline-start;
// }

module.exports = { RTLAdapter, injectRTLCSS };
```
