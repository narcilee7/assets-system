# 多平台适配

## 1. 跨平台 Design Tokens

```json
{
  "global": {
    "color": {
      "primary": { "value": "#3b82f6", "type": "color" },
      "text": { "value": "#111827", "type": "color" }
    },
    "spacing": {
      "sm": { "value": "8px", "type": "dimension" },
      "md": { "value": "16px", "type": "dimension" }
    }
  },
  "platform": {
    "ios": {
      "font": { "value": "SF Pro", "type": "fontFamily" }
    },
    "android": {
      "font": { "value": "Roboto", "type": "fontFamily" }
    },
    "web": {
      "font": { "value": "Inter", "type": "fontFamily" }
    }
  }
}
```

## 2. 平台组件映射

| 设计概念 | Web (React) | iOS (SwiftUI) | Android (Compose) |
|----------|-------------|---------------|-------------------|
| Button | `<Button>` | `Button` | `Button` |
| Card | `<Card>` | `VStack + .cardStyle()` | `Card` |
| Modal | `<Dialog>` | `.sheet()` | `AlertDialog` |
| Toast | 自定义 | `.toast()` | `Toast` |

## 3. Figma 同步

```bash
# Style Dictionary：Tokens → 多平台
npx style-dictionary build

# 输出：
# build/web/variables.css
# build/ios/StyleDictionaryColor.swift
# build/android/colors.xml
```

```json
// style-dictionary.config.json
{
  "source": ["tokens/**/*.json"],
  "platforms": {
    "web": {
      "transformGroup": "css",
      "buildPath": "build/web/",
      "files": [{
        "destination": "variables.css",
        "format": "css/variables"
      }]
    },
    "ios": {
      "transformGroup": "ios",
      "buildPath": "build/ios/",
      "files": [{
        "destination": "StyleDictionaryColor.swift",
        "format": "ios/swift/class.swift",
        "className": "StyleDictionaryColor",
        "filter": { "attributes": { "category": "color" } }
      }]
    }
  }
}
```
