# 翻译管理

## 1. 翻译键设计

```json
// ❌ 不好的键名
{
  "hello": "Hello",
  "msg1": "Welcome to our app"
}

// ✅ 好的键名（分层 + 语义化）
{
  "common": {
    "actions": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "confirm": "Confirm"
    },
    "labels": {
      "loading": "Loading...",
      "error": "Something went wrong",
      "empty": "No data available"
    }
  },
  "auth": {
    "login": {
      "title": "Sign In",
      "emailLabel": "Email Address",
      "passwordLabel": "Password",
      "submit": "Sign In",
      "forgotPassword": "Forgot password?",
      "noAccount": "Don't have an account? {link}"
    },
    "signup": {
      "title": "Create Account",
      "nameLabel": "Full Name"
    }
  },
  "dashboard": {
    "welcome": "Welcome back, {name}",
    "stats": {
      "users": "{count, plural, one {# user} other {# users}}",
      "revenue": "Revenue: {amount}"
    }
  }
}
```

## 2. 自动提取

```javascript
// 使用 formatjs/cli 自动提取翻译键
// package.json
{
  "scripts": {
    "i18n:extract": "formatjs extract 'src/**/*.tsx' --out-file lang/en.json --id-interpolation-pattern '[sha512:contenthash:base64:6]'",
    "i18n:compile": "formatjs compile lang/en.json --out-file compiled-lang/en.json"
  }
}

// 提取结果（en.json）
{
  "XJ9kL2": {
    "defaultMessage": "Hello, {name}!",
    "description": "Greeting message on home page"
  },
  "aB3cD4": {
    "defaultMessage": "You have {count} messages",
    "description": "Message count in notification badge"
  }
}

// Babel 插件自动提取（构建时）
// babel.config.js
module.exports = {
  plugins: [
    [
      'formatjs',
      {
        idInterpolationPattern: '[sha512:contenthash:base64:6]',
        ast: true,
      },
    ],
  ],
};
```

## 3. 翻译平台集成

```javascript
// Crowdin 集成示例
// crowdin.yml
files:
  - source: /src/locales/en.json
    translation: /src/locales/%two_letters_code%.json

// GitHub Actions 自动同步
// .github/workflows/i18n.yml
name: Sync Translations
on:
  push:
    paths:
      - 'src/locales/en.json'
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Upload to Crowdin
        uses: crowdin/github-action@v1
        with:
          upload_sources: true
          upload_translations: false
          download_translations: true
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_TOKEN }}
```

| 平台 | 特点 | 价格 |
|------|------|------|
| **Crowdin** | 功能全面，Git 集成好 | 免费开源/付费 |
| **Lokalise** | 开发者友好，API 完善 | 付费 |
| **Phrase** | 企业级，工作流强 | 付费 |
| **Transifex** | 老牌，社区项目多 | 付费 |
| **Weblate** | 开源自托管 | 免费 |

## 4. 翻译版本控制

```bash
# 翻译文件命名规范
locales/
├── en.json          # 源语言（唯一源 of truth）
├── zh-CN.json       # 简体中文
├── zh-TW.json       # 繁体中文
├── ja.json          # 日语
├── ko.json          # 韩语
├── ar.json          # 阿拉伯语
├── de.json          # 德语
├── fr.json          # 法语
└── es.json          # 西班牙语

# 翻译覆盖率检查
npm run i18n:coverage
# Output:
# zh-CN: 98.5% (3 keys missing)
# ja: 95.2% (12 keys missing)
# ar: 87.1% (45 keys missing) ⚠️

# 翻译 diff（检测源语言变更）
# 如果 en.json 中某个 key 的 defaultMessage 变了，标记相关翻译为"需更新"
```

## 5. 翻译质量保障

```javascript
// 1. 关键路径翻译不能为空
function validateTranslations(locale, messages, sourceMessages) {
  const missing = [];
  const empty = [];

  for (const key of Object.keys(sourceMessages)) {
    if (!messages[key]) {
      missing.push(key);
    } else if (messages[key] === '') {
      empty.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(`[${locale}] Missing keys:`, missing);
  }
  if (empty.length > 0) {
    console.warn(`[${locale}] Empty translations:`, empty);
  }

  return missing.length === 0;
}

// 2. ICU 语法校验
function validateICU(message) {
  try {
    new IntlMessageFormat(message);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// 3. 构建时校验
// vite-plugin-i18n-validator
export default defineConfig({
  plugins: [
    i18nValidator({
      localesDir: './locales',
      sourceLocale: 'en',
      requireDescription: true,
      checkICU: true,
    }),
  ],
});
```
