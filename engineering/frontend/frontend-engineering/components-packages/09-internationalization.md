# 国际化

## 1. i18n 方案

```tsx
// locale/en.ts
export default {
  button: {
    submit: 'Submit',
    cancel: 'Cancel',
    loading: 'Loading...',
  },
  modal: {
    confirm: 'Are you sure?',
    ok: 'OK',
    close: 'Close',
  },
  pagination: {
    prev: 'Previous',
    next: 'Next',
    page: 'Page {current} of {total}',
  },
};

// locale/zh-CN.ts
export default {
  button: {
    submit: '提交',
    cancel: '取消',
    loading: '加载中...',
  },
  modal: {
    confirm: '确定要执行此操作吗？',
    ok: '确定',
    close: '关闭',
  },
  pagination: {
    prev: '上一页',
    next: '下一页',
    page: '第 {current} 页，共 {total} 页',
  },
};
```

## 2. Locale Provider

```tsx
// LocaleProvider.tsx
import { createContext, useContext, useMemo } from 'react';
import en from './locale/en';
import zhCN from './locale/zh-CN';

const locales = { en, 'zh-CN': zhCN };

interface LocaleContextValue {
  locale: string;
  messages: typeof en;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  messages: en,
  t: (key) => key,
});

export function LocaleProvider({
  locale = 'en',
  children,
}: {
  locale?: string;
  children: React.ReactNode;
}) {
  const messages = locales[locale as keyof typeof locales] || en;

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>) => {
      const keys = key.split('.');
      let value: any = messages;
      for (const k of keys) {
        value = value?.[k];
      }
      if (typeof value !== 'string') return key;

      // 替换参数
      if (params) {
        return value.replace(/\{(\w+)\}/g, (_, paramKey) => String(params[paramKey] ?? ''));
      }
      return value;
    };
  }, [messages]);

  return (
    <LocaleContext.Provider value={{ locale, messages, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
```

## 3. 组件中使用

```tsx
// button.tsx
import { useLocale } from '../locale';

export function Button({ loading, children, ...props }: ButtonProps) {
  const { t } = useLocale();

  return (
    <button {...props}>
      {loading ? t('button.loading') : children}
    </button>
  );
}

// pagination.tsx
export function Pagination({ current, total }: { current: number; total: number }) {
  const { t } = useLocale();

  return (
    <div>
      <button>{t('pagination.prev')}</button>
      <span>{t('pagination.page', { current, total })}</span>
      <button>{t('pagination.next')}</button>
    </div>
  );
}
```

## 4. RTL 支持

```css
/* RTL 适配 */
[dir="rtl"] .ui-button .ui-icon {
  margin-left: 8px;
  margin-right: 0;
}

[dir="rtl"] .ui-pagination {
  flex-direction: row-reverse;
}

/* 逻辑属性（推荐，自动适配 RTL） */
.ui-button {
  margin-inline-start: 8px;  /* 替代 margin-left */
  border-inline-end: 1px solid;  /* 替代 border-right */
  text-align: start;  /* 替代 text-align: left */
}
```

```tsx
// RTLProvider.tsx
export function RTLProvider({ children, rtl }: { children: React.ReactNode; rtl?: boolean }) {
  useEffect(() => {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [rtl]);

  return <>{children}</>;
}
```
