# 小程序跨厂商适配

## 厂商差异矩阵

| 特性 | 微信 | 支付宝 | 抖音 | 百度 |
|------|------|--------|------|------|
| 基础 API 前缀 | `wx.` | `my.` | `tt.` | `swan.` |
| 网络请求 | `wx.request` | `my.httpRequest` | `tt.request` | `swan.request` |
| 支付 | `wx.requestPayment` | `my.tradePay` | `tt.pay` | `swan.requestPolymerPayment` |
| 登录 | `wx.login` | `my.getAuthCode` | `tt.login` | `swan.login` |
| 分享 | `onShareAppMessage` | `onShareAppMessage` | `tt.shareAppMessage` | `onShareAppMessage` |
| 组件库 | WeUI | AntUI | 无官方 | SmartUI |
| 包体积限制 | 2MB | 2MB | 4MB | 4MB |

## 统一适配层

```javascript
// utils/platform.js
const VENDORS = {
  WECHAT: 'wx',
  ALIPAY: 'my',
  TIKTOK: 'tt',
  BAIDU: 'swan',
};

function detectVendor() {
  if (typeof wx !== 'undefined' && wx.getSystemInfoSync) return VENDORS.WECHAT;
  if (typeof my !== 'undefined' && my.getSystemInfoSync) return VENDORS.ALIPAY;
  if (typeof tt !== 'undefined' && tt.getSystemInfoSync) return VENDORS.TIKTOK;
  if (typeof swan !== 'undefined' && swan.getSystemInfoSync) return VENDORS.BAIDU;
  return VENDORS.WECHAT; // 默认微信
}

const vendor = detectVendor();
const api = {
  wx, my, tt, swan,
}[vendor];

// 统一 API 封装
export const unified = {
  // 网络请求
  request(options) {
    if (vendor === VENDORS.ALIPAY) {
      return new Promise((resolve, reject) => {
        my.httpRequest({
          ...options,
          success: resolve,
          fail: reject,
        });
      });
    }
    return new Promise((resolve, reject) => {
      api.request({
        ...options,
        success: resolve,
        fail: reject,
      });
    });
  },

  // 登录
  login() {
    if (vendor === VENDORS.ALIPAY) {
      return new Promise((resolve, reject) => {
        my.getAuthCode({
          scopes: ['auth_base'],
          success: (res) => resolve({ code: res.authCode }),
          fail: reject,
        });
      });
    }
    return new Promise((resolve, reject) => {
      api.login({
        success: resolve,
        fail: reject,
      });
    });
  },

  // 支付
  requestPayment(orderInfo) {
    const paymentAPI = {
      [VENDORS.WECHAT]: () => wx.requestPayment({
        timeStamp: orderInfo.timeStamp,
        nonceStr: orderInfo.nonceStr,
        package: orderInfo.packageValue,
        signType: orderInfo.signType,
        paySign: orderInfo.paySign,
      }),
      [VENDORS.ALIPAY]: () => my.tradePay({
        tradeNO: orderInfo.tradeNO,
      }),
      [VENDORS.TIKTOK]: () => tt.pay({
        orderInfo,
      }),
    };

    return new Promise((resolve, reject) => {
      paymentAPI[vendor]({
        success: resolve,
        fail: reject,
      });
    });
  },

  // 分享
  share(options) {
    // 微信/百度：通过 onShareAppMessage 页面生命周期
    // 支付宝：通过 my.showSharePanel
    // 抖音：通过 tt.shareAppMessage
    if (vendor === VENDORS.ALIPAY) {
      my.showSharePanel();
      return;
    }
    if (vendor === VENDORS.TIKTOK) {
      tt.shareAppMessage(options);
      return;
    }
    // 微信/百度在页面 onShareAppMessage 中处理
  },

  //  Toast
  showToast(options) {
    api.showToast(options);
  },

  // 导航
  navigateTo(options) {
    api.navigateTo(options);
  },

  navigateBack(options) {
    api.navigateBack(options);
  },

  // 存储
  setStorage(key, value) {
    api.setStorageSync({ key, data: value });
  },

  getStorage(key) {
    try {
      return api.getStorageSync({ key }).data;
    } catch {
      return null;
    }
  },
};

// 条件编译标记（配合构建工具）
// #ifdef WECHAT
// wx 特有代码
// #endif
// #ifdef ALIPAY
// 支付宝特有代码
// #endif
```

## Taro / Uni-app 跨端框架

```javascript
// 使用 Taro 写一份代码，编译到多端
import Taro from '@tarojs/taro';

// 统一的 API，编译时替换为对应平台的实现
Taro.request({ url: 'https://api.example.com/data' });
Taro.login();
Taro.navigateTo({ url: '/pages/detail/index' });

// 条件编译
// #ifdef H5
// H5 端特有的逻辑
// #endif
```

## 跨端构建策略

```javascript
// 构建配置：根据目标平台替换文件
const path = require('path');

module.exports = {
  // 微信构建
  wechat: {
    entry: './src/app.js',
    resolve: {
      alias: {
        '@api': path.resolve(__dirname, 'src/apis/wechat'),
        '@components': path.resolve(__dirname, 'src/components/wechat'),
      },
    },
  },
  // 支付宝构建
  alipay: {
    entry: './src/app.js',
    resolve: {
      alias: {
        '@api': path.resolve(__dirname, 'src/apis/alipay'),
        '@components': path.resolve(__dirname, 'src/components/alipay'),
      },
    },
  },
};
```
