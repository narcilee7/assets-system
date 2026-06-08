# i18n 测试

## 1. 伪本地化（Pseudo-localization）

```javascript
// 伪本地化：在开发阶段模拟翻译效果
// 特点：
// - 文本加长 30-50%（模拟德语等长文本语言）
// - 添加特殊标记（如 [### 原文 ###]）
// - 使用扩展字符集（如 āčēģīķļņ）

function pseudoLocalize(text) {
  const charMap = {
    'a': 'ā', 'e': 'ē', 'i': 'ī', 'o': 'ō', 'u': 'ū',
    'A': 'Ā', 'E': 'Ē', 'I': 'Ī', 'O': 'Ō', 'U': 'Ū',
  };

  let result = text.replace(/[aeiouAEIOU]/g, (c) => charMap[c] || c);

  // 加长 30%
  const extension = '×××'.repeat(Math.ceil(text.length * 0.3));
  result = `[${result}]${extension}`;

  return result;
}

// 构建时启用伪本地化
// vite.config.ts
export default defineConfig({
  plugins: [
    pseudoLocalizationPlugin({
      enabled: process.env.VITE_PSEUDO_LOCALE === 'true',
      locale: 'pseudo',
    }),
  ],
});

// 使用：VITE_PSEUDO_LOCALE=true npm run dev
```

## 2. 视觉回归测试

```javascript
// Chromatic / Storybook 多语言快照
// .storybook/preview.js
export const globalTypes = {
  locale: {
    name: 'Locale',
    description: 'Internationalization locale',
    defaultValue: 'en',
    toolbar: {
      icon: 'globe',
      items: [
        { value: 'en', title: 'English' },
        { value: 'zh-CN', title: '中文' },
        { value: 'ja', title: '日本語' },
        { value: 'ar', title: 'العربية' },
        { value: 'de', title: 'Deutsch' },
      ],
    },
  },
};

export const decorators = [
  (Story, context) => {
    const locale = context.globals.locale;
    const messages = loadMessagesSync(locale);

    return (
      <IntlProvider locale={locale} messages={messages}>
        <div dir={getDirection(locale)}>
          <Story />
        </div>
      </IntlProvider>
    );
  },
];

// 为每个语言生成快照
// chromatic.config.js
module.exports = {
  locales: ['en', 'zh-CN', 'ja', 'ar', 'de'],
};
```

## 3. RTL 布局测试

```javascript
// RTL 测试用例
describe('RTL Layout', () => {
  it('should mirror flex direction in RTL', () => {
    render(
      <IntlProvider locale="ar" messages={arMessages}>
        <div dir="rtl">
          <Header />
        </div>
      </IntlProvider>
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveStyle({ direction: 'rtl' });

    // Logo 应该在右侧
    const logo = screen.getByAltText('Logo');
    expect(logo).toHaveStyle({ marginInlineEnd: 'auto' });
  });

  it('should flip icons in RTL', () => {
    render(
      <IntlProvider locale="ar">
        <div dir="rtl">
          <BackButton />
        </div>
      </IntlProvider>
    );

    const icon = screen.getByTestId('back-icon');
    expect(icon).toHaveStyle({ transform: 'scaleX(-1)' });
  });
});
```

## 4. 内容溢出检测

```javascript
// 自动化检测文本溢出
function detectTextOverflow() {
  const elements = document.querySelectorAll('[data-i18n]');
  const overflows = [];

  for (const el of elements) {
    if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
      overflows.push({
        element: el.dataset.i18n,
        text: el.textContent,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      });
    }
  }

  return overflows;
}

// Cypress 测试
describe('i18n overflow', () => {
  ['en', 'de', 'ja'].forEach((locale) => {
    it(`should not overflow in ${locale}`, () => {
      cy.visit(`/?lang=${locale}`);
      cy.window().then((win) => {
        const overflows = win.detectTextOverflow();
        expect(overflows).to.have.length(0);
      });
    });
  });
});
```
