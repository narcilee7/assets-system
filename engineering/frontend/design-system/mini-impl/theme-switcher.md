# 手写主题切换

## 1. CSS 变量主题切换

```javascript
// theme.js

const themes = {
  light: {
    'color-bg-default': '#ffffff',
    'color-bg-subtle': '#f9fafb',
    'color-text-default': '#111827',
    'color-text-muted': '#6b7280',
    'color-primary': '#3b82f6',
    'color-border': '#e5e7eb',
  },
  dark: {
    'color-bg-default': '#111827',
    'color-bg-subtle': '#1f2937',
    'color-text-default': '#f9fafb',
    'color-text-muted': '#9ca3af',
    'color-primary': '#60a5fa',
    'color-border': '#374151',
  },
};

class ThemeSwitcher {
  constructor() {
    this.currentTheme = this.getStoredTheme() || 'system';
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);

    // 监听系统主题变化
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentTheme === 'system') {
        this.applySystemTheme();
      }
    });
  }

  getStoredTheme() {
    try {
      return localStorage.getItem('theme');
    } catch {
      return null;
    }
  }

  setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
  }

  applyTheme(theme) {
    if (theme === 'system') {
      this.applySystemTheme();
    } else {
      this.applyColorScheme(theme);
    }
  }

  applySystemTheme() {
    const systemTheme = this.mediaQuery.matches ? 'dark' : 'light';
    this.applyColorScheme(systemTheme);
  }

  applyColorScheme(scheme) {
    const root = document.documentElement;
    const themeVars = themes[scheme];

    for (const [key, value] of Object.entries(themeVars)) {
      root.style.setProperty(`--${key}`, value);
    }

    root.setAttribute('data-theme', scheme);
  }

  toggle() {
    const current = this.currentTheme === 'system'
      ? (this.mediaQuery.matches ? 'dark' : 'light')
      : this.currentTheme;

    this.setTheme(current === 'light' ? 'dark' : 'light');
  }
}

// ============ 使用 ============

const themeSwitcher = new ThemeSwitcher();

// 切换按钮
document.getElementById('theme-toggle').addEventListener('click', () => {
  themeSwitcher.toggle();
});

// 下拉选择
document.getElementById('theme-select').addEventListener('change', (e) => {
  themeSwitcher.setTheme(e.target.value);
});
```

## 2. React Hook 版本

```tsx
// useTheme.ts
import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      const resolved = theme === 'system'
        ? (media.matches ? 'dark' : 'light')
        : theme;

      setResolvedTheme(resolved);
      root.setAttribute('data-theme', resolved);
    };

    apply();

    if (theme === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  }, [resolvedTheme, setTheme]);

  return { theme, resolvedTheme, setTheme, toggle };
}
```
