# 运行时 i18n

## 1. 动态语言加载

```javascript
// 按需加载翻译文件（代码分割）
const loadMessages = async (locale) => {
  switch (locale) {
    case 'zh-CN':
      return import('./locales/zh-CN.json');
    case 'ja':
      return import('./locales/ja.json');
    case 'ar':
      return import('./locales/ar.json');
    default:
      return import('./locales/en.json');
  }
};

// React 中使用
function I18nProvider({ children }) {
  const [locale, setLocale] = useState('en');
  const [messages, setMessages] = useState(null);

  useEffect(() => {
    loadMessages(locale).then((mod) => {
      setMessages(mod.default);
    });
  }, [locale]);

  if (!messages) return <Loading />;

  return (
    <IntlProvider locale={locale} messages={messages}>
      {children}
    </IntlProvider>
  );
}

// 更优：预加载可能切换的语言
function preloadLocales(currentLocale) {
  const likelyLocales = currentLocale === 'en'
    ? ['zh-CN', 'ja']
    : ['en'];

  likelyLocales.forEach((locale) => {
    // 浏览器空闲时预加载
    requestIdleCallback(() => {
      loadMessages(locale);
    });
  });
}
```

## 2. 语言检测与切换

```javascript
// 语言检测策略
function detectLocale() {
  // 1. URL 参数 ?lang=zh-CN
  const urlParams = new URLSearchParams(window.location.search);
  const urlLocale = urlParams.get('lang');
  if (urlLocale && isSupported(urlLocale)) return urlLocale;

  // 2. LocalStorage 用户偏好
  const storedLocale = localStorage.getItem('locale');
  if (storedLocale && isSupported(storedLocale)) return storedLocale;

  // 3. 浏览器语言
  const browserLocale = navigator.language; // 'zh-CN', 'en-US'
  if (isSupported(browserLocale)) return browserLocale;

  // 4. 浏览器语言列表
  for (const lang of navigator.languages) {
    if (isSupported(lang)) return lang;
  }

  // 5. 回退到默认语言
  return 'en';
}

function isSupported(locale) {
  return ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'ar', 'de', 'fr', 'es'].includes(locale);
}

// 语言切换（无刷新）
function LocaleSwitcher() {
  const intl = useIntl();
  const router = useRouter();

  const switchLocale = (newLocale) => {
    // 保存偏好
    localStorage.setItem('locale', newLocale);

    // Next.js：切换路由
    router.push(router.pathname, router.asPath, { locale: newLocale });

    // 或普通 React：重新加载翻译
    window.location.reload();
  };

  return (
    <select value={intl.locale} onChange={(e) => switchLocale(e.target.value)}>
      <option value="en">English</option>
      <option value="zh-CN">简体中文</option>
      <option value="ja">日本語</option>
      <option value="ar">العربية</option>
    </select>
  );
}
```

## 3. SSR 多语言

```javascript
// Next.js i18n 配置
// next.config.js
module.exports = {
  i18n: {
    locales: ['en', 'zh-CN', 'ja', 'ar'],
    defaultLocale: 'en',
    localeDetection: true,  // 自动检测
  },
};

// 页面级获取翻译（SSR）
export async function getStaticProps({ locale }) {
  const messages = await import(`../locales/${locale}.json`);

  return {
    props: {
      messages: messages.default,
      now: new Date().getTime(),
    },
  };
}

// _app.tsx
import { IntlProvider } from 'react-intl';

function MyApp({ Component, pageProps }) {
  const { locale } = useRouter();

  return (
    <IntlProvider
      locale={locale}
      messages={pageProps.messages}
      defaultLocale="en"
      timeZone={getTimeZone(locale)}
    >
      <Component {...pageProps} />
    </IntlProvider>
  );
}

// 避免 hydration mismatch（服务端和客户端时间格式一致）
function TimeDisplay({ date }) {
  const intl = useIntl();
  // 使用服务端传递的 now，或 suppress hydration warning
  return (
    <time suppressHydrationWarning>
      {intl.formatDate(date)}
    </time>
  );
}
```

## 4. 框架集成

```javascript
// React (react-intl)
import { FormattedMessage, useIntl } from 'react-intl';

// Vue (vue-i18n)
import { useI18n } from 'vue-i18n';
const { t, d, n } = useI18n();
// template: {{ $t('auth.login.title') }}

// Svelte (svelte-i18n)
import { _ } from 'svelte-i18n';
// {$ _('auth.login.title')}

// Angular (@angular/localize)
// template: <span i18n>Hello, {{name}}!</span>
```
