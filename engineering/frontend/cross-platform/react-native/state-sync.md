# React Native 与原生端状态联动

## 核心场景

跨端应用需要在 **JS 层** 和 **原生层** 之间保持状态一致：
- **登录态**：Token 刷新、过期、多端登录冲突
- **未读数**：推送到达时 Badge 数同步
- **深色模式**：系统主题切换实时响应
- **网络状态**：飞行模式、WiFi/4G 切换

## 1. 登录态联动架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Native App │────▶│  Keychain   │────▶│   JS App    │
│  (主入口)    │     │  (安全存储)  │     │  (业务逻辑)  │
└─────────────┘     └─────────────┘     └─────────────┘
        │                                    │
        │         Token 刷新事件               │
        │◀───────────────────────────────────│
        │                                    │
        │         登录冲突踢出                 │
        │───────────────────────────────────▶│
```

### 简化实现

```typescript
// src/services/AuthBridge.ts
import { NativeModules, NativeEventEmitter } from 'react-native';
const { AuthModule } = NativeModules;

class AuthBridge {
  private emitter = new NativeEventEmitter(AuthModule);
  private token: string | null = null;

  constructor() {
    // 监听原生层触发的登录态变化
    this.emitter.addListener('AuthStateChanged', this.handleStateChange);
    this.emitter.addListener('TokenRefresh', this.handleTokenRefresh);
    this.emitter.addListener('AuthConflict', this.handleConflict);
  }

  // 初始化时从原生层同步登录态
  async syncAuthState() {
    const state = await AuthModule.getAuthState();
    this.token = state.token;
    // 写入全局状态管理
    globalStore.set('auth', state);
  }

  private handleStateChange = (event: { isLoggedIn: boolean; token?: string }) => {
    this.token = event.token || null;
    globalStore.set('auth.isLoggedIn', event.isLoggedIn);
  };

  private handleTokenRefresh = (event: { token: string; expiresAt: number }) => {
    this.token = event.token;
    globalStore.set('auth.token', event.token);
    globalStore.set('auth.expiresAt', event.expiresAt);
  };

  private handleConflict = () => {
    // 多端登录冲突，被踢出
    globalStore.set('auth.isLoggedIn', false);
    globalStore.set('auth.kickReason', '您的账号已在其他设备登录');
    // 导航到登录页
    navigationRef.navigate('Login');
  };

  // JS 层主动登录，同步给原生层
  async login(username: string, password: string) {
    const result = await api.post('/auth/login', { username, password });
    this.token = result.token;
    // 同步给原生层（原生写入 Keychain）
    await AuthModule.setToken(result.token, result.refreshToken);
    globalStore.set('auth', result);
  }

  // JS 层登出，通知原生清理
  async logout() {
    await api.post('/auth/logout');
    await AuthModule.clearToken();
    globalStore.set('auth', { isLoggedIn: false });
  }
}

export const authBridge = new AuthBridge();
```

## 2. 未读数实时同步

```typescript
// src/services/NotificationBridge.ts
class NotificationBridge {
  private subscription: any;

  init() {
    // 监听原生推送到达
    this.subscription = PushNotification.addEventListener('notification', (notif) => {
      // 更新本地未读数
      const current = globalStore.get('unread.total') || 0;
      globalStore.set('unread.total', current + 1);

      // 通知原生更新 App Badge
      NativeModules.BadgeModule.setBadge(current + 1);

      // 如果是聊天消息，更新对应会话未读
      if (notif.type === 'chat') {
        const convUnread = globalStore.get(`unread.conversation.${notif.conversationId}`) || 0;
        globalStore.set(`unread.conversation.${notif.conversationId}`, convUnread + 1);
      }
    });
  }

  // 用户已读某会话，同步清零
  async markAsRead(conversationId: string) {
    await api.post(`/conversations/${conversationId}/read`);
    globalStore.set(`unread.conversation.${conversationId}`, 0);

    // 重新计算总未读
    const conversations = globalStore.get('conversations') || [];
    const total = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
    globalStore.set('unread.total', total);
    NativeModules.BadgeModule.setBadge(total);
  }
}
```

## 3. 深色模式联动

```typescript
// src/hooks/useColorScheme.ts
import { useState, useEffect } from 'react';
import { Appearance, NativeEventEmitter, NativeModules } from 'react-native';

export const useColorScheme = () => {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    // iOS/Android 系统主题变化
    const sub = Appearance.addChangeListener(({ colorScheme: scheme }) => {
      setColorScheme(scheme);
    });

    // 原生层强制切换（如用户手动设置 App 内主题）
    const emitter = new NativeEventEmitter(NativeModules.ThemeModule);
    const themeSub = emitter.addListener('ThemeChanged', (event) => {
      setColorScheme(event.colorScheme);
    });

    return () => {
      sub.remove();
      themeSub.remove();
    };
  }, []);

  return colorScheme; // 'light' | 'dark' | null
};

// 使用：根据主题动态选择颜色
const colors = {
  light: { background: '#fff', text: '#000' },
  dark: { background: '#000', text: '#fff' },
};

const theme = colors[colorScheme || 'light'];
```

## 4. 状态同步最佳实践

| 原则 | 说明 |
|------|------|
| 单一数据源 | 登录态以原生 Keychain 为准，JS 启动时同步 |
| 事件驱动 | 状态变化通过 NativeEventEmitter 广播，不轮询 |
| 乐观更新 | UI 先响应，异步确认失败时回滚 |
| 边界处理 | JS 层未启动时原生仍需处理推送，启动后补发 |
| 版本兼容 | 旧容器不支持新事件时静默忽略 |
