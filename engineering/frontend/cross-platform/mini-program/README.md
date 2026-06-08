# Mini Program

跨端能力训练 —— 小程序生命周期、双线程模型、自定义组件、跨厂商适配。

## 核心文档

| 文档 | 内容 |
|------|------|
| [framework-principle.md](framework-principle.md) | 双线程模型、Virtual DOM 映射、JS 引擎隔离、setData 机制 |
| [application.md](application.md) | 简化版电商小程序：首页、分类、商品、购物车、订单 |
| [custom-components.md](custom-components.md) | 自定义组件设计：properties、data、methods、relations、SKU 选择器 |
| [cross-vendor.md](cross-vendor.md) | 跨厂商适配：微信 / 支付宝 / 抖音差异与抹平 |

## 核心主题速览

| 主题 | 关键点 |
|------|--------|
| 生命周期 | App / Page 生命周期，onLoad/onShow/onReady/onHide/onUnload |
| 双线程 | 逻辑层（JS 引擎）与渲染层（WebView）分离 |
| setData | 数据驱动渲染的通信机制，性能陷阱与优化 |
| 分包加载 | 主包、分包、独立分包、预下载 |
| 自定义组件 | properties、data、observers、lifetimes、relations |
| 跨厂商 | wx / my / tt / swan API 差异与统一适配层 |

## 追问

- setData 传输大数据为什么会卡顿？如何优化？
- 自定义组件的 observers 和 Vue 的 watch 有什么区别？
- 小程序包体积超限如何优化？（图片 CDN、代码压缩、分包）
- 跨厂商适配时，如何处理支付、登录等差异最大的 API？
