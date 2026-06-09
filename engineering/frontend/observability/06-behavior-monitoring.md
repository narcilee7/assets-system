# 行为监控

## 1. 点击追踪

```javascript
// 自动采集所有点击事件（事件委托）
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-track]') || e.target;

  report({
    type: 'click',
    timestamp: Date.now(),
    target: getSelector(target),
    text: target.innerText?.slice(0, 100),
    x: e.clientX,
    y: e.clientY,
    url: location.href,
    sessionId: getSessionId(),
  });
});

// 生成 CSS 选择器
function getSelector(el) {
  const parts = [];
  while (el && el !== document.body) {
    let selector = el.tagName.toLowerCase();
    if (el.id) {
      selector += `#${el.id}`;
      parts.unshift(selector);
      break;
    }
    if (el.className) {
      selector += `.${el.className.split(' ').slice(0, 2).join('.')}`;
    }
    if (el.getAttribute('data-testid')) {
      selector += `[data-testid="${el.getAttribute('data-testid')}"]`;
    }
    parts.unshift(selector);
    el = el.parentElement;
  }
  return parts.join(' > ');
}
```

## 2. 路由追踪

```javascript
// ============ React Router ============
import { useLocation } from 'react-router-dom';

function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    report({
      type: 'route_change',
      from: prevLocation.current?.pathname,
      to: location.pathname,
      search: location.search,
      duration: performance.now() - navigationStart,
    });
    prevLocation.current = location;
  }, [location]);

  return null;
}

// ============ 通用路由追踪（兼容所有框架）==========
let currentPath = location.pathname;

const observer = new MutationObserver(() => {
  if (location.pathname !== currentPath) {
    report({
      type: 'route_change',
      from: currentPath,
      to: location.pathname,
    });
    currentPath = location.pathname;
  }
});
observer.observe(document, { subtree: true, childList: true });
```

## 3. 会话管理

```javascript
// Session ID：页面生命周期内保持一致
function getSessionId() {
  let id = sessionStorage.getItem('monitor_session_id');
  if (!id) {
    id = generateId();
    sessionStorage.setItem('monitor_session_id', id);
  }
  return id;
}

// 会话时长
let sessionStart = Date.now();
window.addEventListener('beforeunload', () => {
  report({
    type: 'session_end',
    duration: Date.now() - sessionStart,
    pageViews: pageViewCount,
  });
});

// 页面可见性（计算实际活跃时间）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 记录离开时间
  } else {
    // 记录返回时间
  }
});
```

## 4. Funnel（漏斗分析）

```javascript
// 定义漏斗步骤
const checkoutFunnel = [
  { name: 'view_cart', selector: '[data-funnel="cart"]' },
  { name: 'click_checkout', selector: '[data-funnel="checkout"]' },
  { name: 'fill_address', selector: '[data-funnel="address-done"]' },
  { name: 'complete_payment', selector: '[data-funnel="payment-success"]' },
];

// 追踪每一步
function trackFunnel(stepName) {
  report({
    type: 'funnel',
    funnel: 'checkout',
    step: stepName,
    timestamp: Date.now(),
    sessionId: getSessionId(),
  });
}

// 使用
trackFunnel('view_cart');
// 用户点击结算
trackFunnel('click_checkout');
// ...
```

## 5. A/B 测试标记

```javascript
// 将实验分组信息附加到所有上报数据
const experimentContext = {
  'new-checkout-flow': 'treatment',  // 用户在新结算流程实验组
  'hero-image-v2': 'control',        // 用户在对照组
};

function reportWithExperiment(data) {
  report({
    ...data,
    experiments: experimentContext,
  });
}
```
