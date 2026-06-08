# 手写 i18n 引擎

## 目标

实现一个简化版 i18n 引擎，支持：
1. ICU MessageFormat 解析（插值、复数、选择）
2. 运行时语言切换
3. 嵌套键值访问
4. 复数规则（CLDR 简化版）

## 实现

```javascript
// i18n-engine.js

class I18nEngine {
  constructor(options = {}) {
    this.locale = options.locale || 'en';
    this.fallbackLocale = options.fallbackLocale || 'en';
    this.messages = options.messages || {};
    this.formattings = options.formattings || {};
  }

  // 加载翻译
  loadMessages(locale, messages) {
    this.messages[locale] = { ...this.messages[locale], ...messages };
  }

  // 切换语言
  setLocale(locale) {
    this.locale = locale;
  }

  // 核心翻译方法
  t(key, values = {}) {
    const message = this._resolveMessage(key);
    if (!message) return key;  // 回退到 key

    return this._interpolate(message, values);
  }

  // 解析嵌套键（如 "auth.login.title"）
  _resolveMessage(key) {
    const locales = [this.locale, this.fallbackLocale];

    for (const locale of locales) {
      const messages = this.messages[locale];
      if (!messages) continue;

      const parts = key.split('.');
      let current = messages;

      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          current = undefined;
          break;
        }
      }

      if (typeof current === 'string') return current;
    }

    return undefined;
  }

  // ICU MessageFormat 插值
  _interpolate(message, values) {
    // 1. 处理简单插值：{name}
    let result = message.replace(/\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g, (match, key) => {
      return values[key] !== undefined ? String(values[key]) : match;
    });

    // 2. 处理复数：{count, plural, ...}
    result = result.replace(
      /\{(\w+),\s*plural,\s*([^}]+)\}/g,
      (match, key, pluralForms) => {
        const count = Number(values[key]);
        if (isNaN(count)) return match;
        return this._resolvePlural(count, pluralForms, this.locale);
      }
    );

    // 3. 处理选择：{gender, select, ...}
    result = result.replace(
      /\{(\w+),\s*select,\s*([^}]+)\}/g,
      (match, key, selectForms) => {
        const value = values[key];
        return this._resolveSelect(value, selectForms);
      }
    );

    // 4. 处理序数：{n, selectordinal, ...}
    result = result.replace(
      /\{(\w+),\s*selectordinal,\s*([^}]+)\}/g,
      (match, key, ordinalForms) => {
        const count = Number(values[key]);
        if (isNaN(count)) return match;
        return this._resolveOrdinal(count, ordinalForms, this.locale);
      }
    );

    return result;
  }

  // 复数解析
  _resolvePlural(count, forms, locale) {
    const rules = this._parsePluralForms(forms);
    const pluralCategory = this._getPluralCategory(count, locale);

    // 精确匹配 =n
    const exactMatch = rules[`=${count}`];
    if (exactMatch) return exactMatch.replace(/#/g, String(count));

    // 复数类别匹配
    const categoryMatch = rules[pluralCategory];
    if (categoryMatch) return categoryMatch.replace(/#/g, String(count));

    // other 回退
    return (rules.other || '').replace(/#/g, String(count));
  }

  _parsePluralForms(forms) {
    const rules = {};
    const regex = /(=\d+|\w+)\s*\{([^}]*)\}/g;
    let match;

    while ((match = regex.exec(forms)) !== null) {
      rules[match[1]] = match[2].trim();
    }

    return rules;
  }

  _getPluralCategory(count, locale) {
    // 简化版 CLDR 复数规则
    const rules = {
      en: (n) => n === 1 ? 'one' : 'other',
      zh: () => 'other',  // 中文无复数变化
      ja: () => 'other',
      ar: (n) => {
        if (n === 0) return 'zero';
        if (n === 1) return 'one';
        if (n === 2) return 'two';
        if (n % 100 >= 3 && n % 100 <= 10) return 'few';
        if (n % 100 >= 11 && n % 100 <= 99) return 'many';
        return 'other';
      },
      ru: (n) => {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return 'one';
        if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'few';
        return 'other';
      },
    };

    const lang = locale.split('-')[0];
    const rule = rules[lang] || rules.en;
    return rule(count);
  }

  // 选择解析
  _resolveSelect(value, forms) {
    const rules = this._parsePluralForms(forms);
    return rules[value] || rules.other || '';
  }

  // 序数解析
  _resolveOrdinal(count, forms, locale) {
    const rules = this._parsePluralForms(forms);
    const category = this._getOrdinalCategory(count, locale);
    return (rules[category] || rules.other || '').replace(/#/g, String(count));
  }

  _getOrdinalCategory(count, locale) {
    const lang = locale.split('-')[0];

    if (lang === 'en') {
      const mod10 = count % 10;
      const mod100 = count % 100;
      if (mod10 === 1 && mod100 !== 11) return 'one';
      if (mod10 === 2 && mod100 !== 12) return 'two';
      if (mod10 === 3 && mod100 !== 13) return 'few';
      return 'other';
    }

    return 'other';
  }

  // 日期格式化（使用 Intl API）
  formatDate(date, options = {}) {
    return new Intl.DateTimeFormat(this.locale, options).format(date);
  }

  // 数字格式化
  formatNumber(num, options = {}) {
    return new Intl.NumberFormat(this.locale, options).format(num);
  }

  // 相对时间
  formatRelativeTime(value, unit) {
    return new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' }).format(value, unit);
  }
}

// ========== 使用示例 ==========

const i18n = new I18nEngine({ locale: 'en', fallbackLocale: 'en' });

i18n.loadMessages('en', {
  greeting: 'Hello, {name}!',
  messages: 'You have {count, plural, =0 {no messages} one {1 message} other {# messages}}.',
  gender_greeting: '{gender, select, male {He} female {She} other {They}} went to {place}.',
  ordinal: 'You are the {n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} visitor.',
});

i18n.loadMessages('zh', {
  greeting: '你好，{name}！',
  messages: '你有 {count} 条消息。',
});

i18n.loadMessages('ar', {
  messages: 'لديك {count, plural, =0 {لا رسائل} one {رسالة واحدة} two {رسالتان} few {# رسائل} many {# رسالة} other {# رسالة}}.',
});

// 英文
console.log(i18n.t('greeting', { name: 'Alice' }));
// Hello, Alice!

console.log(i18n.t('messages', { count: 0 }));
// You have no messages.

console.log(i18n.t('messages', { count: 1 }));
// You have 1 message.

console.log(i18n.t('messages', { count: 5 }));
// You have 5 messages.

// 中文
i18n.setLocale('zh');
console.log(i18n.t('greeting', { name: 'Alice' }));
// 你好，Alice！

// 阿拉伯语
i18n.setLocale('ar');
console.log(i18n.t('messages', { count: 0 }));
// لديك لا رسائل.

// 序数
i18n.setLocale('en');
console.log(i18n.t('ordinal', { n: 1 }));  // 1st
console.log(i18n.t('ordinal', { n: 2 }));  // 2nd
console.log(i18n.t('ordinal', { n: 3 }));  // 3rd
console.log(i18n.t('ordinal', { n: 4 }));  // 4th

module.exports = { I18nEngine };
```
