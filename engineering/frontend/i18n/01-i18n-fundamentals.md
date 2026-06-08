# i18n 基础

## 1. ICU MessageFormat

```javascript
// ICU MessageFormat 是国际化的事实标准

// 简单插值
const msg = 'Hello, {name}!';
// → Hello, Alice!

// 复数（Plural）
const msg = `{count, plural,
  =0 {No messages}
  one {You have # message}
  other {You have # messages}
}`;
// count=0 → No messages
// count=1 → You have 1 message
// count=5 → You have 5 messages

// 选择（Select）
const msg = `{gender, select,
  male {He went to {place}}
  female {She went to {place}}
  other {They went to {place}}
}`;

// 序数（Selectordinal）
const msg = `You are the {n, selectordinal,
  one {#st}
  two {#nd}
  few {#rd}
  other {#th}
} visitor.`;

// React 中使用
import { FormattedMessage, useIntl } from 'react-intl';

// 组件方式
<FormattedMessage
  id="greeting"
  defaultMessage="Hello, {name}!"
  values={{ name: user.name }}
/>

// Hook 方式
const intl = useIntl();
const text = intl.formatMessage(
  { id: 'greeting', defaultMessage: 'Hello, {name}!' },
  { name: user.name }
);
```

## 2. 日期、时间、数字、货币格式化

```javascript
import { useIntl } from 'react-intl';

function LocalizedData({ date, price, percentage }) {
  const intl = useIntl();
  const locale = intl.locale; // 'zh-CN', 'en-US', 'ar-SA'

  return (
    <div>
      {/* 日期 */}
      <p>{intl.formatDate(date, { dateStyle: 'long' })}</p>
      {/* zh-CN: 2024年1月15日 */}
      {/* en-US: January 15, 2024 */}
      {/* ar-SA: ١٥ يناير ٢٠٢٤ */}

      {/* 时间 */}
      <p>{intl.formatTime(date, { timeStyle: 'short' })}</p>

      {/* 相对时间 */}
      <p>{intl.formatRelativeTime(-2, 'day')}</p>
      {/* 2 days ago / 2天前 / قبل يومين */}

      {/* 数字 */}
      <p>{intl.formatNumber(1234567.89)}</p>
      {/* en-US: 1,234,567.89 */}
      {/* de-DE: 1.234.567,89 */}
      {/* ar-SA: ١٬٢٣٤٬٥٦٧٫٨٩ */}

      {/* 货币 */}
      <p>{intl.formatNumber(price, { style: 'currency', currency: 'CNY' })}</p>
      {/* zh-CN: ¥1,234.50 */}
      {/* en-US: CN¥1,234.50 */}
      {/* ja-JP: ￥1,234 */}

      {/* 百分比 */}
      <p>{intl.formatNumber(percentage, { style: 'percent' })}</p>
    </div>
  );
}

// Intl API 原生支持（无需库）
const date = new Date();
new Intl.DateTimeFormat('zh-CN', { dateStyle: 'full' }).format(date);
new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1234.5);
new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day');
new Intl.ListFormat('en', { type: 'conjunction' }).format(['A', 'B', 'C']);
new Intl.PluralRules('ar').select(0); // 'zero'（阿拉伯语有 zero 形式）
```

## 3. RTL（从右到左）布局

```css
/* RTL 适配策略 */

/* 方案 1：逻辑属性（推荐） */
.element {
  margin-inline-start: 1rem;   /* 替代 margin-left */
  margin-inline-end: 1rem;     /* 替代 margin-right */
  padding-inline: 1rem 2rem;   /* 起始 1rem，结束 2rem */
  border-inline-start: 1px solid; /* 替代 border-left */
  text-align: start;            /* 替代 text-align: left */
  float: inline-start;          /* 替代 float: left */
}

/* 方案 2：CSS 变量 + dir 属性 */
[dir="ltr"] {
  --start: left;
  --end: right;
  --dir: 1;
}

[dir="rtl"] {
  --start: right;
  --end: left;
  --dir: -1;
}

.element {
  float: var(--start);
  transform: translateX(calc(100% * var(--dir)));
}

/* 方案 3：PostCSS RTLCSS 插件 */
/* 输入 */
.element {
  margin-left: 10px;
  text-align: left;
}
/* 输出（自动翻转） */
[dir="ltr"] .element {
  margin-left: 10px;
  text-align: left;
}
[dir="rtl"] .element {
  margin-right: 10px;
  text-align: right;
}
```

```javascript
// React 中动态切换 RTL
function App() {
  const { locale, direction } = useLocale();

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
  }, [locale, direction]);

  return (
    <div dir={direction}>
      {/* 内容 */}
    </div>
  );
}

// 镜像图标（箭头、播放按钮等）
function IconArrow({ direction = 'rtl' }) {
  return (
    <svg
      style={{ transform: direction === 'rtl' ? 'scaleX(-1)' : 'none' }}
      // 或更优雅：使用不同的图标
    >
      <path d="M10 5 L15 10 L10 15" />
    </svg>
  );
}
```

## 4. 本地化细节

| 方面 | 注意点 |
|------|--------|
| **文本长度** | 德语比英语长 30%，按钮可能溢出 |
| **字体** | CJK 需要更大字号，阿拉伯语需要专用字体 |
| **颜色** | 红色在中国=喜庆，在西方=危险 |
| **图片** | 避免含文字的图片，或准备多语言版本 |
| **排序** | 不同语言排序规则不同（ ä 在德语中排 a 后） |
| **姓名格式** | 中文：姓+名，西方：名+姓，匈牙利：姓+名 |
| **地址格式** | 中国：省→市→区→街道，西方：街道→城市→州→邮编 |
