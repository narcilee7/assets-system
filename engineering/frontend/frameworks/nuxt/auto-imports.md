# Nuxt Auto-imports

## 1. 自动导入体系

Nuxt 自动导入三类内容，无需手动 import：

| 类型 | 目录 | 示例 |
|------|------|------|
| **组件** | `components/` | `<MyButton>` → `components/MyButton.vue` |
| **组合式函数** | `composables/` | `useUser()` → `composables/useUser.ts` |
| **工具函数** | `utils/` | `formatDate()` → `utils/formatDate.ts` |

## 2. 组件自动导入

```vue
<!-- pages/index.vue -->
<template>
  <!-- 无需 import，直接使用 -->
  <BaseButton color="primary">
    <Icon name="plus" />
    Click me
  </BaseButton>

  <!-- 嵌套目录的组件 -->
  <FormInputText v-model="name" />
  <!-- components/form/InputText.vue -->
</template>
```

### 组件命名规则

```
components/
├── BaseButton.vue          # <BaseButton>
├── base/
│   └── Button.vue          # <BaseButton> (目录 + 文件名)
├── form/
│   ├── InputText.vue       # <FormInputText>
│   └── input/
│       └── Text.vue        # <FormInputText>
└── TheHeader.vue           # <TheHeader>
```

## 3. 组合式函数自动导入

```ts
// composables/useUser.ts
export function useUser() {
  const user = useState<User | null>('user', () => null);

  async function fetchUser() {
    user.value = await $fetch('/api/me');
  }

  async function logout() {
    await $fetch('/api/logout', { method: 'POST' });
    user.value = null;
  }

  return { user, fetchUser, logout };
}
```

```vue
<!-- pages/profile.vue -->
<script setup>
// 无需 import，直接使用
const { user, logout } = useUser();
</script>
```

## 4. 模块生态

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',     // Tailwind CSS
    '@nuxtjs/i18n',            // 国际化
    '@pinia/nuxt',             // Pinia 状态管理
    '@nuxt/image',             // 图片优化
    '@vueuse/nuxt',            // VueUse 工具库
    'nuxt-auth-utils',         // 认证工具
  ],
});
```

## 5. 手写训练：创建自定义模块

```ts
// modules/my-module/index.ts
import { defineNuxtModule, createResolver, addImports } from '@nuxt/kit';

export default defineNuxtModule({
  meta: {
    name: 'my-module',
    configKey: 'myModule',
  },
  defaults: {
    apiUrl: 'https://api.example.com',
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    // 自动导入组合式函数
    addImports([
      { name: 'useMyApi', as: 'useMyApi', from: resolver.resolve('./composables/useMyApi') },
    ]);

    // 注入运行时配置
    nuxt.options.runtimeConfig.public.myApi = options.apiUrl;

    // 注册插件
    nuxt.hooks.hook('app:created', (app) => {
      // 全局注入
      app.provide('myModule', options);
    });
  },
});
```
