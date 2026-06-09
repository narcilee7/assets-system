# 多端路由统一

## 核心问题

同一个页面在不同端有不同的打开方式：
- **App**: `myapp://page/product?id=123`
- **H5**: `https://m.example.com/product/123`
- **小程序**: `/pages/product/product?id=123`
- **RN**: `navigation.navigate('Product', { id: 123 })`

如何让业务代码只写一次路由跳转？

## 1. 统一路由表

```typescript
// config/routes.ts
export interface RouteConfig {
  name: string;           // 路由标识
  path: string;           // 路径模板
  params?: string[];      // 参数列表
  title?: string;         // 页面标题
  auth?: boolean;         // 是否需要登录
}

export const routes: Record<string, RouteConfig> = {
  home: {
    name: 'home',
    path: '/',
    title: '首页',
  },
  product: {
    name: 'product',
    path: '/product/:id',
    params: ['id'],
    title: '商品详情',
  },
  cart: {
    name: 'cart',
    path: '/cart',
    title: '购物车',
    auth: true,
  },
  orderConfirm: {
    name: 'orderConfirm',
    path: '/order/confirm',
    title: '确认订单',
    auth: true,
  },
  userProfile: {
    name: 'userProfile',
    path: '/user/:userId',
    params: ['userId'],
    title: '个人主页',
  },
};
```

## 2. 路由解析器

```typescript
// router/resolver.ts
class RouteResolver {
  private routes: RouteConfig[];

  constructor(routes: RouteConfig[]) {
    this.routes = routes;
  }

  // 将路由名和参数解析为各端路径
  resolve(routeName: string, params: Record<string, string> = {}): ResolvedRoute {
    const config = this.routes.find(r => r.name === routeName);
    if (!config) throw new Error(`Route not found: ${routeName}`);

    // 替换路径参数
    let path = config.path;
    config.params?.forEach(key => {
      if (params[key] === undefined) {
        throw new Error(`Missing param: ${key} for route ${routeName}`);
      }
      path = path.replace(`:${key}`, encodeURIComponent(params[key]));
    });

    // 追加查询参数
    const queryParams = { ...params };
    config.params?.forEach(key => delete queryParams[key]);
    const queryString = new URLSearchParams(queryParams).toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;

    return {
      name: routeName,
      h5: `https://m.example.com${fullPath}`,
      app: `myapp://${fullPath}`,
      miniapp: `/pages${path.replace(/-/g, '_')}/${routeName}?${queryString}`,
    };
  }

  // 反向解析：从 URL 提取路由名和参数
  parse(url: string): { name: string; params: Record<string, string> } | null {
    for (const route of this.routes) {
      const pattern = route.path.replace(/:\w+/g, '([^/]+)');
      const regex = new RegExp(`^${pattern}$`);
      const match = url.match(regex);
      if (match) {
        const params: Record<string, string> = {};
        route.params?.forEach((key, i) => {
          params[key] = decodeURIComponent(match[i + 1]);
        });
        return { name: route.name, params };
      }
    }
    return null;
  }
}
```

## 3. 统一导航 API

```typescript
// router/navigator.ts
import { bridge } from '@company/bridge-sdk';

class UnifiedNavigator {
  private resolver: RouteResolver;

  constructor(routes: RouteConfig[]) {
    this.resolver = new RouteResolver(routes);
  }

  async push(routeName: string, params?: Record<string, any>) {
    const resolved = this.resolver.resolve(routeName, params);

    if (this.isMiniApp()) {
      await bridge.navigateTo({ url: resolved.miniapp });
    } else if (this.isRN()) {
      // React Navigation
      navigationRef.navigate(routeName, params);
    } else if (this.isElectron()) {
      // 打开新窗口或内部路由
      window.location.hash = resolved.h5;
    } else {
      // H5
      window.history.pushState({}, '', resolved.h5);
    }
  }

  async replace(routeName: string, params?: Record<string, any>) {
    const resolved = this.resolver.resolve(routeName, params);

    if (this.isMiniApp()) {
      await bridge.redirectTo({ url: resolved.miniapp });
    } else {
      window.history.replaceState({}, '', resolved.h5);
    }
  }

  async goBack(delta = 1) {
    if (this.isMiniApp()) {
      await bridge.navigateBack({ delta });
    } else {
      window.history.go(-delta);
    }
  }

  // 路由守卫：登录检查
  async pushWithAuth(routeName: string, params?: Record<string, any>) {
    const config = this.resolver.getConfig(routeName);
    if (config?.auth && !isLoggedIn()) {
      await this.push('login', { redirect: routeName, ...params });
      return;
    }
    await this.push(routeName, params);
  }

  private isMiniApp() {
    return typeof wx !== 'undefined' || typeof my !== 'undefined';
  }

  private isRN() {
    return process.env.TARO_ENV === 'rn';
  }

  private isElectron() {
    return typeof window !== 'undefined' && !!window.electronAPI;
  }
}

export const navigator = new UnifiedNavigator(routes);
```

## 4. Deep Link 统一处理

```typescript
// router/deep-link.ts
interface DeepLinkConfig {
  scheme: string;
  host: string;
  pathPatterns: string[];
}

class DeepLinkHandler {
  private configs: DeepLinkConfig[] = [
    { scheme: 'myapp', host: 'app', pathPatterns: ['/product/*', '/user/*'] },
    { scheme: 'https', host: 'm.example.com', pathPatterns: ['/product/*', '/user/*'] },
  ];

  // 解析 Deep Link URL
  parse(url: string): { route: string; params: Record<string, string> } | null {
    try {
      const parsed = new URL(url);
      const config = this.configs.find(c =>
        parsed.protocol === `${c.scheme}:` &&
        parsed.hostname === c.host
      );
      if (!config) return null;

      // 匹配路径模式
      const path = parsed.pathname;
      const resolver = new RouteResolver(routes);
      const result = resolver.parse(path);

      if (result) {
        // 合并 URL 查询参数
        parsed.searchParams.forEach((value, key) => {
          result.params[key] = value;
        });
      }

      return result;
    } catch {
      return null;
    }
  }

  // 处理外部打开
  handleExternalUrl(url: string) {
    const result = this.parse(url);
    if (!result) return;

    // 延迟到应用就绪后导航
    if (appReady) {
      navigator.push(result.route, result.params);
    } else {
      pendingNavigation = result;
    }
  }
}
```
